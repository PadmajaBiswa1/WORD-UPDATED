import { useEffect, useRef, useCallback } from 'react';
import { useDocumentStore, useUIStore } from '@/store';
import { documentApi } from '@/services/api';
import { encryptDocument } from '@/services/crypto';

const DELAY = 3000;
const BACKUP_STORAGE_PREFIX = 'etherx_doc_backup_';

export function useAutoSave() {
  const toast = useUIStore((s) => s.toast);
  const autoSaveEnabled = useUIStore((s) => s.autoSaveEnabled);
  const isDirty = useDocumentStore((s) => s.isDirty);
  const content = useDocumentStore((s) => s.content);
  const timer = useRef(null);
  const vTimer = useRef(null);

  const save = useCallback(async () => {
    const store = useDocumentStore.getState();
    if (!store) return;
    const {
      id,
      title,
      content: c,
      contentJson,
      design,
      headerFooter,
      comments,
      trackChanges,
      security,
      documentParts,
      aiProfile,
      references,
      styles,
      cryptoKey,
      isDirty: dirty,
      setSaving,
      setLastSaved,
      setSecurityEnvelope,
    } = store;

    if (!id) {
      console.warn('⚠️ Cannot save: no document ID');
      return;
    }

    if (!dirty) {
      console.debug('✓ Document already saved');
      return;
    }

    setSaving(true);
    try {
      console.log(`💾 Saving document ${id}: "${title}"`);

      let payloadContent = c;
      let payloadContentJson = contentJson;
      let currentSecurity = security ? { ...security } : null;

      // If document is encrypted (security?.protected === true), save the encrypted payload instead of raw plaintext
      if (security?.protected === true) {
        if (cryptoKey) {
          try {
            const docPayload = contentJson || {
              type: 'doc',
              content: [],
              html: c || '<p></p>',
            };
            const envelope = await encryptDocument(docPayload, cryptoKey);
            currentSecurity = {
              ...currentSecurity,
              protected: true,
              keyVersion: envelope.keyVersion || currentSecurity?.keyVersion || 1,
              kdf: envelope.kdf || currentSecurity?.kdf || 'PBKDF2',
              salt: envelope.salt,
              nonce: envelope.nonce,
              authTag: envelope.authTag,
              encryptedPayload: envelope.encryptedPayload,
            };
            if (setSecurityEnvelope) {
              setSecurityEnvelope(currentSecurity);
            }
          } catch (encErr) {
            console.error('Failed to re-encrypt document payload during autosave:', encErr);
          }
        }

        // Replace raw plaintext with empty content so unencrypted text is not saved
        payloadContent = '';
        payloadContentJson = null;
      }

      const payload = {
        title,
        content: payloadContent,
        contentJson: payloadContentJson,
        design,
        headerFooter,
        comments,
        trackChanges,
        security: currentSecurity ? {
          protected: Boolean(currentSecurity.protected),
          keyVersion: currentSecurity.keyVersion || 1,
          kdf: currentSecurity.kdf || 'PBKDF2',
          salt: currentSecurity.salt || '',
          nonce: currentSecurity.nonce || '',
          authTag: currentSecurity.authTag || '',
          encryptedPayload: currentSecurity.encryptedPayload || '',
        } : null,
        documentParts: Array.isArray(documentParts) ? documentParts : [],
        aiProfile: aiProfile || null,
        references: references || { citations: [], captions: [], indexEntries: [] },
        styles: Array.isArray(styles) ? styles : [],
      };

      // 1. Send payload to backend
      await documentApi.save(id, payload);

      // 2. Save encrypted/clean payload to local storage
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(`${BACKUP_STORAGE_PREFIX}${id}`, JSON.stringify(payload));
        } catch (storageErr) {
          console.warn('Could not cache document backup in localStorage:', storageErr);
        }
      }

      console.log(`✅ Document ${id} saved successfully`);
      setLastSaved();
      toast('Document saved', 'success');
    } catch (err) {
      console.error(`❌ Save failed for ${id}:`, err);
      toast('Auto-save failed', 'error');
    } finally {
      setSaving(false);
    }
  }, [toast]);

  // Debounce on content changes
  useEffect(() => {
    if (!autoSaveEnabled) {
      clearTimeout(timer.current);
      return;
    }
    if (!isDirty) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(save, DELAY);
    return () => clearTimeout(timer.current);
  }, [autoSaveEnabled, isDirty, content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Version snapshot every 5 min
  useEffect(() => {
    if (!autoSaveEnabled) {
      clearInterval(vTimer.current);
      return;
    }
    vTimer.current = setInterval(() => {
      const { content: c, addVersion } = useDocumentStore.getState();
      if (c) addVersion(c);
    }, 5 * 60_000);
    return () => clearInterval(vTimer.current);
  }, [autoSaveEnabled]);

  // Ctrl/Cmd+S
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [save]);

  return { save };
}
