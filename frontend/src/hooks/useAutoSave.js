import { useEffect, useRef, useCallback } from 'react';
import { useDocumentStore, useUIStore } from '@/store';
import { documentApi, API_BASE, getStoredUser } from '@/services/api';
import { encryptDocument } from '@/services/crypto';
import { readLocalDraft, writeLocalDraft } from '@/utils/draftStorage';
import { updateCachedRecentDoc } from '@/utils/recentDocsCache';
import { stripAutoPageBreaks } from '@/components/editor/PageBreak';

const DELAY = 1000; // 1s inactivity debounce
const MAX_WAIT = 3000; // 3s maximum throttle wait
const SAVE_FIELDS = ['title', 'content', 'contentJson', 'design', 'headerFooter', 'layout', 'pageCount', 'comments', 'trackChanges', 'security', 'documentParts', 'signatures', 'accessPolicy', 'aiProfile', 'references', 'styles'];

function draftMatchesSnapshot(draft, snapshot) {
  return SAVE_FIELDS.every((key) => {
    const normalize = (value) => key === 'content' ? stripAutoPageBreaks(value) : value;
    return JSON.stringify(normalize(draft[key])) === JSON.stringify(normalize(snapshot[key]));
  });
}

export function useAutoSave() {
  const toast = useUIStore((s) => s.toast);
  const autoSaveEnabled = useUIStore((s) => s.autoSaveEnabled);
  const id = useDocumentStore((s) => s.id);
  const isDirty = useDocumentStore((s) => s.isDirty);
  const updatedAt = useDocumentStore((s) => s.updatedAt);

  const timer = useRef(null);
  const firstChangeTime = useRef(0);
  const vTimer = useRef(null);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const save = useCallback(async ({ manual = false } = {}) => {
    const store = useDocumentStore.getState();
    if (!store) return;
    const {
      id: docId,
      title,
      content: c,
      contentJson,
      design,
      headerFooter,
      layout,
      pageCount,
      comments,
      trackChanges,
      security,
      documentParts,
      signatures,
      accessPolicy,
      aiProfile,
      references,
      styles,
      cryptoKey,
      isDirty: dirty,
      updatedAt: docUpdatedAt,
      setSaving,
      setLastSaved,
    } = store;

    if (!docId) {
      console.warn('⚠️ Cannot save: no document ID');
      return;
    }

    if (!dirty && !manual) {
      console.debug('✓ Document already saved');
      return;
    }

    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setSaving(true);
    const saveInitiatedTime = docUpdatedAt ? new Date(docUpdatedAt).getTime() : Date.now();

    // Declared outside try: the catch block caches it for the recent-docs list.
    let payloadContent = stripAutoPageBreaks(c);
    try {
      console.log(`💾 Saving document ${docId}: "${title}" (manual=${manual})`);

      let payloadContentJson = contentJson;
      let currentSecurity = security ? { ...security } : null;

      // If document is encrypted (security?.protected === true), save the encrypted payload
      if (security?.protected === true) {
        if (cryptoKey) {
          try {
            const docPayload = {
              type: 'doc',
              content: contentJson?.content || [],
              html: stripAutoPageBreaks(c || '<p></p>'),
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
          } catch (encErr) {
            console.error('Failed to re-encrypt document payload during autosave:', encErr);
            throw encErr;
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
        layout,
        pageCount,
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
        signatures: Array.isArray(signatures) ? signatures : [],
        accessPolicy,
        aiProfile: aiProfile || null,
        references: references || { citations: [], captions: [], indexEntries: [] },
        styles: Array.isArray(styles) ? styles : [],
      };

      // 1. Send payload to backend
      const savedDoc = await documentApi.save(docId, payload);

      updateCachedRecentDoc(docId, {
        ...savedDoc, ...payload,
        updatedAt: savedDoc?.updatedAt || new Date().toISOString(),
      });

      // 2. Check if newer edits were made while save was in flight
      let latestStore = useDocumentStore.getState();
      const currentStoreTime = latestStore.updatedAt ? new Date(latestStore.updatedAt).getTime() : 0;
      const hasNewerEdits = currentStoreTime > saveInitiatedTime
        || latestStore.title !== title || latestStore.content !== c
        || latestStore.design !== design || latestStore.layout !== layout
        || latestStore.headerFooter !== headerFooter || latestStore.comments !== comments
        || latestStore.contentJson !== contentJson || latestStore.trackChanges !== trackChanges
        || latestStore.references !== references || latestStore.styles !== styles
        || latestStore.signatures !== signatures || latestStore.accessPolicy !== accessPolicy
        || latestStore.documentParts !== documentParts || latestStore.aiProfile !== aiProfile
        || latestStore.security !== security || latestStore.cryptoKey !== cryptoKey
        || latestStore.pageCount !== pageCount;

      if (latestStore.id !== docId) {
        const draft = readLocalDraft(docId);
        if (!draft || draftMatchesSnapshot(draft, store)) {
          writeLocalDraft(docId, { ...store, security: currentSecurity, isDirty: false });
        }
        return savedDoc;
      }

      if (savedDoc && Number.isFinite(Number(savedDoc.revision))) {
        latestStore.setRevision(Number(savedDoc.revision));
      }
      // Encryption metadata belongs to this completed save, not a new edit.
      if (latestStore.security === security && latestStore.cryptoKey === cryptoKey && currentSecurity?.protected) {
        useDocumentStore.setState({ security: currentSecurity });
        latestStore = useDocumentStore.getState();
      }

      if (!hasNewerEdits) {
        setLastSaved(new Date());
        writeLocalDraft(docId, { ...latestStore, isDirty: false });
      } else {
        useDocumentStore.setState({ lastSaved: new Date(), isDirty: true });
        writeLocalDraft(docId, { ...latestStore, isDirty: true });
        pendingSaveRef.current = true;
      }

      console.log(`✅ Document ${docId} saved successfully`);
      if (manual) {
        toast('Document saved', 'success');
      }
      return savedDoc;
    } catch (err) {
      console.error(`❌ Save failed for ${docId}:`, err);
      const latestStore = useDocumentStore.getState();
      const draft = latestStore.id === docId ? latestStore : readLocalDraft(docId) || store;
      writeLocalDraft(docId, { ...draft, isDirty: true });
      updateCachedRecentDoc(docId, {
        title,
        content: payloadContent,
        design,
        headerFooter,
        layout,
        pageCount,
        updatedAt: new Date().toISOString(),
      });
      toast(manual ? 'Save failed' : 'Auto-save failed - changes saved locally', 'error');
      return null;
    } finally {
      isSavingRef.current = false;
      if (useDocumentStore.getState().id === docId) setSaving(false);
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        if (mountedRef.current) save({ manual: false });
      }
    }
  }, [toast]);

  // Immediately persist draft locally on every edit
  useEffect(() => {
    if (!id || !isDirty) return;
    const store = useDocumentStore.getState();
    writeLocalDraft(id, store);
  }, [id, isDirty, updatedAt]);

  // Debounced backend auto-save with maxWait throttle
  useEffect(() => {
    if (!autoSaveEnabled || !isDirty || !id) {
      clearTimeout(timer.current);
      firstChangeTime.current = 0;
      return;
    }

    if (!firstChangeTime.current) {
      firstChangeTime.current = Date.now();
    }

    clearTimeout(timer.current);

    const elapsed = Date.now() - firstChangeTime.current;
    if (elapsed >= MAX_WAIT) {
      firstChangeTime.current = 0;
      save({ manual: false });
    } else {
      const remainingMax = MAX_WAIT - elapsed;
      const delay = Math.min(DELAY, remainingMax);
      timer.current = setTimeout(() => {
        firstChangeTime.current = 0;
        save({ manual: false });
      }, delay);
    }

    return () => clearTimeout(timer.current);
  }, [autoSaveEnabled, isDirty, id, updatedAt, save]);

  // Flush pending changes on page reload, tab close, or navigation
  useEffect(() => {
    const handleUnload = (event) => {
      const store = useDocumentStore.getState();
      if (!store || !store.id || !store.isDirty) return;

      // Synchronously write to localStorage (guaranteed to persist on reload)
      writeLocalDraft(store.id, store);
      // Both events fire on a normal exit. Only pagehide publishes the save;
      // beforeunload may also fire when the user cancels navigation.
      if (event.type === 'beforeunload') return;

      // Attempt keepalive fetch so server also receives data before process ends
      try {
        const token = localStorage.getItem('etherx_token');
        const user = getStoredUser();
        const sanitizeHeader = (val = '') => String(val).replace(/[^\x00-\xFF]/g, '');
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${sanitizeHeader(token)}` } : {}),
          'X-EtherX-User-Id': sanitizeHeader(user.id || user.email || 'guest'),
          'X-EtherX-User-Name': sanitizeHeader(user.name || user.email || 'Guest User'),
          'X-EtherX-User-Email': sanitizeHeader(user.email || ''),
        };

        const payload = {
          title: store.title,
          content: store.security?.protected ? '' : stripAutoPageBreaks(store.content),
          contentJson: store.security?.protected ? null : store.contentJson,
          design: store.design,
          headerFooter: store.headerFooter,
          layout: store.layout,
          pageCount: store.pageCount,
          comments: store.comments,
          trackChanges: store.trackChanges,
          security: store.security,
          documentParts: store.documentParts,
          signatures: store.signatures,
          accessPolicy: store.accessPolicy,
          aiProfile: store.aiProfile,
          references: store.references,
          styles: store.styles,
        };

        fetch(`${API_BASE}/documents/${store.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Keepalive might not be allowed in some contexts; local draft is saved
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);

      // SPA navigation unmount
      const store = useDocumentStore.getState();
      if (store && store.id && store.isDirty) {
        writeLocalDraft(store.id, store);
        save({ manual: false }).catch(() => {});
      }
    };
  }, [save]);

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

  // All save commands use one event; keyboard shortcuts have one dispatcher.
  useEffect(() => {
    const onSaveRequest = () => save({ manual: true });
    window.addEventListener('etherx-save-document', onSaveRequest);
    return () => window.removeEventListener('etherx-save-document', onSaveRequest);
  }, [save]);

  return { save };
}
