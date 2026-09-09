// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Client-Side Document Crypto Service (AES-GCM)
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

export function toBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(u8).toString('base64');
  }
  let binary = '';
  const len = u8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(u8[i]);
  }
  return window.btoa(binary);
}

export function fromBase64(str) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(str, 'base64'));
  }
  const binary = window.atob(str);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives an AES-GCM 256-bit key from a passphrase and salt using PBKDF2 (SHA-256).
 * @param {string} passphrase
 * @param {Uint8Array|ArrayBuffer|string} salt
 * @param {number} iterations
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(passphrase, salt, iterations = 100000) {
  if (!passphrase || typeof passphrase !== 'string') {
    throw new Error('Passphrase is required and must be a non-empty string');
  }

  const crypto = getCrypto();
  const textEncoder = new TextEncoder();
  const passphraseBytes = textEncoder.encode(passphrase);

  const saltBytes =
    typeof salt === 'string'
      ? fromBase64(salt)
      : salt instanceof Uint8Array
      ? salt
      : new Uint8Array(salt);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a document JSON object or string with a passphrase using AES-GCM 256.
 * @param {object|string} docJson
 * @param {string} passphrase
 * @returns {Promise<{ keyVersion: number, kdf: string, salt: string, nonce: string, authTag: string, encryptedPayload: string }>}
 */
export async function encryptDocument(docJson, passphrase) {
  if (!passphrase || typeof passphrase !== 'string') {
    throw new Error('Passphrase is required to encrypt document');
  }

  const crypto = getCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(passphrase, salt);

  const jsonStr = typeof docJson === 'string' ? docJson : JSON.stringify(docJson);
  const dataBytes = new TextEncoder().encode(jsonStr);

  // Web Crypto AES-GCM appends the 16-byte authentication tag to the ciphertext buffer
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      tagLength: 128,
    },
    key,
    dataBytes
  );

  const fullCiphertext = new Uint8Array(encryptedBuffer);
  const tagLength = 16;
  const payloadBytes = fullCiphertext.slice(0, fullCiphertext.length - tagLength);
  const authTagBytes = fullCiphertext.slice(fullCiphertext.length - tagLength);

  return {
    keyVersion: 1,
    kdf: 'PBKDF2',
    salt: toBase64(salt),
    nonce: toBase64(nonce),
    authTag: toBase64(authTagBytes),
    encryptedPayload: toBase64(payloadBytes),
  };
}

/**
 * Decrypts a document security envelope using the passphrase.
 * @param {{ salt: string, nonce: string, authTag?: string, encryptedPayload: string }} securityEnvelope
 * @param {string} passphrase
 * @returns {Promise<any>} The parsed docJson
 */
export async function decryptDocument(securityEnvelope, passphrase) {
  if (!securityEnvelope || !securityEnvelope.encryptedPayload || !securityEnvelope.salt || !securityEnvelope.nonce) {
    throw new Error('Invalid document security envelope: missing required fields');
  }
  if (!passphrase || typeof passphrase !== 'string') {
    throw new Error('Passphrase is required to decrypt document');
  }

  const crypto = getCrypto();

  try {
    const saltBytes = fromBase64(securityEnvelope.salt);
    const nonceBytes = fromBase64(securityEnvelope.nonce);
    const payloadBytes = fromBase64(securityEnvelope.encryptedPayload);

    const key = await deriveKey(passphrase, saltBytes);

    let ciphertextWithTag;
    if (securityEnvelope.authTag) {
      const authTagBytes = fromBase64(securityEnvelope.authTag);
      ciphertextWithTag = new Uint8Array(payloadBytes.length + authTagBytes.length);
      ciphertextWithTag.set(payloadBytes, 0);
      ciphertextWithTag.set(authTagBytes, payloadBytes.length);
    } else {
      ciphertextWithTag = payloadBytes;
    }

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonceBytes,
        tagLength: 128,
      },
      key,
      ciphertextWithTag
    );

    const jsonStr = new TextDecoder().decode(decryptedBuffer);
    try {
      return JSON.parse(jsonStr);
    } catch {
      return jsonStr;
    }
  } catch (err) {
    throw new Error('Invalid passphrase or corrupted document envelope: ' + (err.message || 'Decryption failed'));
  }
}
