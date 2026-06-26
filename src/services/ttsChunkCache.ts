const DB_NAME = 'rtm-tts-chunk-cache';
const STORE_NAME = 'chunks';
const DB_VERSION = 1;
const MAX_CACHE_BYTES = 500 * 1024 * 1024; // 500 MB

interface CacheEntry {
  key: string;
  blob: Blob;
  size: number;
  textLength: number;
  lastAccessed: number;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('lastAccessed', 'lastAccessed');
      }
    };
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllEntries(): Promise<CacheEntry[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  return idbRequest(tx.objectStore(STORE_NAME).getAll());
}

async function getTotalSize(): Promise<number> {
  const entries = await getAllEntries();
  return entries.reduce((sum, e) => sum + (e.size ?? 0), 0);
}

async function evictIfNeeded(incomingSize: number): Promise<void> {
  let total = await getTotalSize();
  if (total + incomingSize <= MAX_CACHE_BYTES) return;

  const entries = await getAllEntries();
  entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

  const toDelete: string[] = [];
  for (const entry of entries) {
    if (total + incomingSize <= MAX_CACHE_BYTES) break;
    toDelete.push(entry.key);
    total -= entry.size;
  }

  if (toDelete.length === 0) return;

  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const key of toDelete) {
    store.delete(key);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const ttsChunkCache = {
  get: async (key: string): Promise<Blob | null> => {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry = await idbRequest<CacheEntry | undefined>(store.get(key));
    if (!entry) return null;

    entry.lastAccessed = Date.now();
    store.put(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return entry.blob;
  },

  put: async (key: string, blob: Blob, textLength: number): Promise<void> => {
    const size = blob.size;
    await evictIfNeeded(size);

    const now = Date.now();
    const entry: CacheEntry = {
      key,
      blob,
      size,
      textLength,
      lastAccessed: now,
      createdAt: now,
    };

    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  clear: async (): Promise<void> => {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
