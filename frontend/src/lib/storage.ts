import type { BatchHistory, ExtractionCacheEntry } from "@/types/roster";

const DB_NAME = "autoplot-lab";
const DB_VERSION = 1;
const HISTORY_STORE = "histories";
const CACHE_STORE = "extraction-cache";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: "hash" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeRequest<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function listHistories(): Promise<BatchHistory[]> {
  const result = await storeRequest<BatchHistory[]>(HISTORY_STORE, "readonly", (store) => store.getAll());
  return result.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export const getHistory = (id: string) => storeRequest<BatchHistory | undefined>(HISTORY_STORE, "readonly", (store) => store.get(id));
export const putHistory = (history: BatchHistory) => storeRequest<IDBValidKey>(HISTORY_STORE, "readwrite", (store) => store.put(history));
export const deleteHistory = (id: string) => storeRequest<undefined>(HISTORY_STORE, "readwrite", (store) => store.delete(id));
export const clearHistories = () => storeRequest<undefined>(HISTORY_STORE, "readwrite", (store) => store.clear());
export const getExtractionCache = (hash: string) => storeRequest<ExtractionCacheEntry | undefined>(CACHE_STORE, "readonly", (store) => store.get(hash));
export const putExtractionCache = (entry: ExtractionCacheEntry) => storeRequest<IDBValidKey>(CACHE_STORE, "readwrite", (store) => store.put(entry));

export async function clearAllLocalData(): Promise<void> {
  await Promise.all([
    storeRequest<undefined>(HISTORY_STORE, "readwrite", (store) => store.clear()),
    storeRequest<undefined>(CACHE_STORE, "readwrite", (store) => store.clear()),
  ]);
}

export async function fileHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function storageUsage(): Promise<{ usage: number; quota: number; ratio: number }> {
  const estimate = await navigator.storage?.estimate?.();
  const usage = estimate?.usage ?? 0;
  const quota = estimate?.quota ?? 0;
  return { usage, quota, ratio: quota ? usage / quota : 0 };
}