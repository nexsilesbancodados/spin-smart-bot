import type { PersistStorage, StorageValue } from "zustand/middleware";

const DB_NAME = "rv-store-db";
const STORE_NAME = "kv";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const idbGet = async (key: string): Promise<unknown> => {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
};

const idbSet = async (key: string, value: unknown): Promise<void> => {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
};

const idbDel = async (key: string): Promise<void> => {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
};

export const createIdbStorage = <T,>(): PersistStorage<T> => ({
  getItem: async (name: string): Promise<StorageValue<T> | null> => {
    const v = await idbGet(name);
    if (v === undefined || v === null) {
      const ls = typeof localStorage !== "undefined" ? localStorage.getItem(name) : null;
      if (ls) {
        try {
          const parsed = JSON.parse(ls) as StorageValue<T>;
          await idbSet(name, parsed);
          return parsed;
        } catch {
          return null;
        }
      }
      return null;
    }
    return v as StorageValue<T>;
  },
  setItem: async (name: string, value: StorageValue<T>): Promise<void> => {
    await idbSet(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await idbDel(name);
  },
});
