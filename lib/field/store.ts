/**
 * Pluggable offline store — IndexedDB in browser, memory in tests.
 *
 * Field screens set a scope from the signed-in Clerk user before mounting.
 * The old unscoped database is intentionally left untouched for review.
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

const LEGACY_DB_NAME = "matrix-field-offline-v1";
const DB_VERSION = 1;
let activeScope: string | null = null;
let testStore: OfflineStore | null = null;
const browserStores = new Map<string, OfflineStore>();
const memoryStores = new Map<string, OfflineStore>();

function scopeKey(userId: string | null): string {
  return userId ? `user:${userId}` : "legacy";
}

function dbName(userId: string | null): string {
  return userId
    ? `matrix-field-offline-v2-${encodeURIComponent(userId)}`
    : LEGACY_DB_NAME;
}

/** Select storage for the active signed-in Field user. Does not migrate or erase legacy data. */
export function setOfflineStoreScope(userId: string): void {
  if (!userId.trim()) {
    throw new Error(
      "An authenticated Field user ID is required for offline storage.",
    );
  }
  activeScope = userId;
}

export function clearOfflineStoreScope(): void {
  activeScope = null;
}

function deleteBrowserDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("IndexedDB delete failed"));
    request.onblocked = () => reject(new Error("Close other Matrix tabs and try again."));
  });
}

/**
 * The v1 store was shared by every user and has no trustworthy owner record.
 * It must be retired explicitly, never copied into a signed-in user's cache.
 */
export async function retireLegacyOfflineStore(): Promise<void> {
  const legacyKey = scopeKey(null);
  const existing = browserStores.get(legacyKey);
  if (existing instanceof IndexedDbOfflineStore) await existing.close();
  browserStores.delete(legacyKey);
  memoryStores.delete(legacyKey);

  if (typeof indexedDB !== "undefined") {
    await deleteBrowserDatabase(LEGACY_DB_NAME);
  }
}

/**
 * Clear the signed-in user's Field data before sign-out. This protects a
 * shared device from exposing cached packages, photos, and queued actions.
 */
export async function revokeOfflineStoreForUser(userId: string): Promise<void> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return;
  const key = scopeKey(normalizedUserId);

  if (testStore) {
    await testStore.clearAll();
  } else if (typeof indexedDB !== "undefined") {
    const existing = browserStores.get(key);
    if (existing instanceof IndexedDbOfflineStore) {
      await existing.clearAll();
      await existing.close();
    }
    browserStores.delete(key);
  } else {
    const existing = memoryStores.get(key);
    if (existing) await existing.clearAll();
    memoryStores.delete(key);
  }

  if (activeScope === normalizedUserId) clearOfflineStoreScope();
}

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const storeName of STORE_NAMES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: "id" });
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

  constructor(private readonly name: string) {}

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb(this.name);
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

  async close(): Promise<void> {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    db.close();
  }
}

export function getOfflineStore(): OfflineStore {
  if (testStore) return testStore;
  const key = scopeKey(activeScope);
  if (typeof indexedDB !== "undefined") {
    let store = browserStores.get(key);
    if (!store) {
      store = new IndexedDbOfflineStore(dbName(activeScope));
      browserStores.set(key, store);
    }
    return store;
  }
  let store = memoryStores.get(key);
  if (!store) {
    store = new MemoryOfflineStore();
    memoryStores.set(key, store);
  }
  return store;
}

/** Test helper — inject memory store and reset. */
export function useMemoryOfflineStoreForTests(store?: MemoryOfflineStore): MemoryOfflineStore {
  const mem = store ?? new MemoryOfflineStore();
  testStore = mem;
  return mem;
}

export function resetOfflineStoreForTests(): void {
  testStore = null;
  activeScope = null;
  browserStores.clear();
  memoryStores.clear();
}

export function newOperationId(): string {
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newEntityId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
