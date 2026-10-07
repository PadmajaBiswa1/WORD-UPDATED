import { getStoredUser } from '@/services/api';

const CACHED_RECENT_DOCS_KEY = 'etherx_cached_recent_docs';

export function getCachedRecentDocsKey() {
  const user = getStoredUser();
  const scope = user?.id || user?.email || 'guest';
  return `${CACHED_RECENT_DOCS_KEY}:${String(scope).toLowerCase()}`;
}

/**
 * Reads cached recent documents from localStorage synchronously.
 * Returns an array of normalized document objects.
 */
export function readCachedRecentDocs() {
  try {
    const raw = localStorage.getItem(getCachedRecentDocsKey());
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((d) => ({
      id: String(d.id),
      title: d.title || 'Untitled Document',
      updatedAt: d.updatedAt || new Date().toISOString(),
      content: d.content || '',
      design: d.design,
      headerFooter: d.headerFooter,
      comments: Array.isArray(d.comments) ? d.comments : [],
      trackChanges: Boolean(d.trackChanges),
      localOnly: Boolean(d.localOnly),
    }));
  } catch (e) {
    console.warn('Failed to read cached recent docs:', e);
    return [];
  }
}

/**
 * Persists recent documents to localStorage for instant startup display.
 * Limits content size and keeps up to 50 items.
 */
export function writeCachedRecentDocs(list) {
  try {
    if (!Array.isArray(list)) return;
    const trimmed = list.slice(0, 50).map((d) => {
      // Keep lightweight snippet if content is extremely large
      let safeContent = d.content || '';
      if (typeof safeContent === 'string' && safeContent.length > 50000) {
        // Strip base64 images if present to conserve localStorage quota
        safeContent = safeContent.replace(/src="data:image\/[^;]+;base64,[^"]+"/gi, 'src=""');
        if (safeContent.length > 50000) {
          safeContent = safeContent.slice(0, 50000);
        }
      }
      return {
        id: String(d.id),
        title: d.title || 'Untitled Document',
        updatedAt: d.updatedAt || new Date().toISOString(),
        content: safeContent,
        design: d.design,
        headerFooter: d.headerFooter,
        comments: Array.isArray(d.comments) ? d.comments : [],
        trackChanges: Boolean(d.trackChanges),
        localOnly: Boolean(d.localOnly),
      };
    });
    localStorage.setItem(getCachedRecentDocsKey(), JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Failed to write cached recent docs:', e);
  }
}

/**
 * Updates or inserts a single document in the recent documents cache.
 */
export function updateCachedRecentDoc(docId, patch = {}) {
  try {
    if (!docId) return;
    const list = readCachedRecentDocs();
    const existingIndex = list.findIndex((d) => String(d.id) === String(docId));
    let updated;
    if (existingIndex >= 0) {
      const current = list[existingIndex];
      const merged = {
        ...current,
        ...patch,
        id: String(docId),
        updatedAt: patch.updatedAt || new Date().toISOString(),
      };
      // Place most recently edited document at top
      updated = [merged, ...list.filter((d) => String(d.id) !== String(docId))];
    } else {
      const newEntry = {
        id: String(docId),
        title: patch.title || 'Untitled Document',
        updatedAt: patch.updatedAt || new Date().toISOString(),
        content: patch.content || '',
        design: patch.design,
        headerFooter: patch.headerFooter,
        comments: Array.isArray(patch.comments) ? patch.comments : [],
        trackChanges: Boolean(patch.trackChanges),
        localOnly: Boolean(patch.localOnly),
      };
      updated = [newEntry, ...list];
    }
    writeCachedRecentDocs(updated);
  } catch (e) {
    console.warn('Failed to update cached recent doc:', e);
  }
}

/**
 * Removes a document from the recent documents cache.
 */
export function removeCachedRecentDoc(docId) {
  try {
    if (!docId) return;
    const list = readCachedRecentDocs();
    const next = list.filter((d) => String(d.id) !== String(docId));
    writeCachedRecentDocs(next);
  } catch (e) {
    console.warn('Failed to remove cached recent doc:', e);
  }
}
