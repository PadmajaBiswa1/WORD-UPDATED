// ═══════════════════════════════════════════════════════════════
//  EtherX Word — IndexedDB Offline Storage & Sync Service
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'EtherXWordOfflineDB';
const DB_VERSION = 1;
const DOCS_STORE = 'documents';
const QUEUE_STORE = 'sync_queue';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'queueId', autoIncrement: true });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDocumentOffline(doc) {
  if (!doc?.id) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([DOCS_STORE], 'readwrite');
      const store = tx.objectStore(DOCS_STORE);
      const item = {
        ...doc,
        id: String(doc.id),
        offlineSavedAt: new Date().toISOString()
      };
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('saveDocumentOffline error:', err);
  }
}

export async function getDocumentOffline(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([DOCS_STORE], 'readonly');
      const store = tx.objectStore(DOCS_STORE);
      const req = store.get(String(id));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('getDocumentOffline error:', err);
    return null;
  }
}

export async function getAllOfflineDocuments() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([DOCS_STORE], 'readonly');
      const store = tx.objectStore(DOCS_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('getAllOfflineDocuments error:', err);
    return [];
  }
}

export async function enqueueOfflineMutation(mutation) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([QUEUE_STORE], 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const entry = {
        ...mutation,
        enqueuedAt: new Date().toISOString()
      };
      const req = store.add(entry);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('enqueueOfflineMutation error:', err);
  }
}

export async function getOfflineQueue() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([QUEUE_STORE], 'readonly');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('getOfflineQueue error:', err);
    return [];
  }
}

export async function dequeueOfflineMutation(queueId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([QUEUE_STORE], 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.delete(queueId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('dequeueOfflineMutation error:', err);
  }
}

export async function clearOfflineQueue() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([QUEUE_STORE], 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('clearOfflineQueue error:', err);
  }
}
