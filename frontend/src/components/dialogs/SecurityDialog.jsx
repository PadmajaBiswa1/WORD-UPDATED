import { useState } from 'react';
import { useUIStore, useDocumentStore, useEditorStore } from '@/store';
import { Modal, Button, Stack, Input, Label, Badge } from '@/components/ui';
import { encryptDocument, decryptDocument } from '@/services/crypto';

export function SecurityDialog() {
  const { closeDialog, toast } = useUIStore();
  const {
    title,
    content,
    contentJson,
    security,
    isLocked,
    setSecurityEnvelope,
    unlockDocument,
    lockDocument,
  } = useDocumentStore();
  const { editor } = useEditorStore();

  const [mode, setMode] = useState('status'); // 'status', 'setup', 'unlock', 'rotate'
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isProtected = Boolean(security && (security.protected || security.encryptedPayload));

  const handleEnableProtection = async () => {
    if (!passphrase || passphrase.length < 6) {
      toast('Passphrase must be at least 6 characters long', 'error');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      toast('Passphrases do not match', 'error');
      return;
    }

    setLoading(true);
    try {
      const docPayload = contentJson || {
        type: 'doc',
        content: editor?.getJSON()?.content || [],
        html: editor?.getHTML() || content || '<p></p>',
      };

      const envelope = await encryptDocument(docPayload, passphrase);
      const newSecurity = {
        protected: true,
        keyVersion: envelope.keyVersion || 1,
        kdf: envelope.kdf || 'PBKDF2',
        salt: envelope.salt,
        nonce: envelope.nonce,
        authTag: envelope.authTag,
        encryptedPayload: envelope.encryptedPayload,
        locked: false,
      };

      setSecurityEnvelope(newSecurity);
      unlockDocument(passphrase);
      toast('Document encrypted and password protection enabled', 'success');
      setPassphrase('');
      setConfirmPassphrase('');
      setMode('status');
    } catch (err) {
      toast(`Encryption failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!unlockPassphrase) {
      toast('Please enter your passphrase', 'error');
      return;
    }

    setLoading(true);
    try {
      const decrypted = await decryptDocument(security, unlockPassphrase);
      unlockDocument(unlockPassphrase);
      if (editor && decrypted) {
        if (decrypted.content || decrypted.type === 'doc') {
          editor.commands.setContent(decrypted);
        } else if (typeof decrypted === 'string') {
          editor.commands.setContent(decrypted);
        }
      }
      toast('Document unlocked successfully', 'success');
      setUnlockPassphrase('');
      setMode('status');
    } catch (err) {
      toast(`Unlock failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLockNow = () => {
    lockDocument();
    toast('Document locked immediately', 'info');
    closeDialog('security');
  };

  const handleClearSecurity = () => {
    if (window.confirm('Are you sure you want to remove password protection? The document will be saved in plaintext.')) {
      setSecurityEnvelope(null);
      unlockDocument(null);
      toast('Password protection removed', 'warning');
      setMode('status');
    }
  };

  const handleExportBackup = () => {
    if (!security) return;
    const backupData = {
      title,
      exportedAt: new Date().toISOString(),
      securityEnvelope: security,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'document').replace(/[^a-z0-9_-]/gi, '_')}-security-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Encrypted backup downloaded', 'success');
  };

  return (
    <Modal title="Document Security & Encryption" onClose={() => closeDialog('security')} width={520}>
      <Stack gap={16}>
        {/* Status Banner */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: isProtected
              ? isLocked
                ? 'rgba(234, 179, 8, 0.1)'
                : 'rgba(34, 197, 94, 0.1)'
              : 'var(--bg-elevated)',
            border: `1px solid ${
              isProtected
                ? isLocked
                  ? 'rgba(234, 179, 8, 0.3)'
                  : 'rgba(34, 197, 94, 0.3)'
                : 'var(--border)'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{isProtected ? (isLocked ? '🔒' : '🛡️') : '🔓'}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                Key Status Indicator
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {isProtected
                  ? isLocked
                    ? 'Encrypted with AES-256-GCM (Currently Locked)'
                    : 'Encrypted with AES-256-GCM (Active & Unlocked)'
                  : 'Unprotected (Plaintext Document)'}
              </div>
            </div>
          </div>
          <Badge
            color={
              isProtected
                ? isLocked
                  ? '#eab308'
                  : '#22c55e'
                : 'var(--text-muted)'
            }
          >
            {isProtected ? (isLocked ? 'LOCKED' : 'PROTECTED') : 'OFF'}
          </Badge>
        </div>

        {/* Info details */}
        {isProtected && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              fontSize: 11,
              background: 'var(--bg-app)',
              padding: 10,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Cipher:</span>{' '}
              <strong style={{ color: 'var(--gold)' }}>AES-256-GCM</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>KDF:</span>{' '}
              <strong style={{ color: 'var(--gold)' }}>{security.kdf || 'PBKDF2'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Key Version:</span>{' '}
              <strong style={{ color: 'var(--gold)' }}>v{security.keyVersion || 1}</strong>
            </div>
          </div>
        )}

        {/* Views */}
        {mode === 'status' && (
          <Stack gap={12}>
            {isProtected ? (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  This document uses zero-knowledge encryption. Plaintext is never transmitted to or stored on the server.
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!isLocked ? (
                    <Button variant="outline" onClick={handleLockNow}>
                      🔒 Lock Now
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setMode('unlock')}>
                      🔑 Unlock with Passphrase
                    </Button>
                  )}
                  <Button variant="subtle" onClick={() => setMode('setup')}>
                    🔄 Change Passphrase
                  </Button>
                  <Button variant="subtle" onClick={handleExportBackup}>
                    📦 Export Backup Envelope
                  </Button>
                  <Button variant="danger" onClick={handleClearSecurity}>
                    ✕ Clear Security
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  Protect this document with client-side AES-256-GCM encryption. Once encrypted, anyone opening the document must provide the passphrase to view or edit its contents.
                </p>
                <div>
                  <Button variant="primary" onClick={() => setMode('setup')}>
                    🛡️ Enable Document Encryption
                  </Button>
                </div>
              </>
            )}

            {/* Zero-knowledge notice */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(212,175,55,0.06)',
                border: '1px solid rgba(212,175,55,0.2)',
                fontSize: 11,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: 'var(--gold)' }}>⚠️ Recovery Warning:</strong> EtherX Word
              does not store your passphrase or retain a recovery master key. If you forget your
              passphrase, your encrypted document cannot be restored.
            </div>
          </Stack>
        )}

        {mode === 'setup' && (
          <Stack gap={12}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>
              {isProtected ? 'Rotate / Set New Passphrase' : 'Set Protection Passphrase'}
            </div>
            <div>
              <Label>Passphrase (Minimum 6 characters)</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={passphrase}
                onChange={setPassphrase}
                placeholder="Enter strong passphrase…"
                autoFocus
              />
            </div>
            <div>
              <Label>Confirm Passphrase</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassphrase}
                onChange={setConfirmPassphrase}
                placeholder="Re-enter passphrase…"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                id="show-pw"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              <label htmlFor="show-pw" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>
                Show Passphrase
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="subtle" onClick={() => setMode('status')} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleEnableProtection} disabled={loading}>
                {loading ? 'Encrypting…' : 'Encrypt & Save'}
              </Button>
            </div>
          </Stack>
        )}

        {mode === 'unlock' && (
          <Stack gap={12}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>
              Unlock Document
            </div>
            <div>
              <Label>Enter Passphrase</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={unlockPassphrase}
                onChange={setUnlockPassphrase}
                placeholder="Enter passphrase to decrypt…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUnlock();
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                id="show-unlock-pw"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              <label htmlFor="show-unlock-pw" style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>
                Show Passphrase
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button variant="subtle" onClick={() => setMode('status')} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleUnlock} disabled={loading}>
                {loading ? 'Decrypting…' : 'Unlock Document'}
              </Button>
            </div>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
