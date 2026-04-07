// IndexedDB cache for tile image blobs
// Keyed by gridFsId — each entry stores { gridFsId, blob, x, z }

const DB_NAME    = "mc-map-tiles";
const DB_VERSION = 1;
const STORE      = "tiles";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "gridFsId" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function getCachedTile(gridFsId) {
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(gridFsId);
    req.onsuccess = (e) => resolve(e.target.result ?? null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function setCachedTile(gridFsId, blob, x, z) {
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put({ gridFsId, blob, x, z });
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function deleteCachedTile(gridFsId) {
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(gridFsId);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

// Find a cached entry by x,z (used to evict old tile when replacing)
export async function getCachedTileByCoords(x, z) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(STORE, "readonly");
    const store   = tx.objectStore(STORE);
    const results = [];
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { resolve(results.find(r => r.x === x && r.z === z) ?? null); return; }
      results.push(cursor.value);
      cursor.continue();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}