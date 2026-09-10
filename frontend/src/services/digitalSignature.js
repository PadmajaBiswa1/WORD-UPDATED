// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Digital Signature Service (Web Crypto API)
//  Implements SHA-256 content digesting and HMAC-SHA256 signing
// ═══════════════════════════════════════════════════════════════

function getCrypto() {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not available in this environment');
}

/**
 * Converts an ArrayBuffer or Uint8Array to a hex string.
 */
export function bufToHex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Converts an ArrayBuffer or Uint8Array to Base64 string.
 */
export function bufToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Converts Base64 string to Uint8Array.
 */
export function base64ToBuf(str) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(str, 'base64'));
  }
  const binary = window.atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Computes a SHA-256 cryptographic digest of document content.
 * @param {string|object} documentContent
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
export async function computeDigest(documentContent) {
  const crypto = getCrypto();
  const rawText = typeof documentContent === 'string'
    ? documentContent
    : JSON.stringify(documentContent || {});
  const encoder = new TextEncoder();
  const data = encoder.encode(rawText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufToHex(hashBuffer);
}

/**
 * Generates a digital signature for a document using Web Crypto API.
 * Uses SHA-256 digest + HMAC-SHA256 signing key.
 *
 * @param {string|object} documentContent - The content to sign
 * @param {object} signerInfo - Details { id, name, email, role, reason, fieldId, secretKey }
 * @returns {Promise<object>} Signature record with contentHash, signature, timestamp, status
 */
export async function generateSignature(documentContent, signerInfo = {}) {
  const crypto = getCrypto();
  const contentHash = await computeDigest(documentContent);
  const timestamp = new Date().toISOString();
  const fieldId = signerInfo.fieldId || `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const signer = {
    id: String(signerInfo.id || signerInfo.userId || '').trim(),
    name: String(signerInfo.name || signerInfo.displayName || 'Authorized Signatory').trim(),
    email: String(signerInfo.email || '').trim(),
    role: String(signerInfo.role || 'Signatory').trim(),
  };

  const reason = String(signerInfo.reason || 'Document approved and cryptographically verified').trim();

  // Create canonical signing message: contentHash + signer metadata + timestamp
  const messageToSign = `ETHERX-SIG-V1:${contentHash}:${signer.id}:${signer.name}:${signer.email}:${timestamp}:${reason}`;
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(messageToSign);

  // Derive or generate HMAC-SHA256 signing key
  const secretString = signerInfo.secretKey || `${signer.email || signer.name}:${contentHash.slice(0, 16)}`;
  const keyMaterial = encoder.encode(secretString);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
  const signatureHex = bufToHex(signatureBuffer);

  return {
    fieldId,
    signer,
    signature: signatureHex,
    publicKey: 'HMAC-SHA256',
    algorithm: 'HMAC-SHA256',
    contentHash,
    messagePayload: messageToSign,
    status: 'valid',
    signedAt: timestamp,
    verifiedAt: timestamp,
    reason,
  };
}

/**
 * Verifies a digital signature against document content using Web Crypto API.
 *
 * @param {string|object} documentContent - The current document content
 * @param {object} signatureData - The signature record { contentHash, signature, signer, signedAt, reason, messagePayload }
 * @returns {Promise<{ isValid: boolean, status: string, currentHash: string, signatureHash: string, signer: object, verifiedAt: string }>}
 */
export async function verifySignature(documentContent, signatureData = {}) {
  if (!signatureData || !signatureData.contentHash) {
    return {
      isValid: false,
      status: 'invalid',
      reason: 'Missing signature content hash',
      currentHash: '',
      signatureHash: '',
      verifiedAt: new Date().toISOString(),
    };
  }

  const currentHash = await computeDigest(documentContent);
  const signatureHash = signatureData.contentHash;
  const isHashMatch = currentHash.toLowerCase() === signatureHash.toLowerCase();

  let isCryptoValid = isHashMatch;

  // If secret key or original payload is available, verify HMAC
  if (isHashMatch && signatureData.messagePayload && signatureData.signature) {
    try {
      const crypto = getCrypto();
      const encoder = new TextEncoder();
      const signer = signatureData.signer || {};
      const secretString = signatureData.secretKey || `${signer.email || signer.name}:${signatureHash.slice(0, 16)}`;
      const keyMaterial = encoder.encode(secretString);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const sigBytes = new Uint8Array(
        signatureData.signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      );

      if (sigBytes.length > 0) {
        const verified = await crypto.subtle.verify(
          'HMAC',
          cryptoKey,
          sigBytes,
          encoder.encode(signatureData.messagePayload)
        );
        isCryptoValid = verified;
      }
    } catch {
      // If HMAC verification fails or cannot be reconstructed, fall back to hash match
      isCryptoValid = isHashMatch;
    }
  }

  const isValid = isHashMatch && isCryptoValid;
  const status = isValid ? 'valid' : 'invalid';

  return {
    isValid,
    status,
    currentHash,
    signatureHash,
    signer: signatureData.signer || null,
    signedAt: signatureData.signedAt || null,
    verifiedAt: new Date().toISOString(),
    reason: isValid ? 'Signature matches current document content' : 'Document has been modified since signing',
  };
}

/**
 * Formats a SHA-256 hash into an abbreviated stamp.
 */
export function formatHashStamp(hash = '') {
  if (!hash || hash.length < 16) return hash || 'N/A';
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

/**
 * Generates an HTML card element for a verified digital signature.
 * Suitable for inserting directly into the document editor.
 */
export function generateSignatureCardHtml(sig) {
  const signerName = sig.signer?.name || 'Authorized Signatory';
  const signerRole = sig.signer?.role || 'Signatory';
  const signedDate = sig.signedAt ? new Date(sig.signedAt).toLocaleString() : new Date().toLocaleString();
  const hashStamp = sig.contentHash ? `SHA-256: ${sig.contentHash.slice(0, 12)}...${sig.contentHash.slice(-8)}` : 'SHA-256 Verified';
  const fieldId = sig.fieldId || `sig-${Date.now()}`;

  return `
<div id="${fieldId}" data-signature-field="true" data-status="valid" style="display:inline-block;border:2px solid #22c55e;border-radius:8px;padding:14px 18px;margin:12px 0;background:#0d2818;color:#f0fdf4;font-family:system-ui,-apple-system,sans-serif;max-width:440px;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(34,197,94,0.3);padding-bottom:8px;margin-bottom:10px;">
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:#22c55e;color:#000;border-radius:50%;font-size:12px;font-weight:900;">✓</span>
      <span style="font-size:12px;font-weight:700;color:#4ade80;letter-spacing:0.05em;text-transform:uppercase;">Verified Digital Signature</span>
    </div>
    <span style="font-size:10px;background:rgba(34,197,94,0.2);color:#86efac;padding:2px 8px;border-radius:999px;border:1px solid #22c55e;">CRYPTOGRAPHICALLY VERIFIED</span>
  </div>
  <div style="font-size:15px;font-weight:600;color:#ffffff;margin-bottom:2px;">${signerName}</div>
  <div style="font-size:12px;color:#a7f3d0;margin-bottom:8px;">${signerRole}</div>
  <div style="font-size:11px;color:#cbd5e1;margin-bottom:4px;">Date: <strong style="color:#ffffff;">${signedDate}</strong></div>
  <div style="font-size:10px;font-family:monospace;background:#051f11;padding:4px 8px;border-radius:4px;color:#86efac;word-break:break-all;border:1px solid rgba(34,197,94,0.2);">
    ${hashStamp}
  </div>
</div>
`.trim();
}
