const DB_NAME = 'rtm-offline-audio';
const STORE_NAME = 'chapters';
const DB_VERSION = 1;

export interface OfflineAudioKeyParts {
  bookId: string;
  chapterNumber: number;
  provider: string;
  voice: string;
  rate: number;
}

export interface OfflineChapterRecord {
  key: string;
  bookId: string;
  bookTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  provider: string;
  voice: string;
  rate: number;
  blob: Blob;
  size: number;
  createdAt: number;
}

export function buildOfflineAudioKey(parts: OfflineAudioKeyParts): string {
  const { bookId, chapterNumber, provider, voice, rate } = parts;
  return `${bookId}|${chapterNumber}|${provider}|${voice}|${rate.toFixed(2)}`;
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
        store.createIndex('bookId', 'bookId');
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

export const offlineAudioLibrary = {
  get: async (key: string): Promise<OfflineChapterRecord | null> => {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const record = await idbRequest<OfflineChapterRecord | undefined>(
      tx.objectStore(STORE_NAME).get(key),
    );
    return record ?? null;
  },

  /** Load chapter MP3 blobs in order from IndexedDB (source of truth for export). */
  getBlobsInRange: async (
    parts: OfflineAudioKeyParts & { startChapter: number; endChapter: number },
  ): Promise<Blob[]> => {
    const { bookId, startChapter, endChapter, provider, voice, rate } = parts;
    const blobs: Blob[] = [];

    for (let chapterNumber = startChapter; chapterNumber <= endChapter; chapterNumber++) {
      const key = buildOfflineAudioKey({
        bookId,
        chapterNumber,
        provider,
        voice,
        rate,
      });
      const record = await offlineAudioLibrary.get(key);
      if (!record?.blob) {
        throw new Error(`Missing cached audio for chapter ${chapterNumber}`);
      }
      blobs.push(record.blob);
    }

    return blobs;
  },

  put: async (record: OfflineChapterRecord): Promise<void> => {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  clearBook: async (bookId: string): Promise<void> => {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const all = await idbRequest<OfflineChapterRecord[]>(store.getAll());
    for (const record of all) {
      if (record.bookId === bookId) {
        store.delete(record.key);
      }
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
