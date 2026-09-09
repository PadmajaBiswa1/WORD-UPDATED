import { useState, useEffect } from 'react';
import { useUIStore, useDocumentStore, useEditorStore } from '@/store';
import { Modal, Button, Stack, Input, Label, Badge } from '@/components/ui';
import { getStoredUser, documentApi } from '@/services/api';
import {
  generateSignature,
  verifySignature,
  computeDigest,
  formatHashStamp,
  generateSignatureCardHtml,
} from '@/services/digitalSignature';

export function DigitalSignatureDialog() {
  const { closeDialog, toast } = useUIStore();
  const { id: docId, content, contentJson, signatures = [], addSignature, setSignatures } = useDocumentStore();
  const { editor } = useEditorStore();

  const user = getStoredUser();

  const [signerName, setSignerName] = useState(user.name || 'Authorized Signatory');
  const [signerEmail, setSignerEmail] = useState(user.email || '');
  const [signerRole, setSignerRole] = useState('Authorized Signatory');
  const [reason, setReason] = useState('Document approved and cryptographically verified');
  const [currentHash, setCurrentHash] = useState('');
  const [signing, setSigning] = useState(false);
  const [verifyingMap, setVerifyingMap] = useState({});

  const documentPayload = contentJson || content || '<p></p>';

  useEffect(() => {
    let alive = true;
    computeDigest(documentPayload).then((h) => {
      if (alive) setCurrentHash(h);
    });
    return () => { alive = false; };
  }, [documentPayload]);

  const handleSign = async () => {
    if (!signerName.trim()) {
      toast('Signer name is required', 'error');
      return;
    }

    setSigning(true);
    try {
      const fieldId = `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const sigData = await generateSignature(documentPayload, {
        id: user.id || user.email || 'signer',
        name: signerName.trim(),
        email: signerEmail.trim(),
        role: signerRole.trim(),
        reason: reason.trim(),
        fieldId,
      });

      // If document ID exists, register with backend verification endpoint
      if (docId) {
        try {
          const res = await documentApi.verifySignature(docId, fieldId, {
            signer: sigData.signer,
            signature: sigData.signature,
            publicKey: sigData.publicKey,
            contentHash: sigData.contentHash,
            reason: sigData.reason,
            status: 'valid',
            documentContent: typeof documentPayload === 'string' ? documentPayload : JSON.stringify(documentPayload),
          });
          if (res.signature) {
            sigData.verifiedAt = res.signature.verifiedAt;
          }
        } catch (apiErr) {
          console.warn('Backend signature registration fallback:', apiErr.message);
        }
      }

      // Add to store
      addSignature(sigData);

      // Insert stamp into editor
      if (editor) {
        const cardHtml = generateSignatureCardHtml(sigData);
        editor.chain().focus().insertContent(cardHtml).run();
      }

      toast('Document signed with Web Crypto API and stamp inserted', 'success');
      closeDialog('digitalSignature');
    } catch (err) {
      console.error('Signing failed:', err);
      toast(`Signing failed: ${err.message}`, 'error');
    } finally {
      setSigning(false);
    }
  };

  const handleVerify = async (sig) => {
    setVerifyingMap((m) => ({ ...m, [sig.fieldId]: true }));
    try {
      // Local Web Crypto verification
      const localResult = await verifySignature(documentPayload, sig);

      // Backend verification
      let backendValid = localResult.isValid;
      if (docId) {
        try {
          const res = await documentApi.verifySignature(docId, sig.fieldId, {
            signer: sig.signer,
            signature: sig.signature,
            publicKey: sig.publicKey,
            contentHash: sig.contentHash,
            reason: sig.reason,
            documentContent: typeof documentPayload === 'string' ? documentPayload : JSON.stringify(documentPayload),
          });
          backendValid = res.isValid;
        } catch (e) {
          console.warn('Backend verification query fallback:', e.message);
        }
      }

      const isValid = localResult.isValid && backendValid;
      const updated = {
        ...sig,
        status: isValid ? 'valid' : 'invalid',
        verifiedAt: new Date().toISOString(),
      };

      addSignature(updated);

      if (isValid) {
        toast(`✓ Signature verified for ${sig.signer?.name || 'Signer'} — document is untampered`, 'success');
      } else {
        toast(`⚠️ Signature INVALID — document has been modified since signing!`, 'error');
      }
    } catch (err) {
      toast(`Verification error: ${err.message}`, 'error');
    } finally {
      setVerifyingMap((m) => ({ ...m, [sig.fieldId]: false }));
    }
  };

  const handleInsertCard = (sig) => {
    if (!editor) {
      toast('Editor is not ready', 'info');
      return;
    }
    const cardHtml = generateSignatureCardHtml(sig);
    editor.chain().focus().insertContent(cardHtml).run();
    toast('Signature stamp inserted into document', 'success');
  };

  return (
    <Modal
      title="Digital Signatures & Web Crypto Verification"
      onClose={() => closeDialog('digitalSignature')}
      maxWidth={680}
    >
      <Stack spacing={16}>
        {/* Document Hash Digest Status */}
        <div style={{
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          padding: '12px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Current Document SHA-256 Digest
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Web Crypto SHA-256</span>
          </div>
          <div style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: 'var(--text-main)',
            wordBreak: 'break-all',
            background: 'var(--bg-app)',
            padding: '6px 10px',
            borderRadius: 4,
            border: '1px solid var(--border-subtle)',
          }}>
            {currentHash || 'Computing SHA-256 hash…'}
          </div>
        </div>

        {/* Existing Signatures List */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 8 }}>
            Existing Signatures ({signatures.length})
          </div>

          {signatures.length === 0 ? (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
              border: '1px dashed var(--border-strong)',
              borderRadius: 6,
            }}>
              No digital signatures attached to this document yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto' }}>
              {signatures.map((sig, idx) => {
                const isValid = sig.status === 'valid';
                const isVerifying = Boolean(verifyingMap[sig.fieldId]);

                return (
                  <div
                    key={sig.fieldId || idx}
                    style={{
                      border: `1px solid ${isValid ? '#22c55e' : '#ef4444'}`,
                      borderRadius: 6,
                      padding: '10px 14px',
                      background: isValid ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: isValid ? '#22c55e' : '#ef4444',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          {isValid ? '✓' : '✕'}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                          {sig.signer?.name || 'Authorized Signer'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          ({sig.signer?.role || 'Signatory'})
                        </span>
                      </div>
                      <Badge variant={isValid ? 'success' : 'danger'}>
                        {isValid ? '✓ VERIFIED' : '✕ INVALID / MODIFIED'}
                      </Badge>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                      Signed: {sig.signedAt ? new Date(sig.signedAt).toLocaleString() : 'N/A'} • Reason: {sig.reason || 'Document approved'}
                    </div>

                    <div style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: isValid ? '#22c55e' : '#ef4444',
                      background: 'var(--bg-app)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      marginBottom: 8,
                      wordBreak: 'break-all',
                    }}>
                      Hash Stamp: {formatHashStamp(sig.contentHash)}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleVerify(sig)}
                        disabled={isVerifying}
                      >
                        {isVerifying ? 'Verifying…' : 'Verify Integrity'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleInsertCard(sig)}
                      >
                        Insert Stamp into Doc
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* New Signature Form */}
        <div style={{
          borderTop: '1px solid var(--border-strong)',
          paddingTop: 14,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 10 }}>
            Sign Document with Web Crypto
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <Label>Signer Full Name</Label>
              <Input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Your Name"
              />
            </div>
            <div>
              <Label>Signer Email</Label>
              <Input
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="signer@example.com"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <Label>Signer Role / Title</Label>
              <Input
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
                placeholder="Author, Reviewer, Executive..."
              />
            </div>
            <div>
              <Label>Reason for Signing</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Document approved and verified"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <Button variant="secondary" onClick={() => closeDialog('digitalSignature')}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSign}
              disabled={signing || !currentHash}
            >
              {signing ? 'Signing with Web Crypto…' : '✓ Sign & Insert Verified Stamp'}
            </Button>
          </div>
        </div>
      </Stack>
    </Modal>
  );
}
