// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Local Draft Storage & Recovery Utilities
// ═══════════════════════════════════════════════════════════════

export const DRAFT_STORAGE_PREFIX = 'etherx_doc_draft_';
export const BACKUP_STORAGE_PREFIX = 'etherx_doc_backup_';

export function getDraftStorageKey(id) {
  return `${DRAFT_STORAGE_PREFIX}${id}`;
}

/**
 * Persists a full document draft to localStorage synchronously.
 * Guarantees immediate persistence across page refreshes and unloads.
 */
export function writeLocalDraft(id, data = {}) {
  if (!id || typeof window === 'undefined' || !window.localStorage) return;
  try {
    const draft = {
      id,
      title: data.title,
      content: data.content,
      contentJson: data.contentJson,
      design: data.design,
      headerFooter: data.headerFooter,
      styles: data.styles,
      references: data.references,
      security: data.security,
      updatedAt: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date().toISOString(),
      isDirty: Boolean(data.isDirty),
    };
    window.localStorage.setItem(getDraftStorageKey(id), JSON.stringify(draft));
  } catch (err) {
    if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
      try {
        // Clean up old drafts for other documents to free space
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const k = window.localStorage.key(i);
          if (k && (k.startsWith(DRAFT_STORAGE_PREFIX) || k.startsWith(BACKUP_STORAGE_PREFIX)) && k !== getDraftStorageKey(id)) {
            window.localStorage.removeItem(k);
          }
        }
        window.localStorage.setItem(getDraftStorageKey(id), JSON.stringify(draft));
      } catch (e) {
        console.warn('Quota exceeded while saving draft to localStorage:', e);
      }
    } else {
      console.warn('Could not write local draft to localStorage:', err);
    }
  }
}

/**
 * Reads any existing draft or backup from localStorage.
 */
export function readLocalDraft(id) {
  if (!id || typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(id))
      || window.localStorage.getItem(`${BACKUP_STORAGE_PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Removes local draft and backup entries for a document.
 */
export function clearLocalDraft(id) {
  if (!id || typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(getDraftStorageKey(id));
    window.localStorage.removeItem(`${BACKUP_STORAGE_PREFIX}${id}`);
  } catch {
    // ignore storage removal errors
  }
}
