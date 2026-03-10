const LS_KEY = "costar-device-id";
const IDB_NAME = "costar-device";
const IDB_STORE = "meta";
const IDB_KEY = "deviceId";

const generateId = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

const openIDB = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

const readIDB = async (): Promise<string | null> => {
  const db = await openIDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as string) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

const writeIDB = async (id: string): Promise<void> => {
  const db = await openIDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put(id, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

let cached: string | null = null;

export const getDeviceFingerprint = async (): Promise<string> => {
  if (cached) return cached;

  try {
    const lsVal = localStorage.getItem(LS_KEY);
    if (lsVal) {
      cached = lsVal;
      writeIDB(lsVal);
      return lsVal;
    }
  } catch {}

  const idbVal = await readIDB();
  if (idbVal) {
    cached = idbVal;
    try { localStorage.setItem(LS_KEY, idbVal); } catch {}
    return idbVal;
  }

  const newId = generateId();
  cached = newId;
  try { localStorage.setItem(LS_KEY, newId); } catch {}
  writeIDB(newId);
  return newId;
};
