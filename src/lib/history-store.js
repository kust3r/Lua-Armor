import { normalizeToggles } from "./obfuscator/normalize-toggles";
const DB_NAME = "lurapy_history";
const STORE = "jobs";
const changed = () => {
  window.dispatchEvent(new Event("lurapy-history"));
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel("lurapy-history");
    channel.postMessage("changed");
    channel.close();
  }
};
function subscribeHistory(listener) {
  window.addEventListener("lurapy-history", listener);
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("lurapy-history") : void 0;
  if (channel) channel.onmessage = listener;
  return () => {
    window.removeEventListener("lurapy-history", listener);
    channel?.close();
  };
}
function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      const store = db.objectStoreNames.contains(STORE) ? req.transaction?.objectStore(STORE) : db.createObjectStore(STORE, { keyPath: "id" });
      if (store && !store.indexNames.contains("order")) store.createIndex("order", ["createdAt", "id"]);
    };
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(new Error("History storage did not respond."));
    }, 5e3);
    req.onsuccess = () => {
      clearTimeout(timer);
      if (expired) req.result.close();
      else resolve(req.result);
    };
    req.onerror = () => {
      clearTimeout(timer);
      reject(req.error);
    };
    req.onblocked = () => {
      clearTimeout(timer);
      reject(new Error("History is busy in another tab. Close older tabs and retry."));
    };
  });
}
async function write(action) {
  const db = await open();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    try {
      action(tx.objectStore(STORE));
    } catch (e) {
      db.close();
      reject(e);
      return;
    }
    const timer = setTimeout(() => {
      try {
        tx.abort();
      } catch {
      }
      db.close();
      reject(new Error("History storage timed out."));
    }, 5e3);
    tx.oncomplete = () => {
      clearTimeout(timer);
      db.close();
      changed();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      clearTimeout(timer);
      db.close();
      reject(tx.error ?? new Error("History storage failed"));
    };
  });
}
const saveJob = (entry) => write((store) => {
  store.put({ ...entry, ...entry.toggles ? { toggles: normalizeToggles(entry.toggles) } : {}, ...entry.generation ? { generation: { ...entry.generation, toggles: normalizeToggles(entry.generation.toggles) } } : {} });
});
const deleteJob = (id) => write((store) => {
  store.delete(id);
});
const clearAll = () => write((store) => {
  const req = store.openCursor();
  req.onsuccess = () => {
    const c = req.result;
    if (!c) return;
    if (c.value.status !== "running") c.delete();
    c.continue();
  };
});
async function getJobs(limit, offset) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const items = [];
    let skipped = 0;
    let hasMore = false;
    const req = tx.objectStore(STORE).index("order").openCursor(null, "prev");
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if (skipped++ < offset) {
        cursor.continue();
        return;
      }
      if (items.length === limit) {
        hasMore = true;
        return;
      }
      items.push(cursor.value);
      cursor.continue();
    };
    tx.oncomplete = () => {
      db.close();
      resolve({ items, hasMore });
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
async function getJobById(id) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
const reconcileInterrupted = () => write((store) => {
  const req = store.openCursor();
  req.onsuccess = () => {
    const c = req.result;
    if (!c) return;
    if (c.value.status === "running") c.update({ ...c.value, toggles: normalizeToggles(c.value.toggles), ...c.value.generation ? { generation: { ...c.value.generation, toggles: normalizeToggles(c.value.generation.toggles) } } : {}, status: "interrupted", finishedAt: Date.now(), error: "The page closed before generation finished." });
    c.continue();
  };
});
const GENERATION_LOCK = "lurapy-generation";
export {
  GENERATION_LOCK,
  clearAll,
  deleteJob,
  getJobById,
  getJobs,
  reconcileInterrupted,
  saveJob,
  subscribeHistory
};
