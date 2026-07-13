/**
 * Pluggable offline store — IndexedDB in browser, memory in tests.
 */

export type StoreName =
  | "packages"
  | "operations"
  | "sessions"
  | "conflicts"
  | "attachments"
  | "audit"
  | "meta"
  | "printers"
  | "partsCatalog";

export interface OfflineStore {
  get<T>(store: StoreName, key: string): Promise<T | null>;
  put<T extends { id: string }>(store: StoreName, value: T): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  getAll<T>(store: StoreName): Promise<T[]>;
  clear(store: StoreName): Promise<void>;
  clearAll(): Promise<void>;
  estimateBytes(): Promise<number>;
}

const STORE_NAMES: StoreName[] = [
  "packages",
  "operations",
  "sessions",
  "conflicts",
  "attachments",
  "audit",
  "meta",
  "printers",
  "partsCatalog",
];

/** In-memory store for Node tests and SSR-safe fallbacks. */
export class MemoryOfflineStore implements OfflineStore {
  private maps = new Map<StoreName, Map<string, unknown>>();

  constructor() {
    for (const name of STORE_NAMES) this.maps.set(name, new Map());
  }

  async get<T>(store: StoreName, key: string): Promise<T | null> {
    return (this.maps.get(store)?.get(key) as T | undefined) ?? null;
  }

  async put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
    this.maps.get(store)!.set(value.id, structuredClone(value));
  }

  async delete(store: StoreName, key: string): Promise<void> {
    this.maps.get(store)!.delete(key);
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    return [...this.maps.get(store)!.values()].map((v) => structuredClone(v) as T);
  }

  async clear(store: StoreName): Promise<void> {
    this.maps.get(store)!.clear();
  }

  async clearAll(): Promise<void> {
    for (const name of STORE_NAMES) this.maps.get(name)!.clear();
  }

  async estimateBytes(): Promise<number> {
    let total = 0;
    for (const name of STORE_NAMES) {
      total += JSON.stringify([...this.maps.get(name)!.values()]).length;
    }
    return total;
  }
}

const DB_NAME = "matrix-field-offline-v1";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

/** Browser IndexedDB-backed store. */
export class IndexedDbOfflineStore implements OfflineStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }

  async get<T>(store: StoreName, key: string): Promise<T | null> {
    const db = await this.db();
    const tx = db.transaction(store, "readonly");
    const result = await idbReq(tx.objectStore(store).get(key));
    return (result as T | undefined) ?? null;
  }

  async put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(store, "readwrite");
    await idbReq(tx.objectStore(store).put(structuredClone(value)));
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(store, "readwrite");
    await idbReq(tx.objectStore(store).delete(key));
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    const db = await this.db();
    const tx = db.transaction(store, "readonly");
    const result = await idbReq(tx.objectStore(store).getAll());
    return result as T[];
  }

  async clear(store: StoreName): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(store, "readwrite");
    await idbReq(tx.objectStore(store).clear());
  }

  async clearAll(): Promise<void> {
    for (const name of STORE_NAMES) await this.clear(name);
  }

  async estimateBytes(): Promise<number> {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return est.usage ?? 0;
    }
    let total = 0;
    for (const name of STORE_NAMES) {
      const rows = await this.getAll(name);
      total += JSON.stringify(rows).length;
    }
    return total;
  }
}

let sharedStore: OfflineStore | null = null;
let testStore: OfflineStore | null = null;

export function getOfflineStore(): OfflineStore {
  if (testStore) return testStore;
  if (sharedStore) return sharedStore;
  if (typeof indexedDB !== "undefined") {
    sharedStore = new IndexedDbOfflineStore();
  } else {
    sharedStore = new MemoryOfflineStore();
  }
  return sharedStore;
}

/** Test helper — inject memory store and reset. */
export function useMemoryOfflineStoreForTests(store?: MemoryOfflineStore): MemoryOfflineStore {
  const mem = store ?? new MemoryOfflineStore();
  testStore = mem;
  return mem;
}

export function resetOfflineStoreForTests(): void {
  testStore = null;
  sharedStore = null;
}

export function newOperationId(): string {
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newEntityId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
