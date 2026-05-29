/**
 * Storage abstraction layer.
 *
 * IStorage defines the contract that all adapters must implement.
 * - InMemoryStorage: used in tests and local development (no persistence).
 * - Future adapters (e.g. SqliteStorage, PostgresStorage) can be swapped in
 *   by implementing IStorage and injecting via `setStorage()`.
 */

export interface IStorage {
  /** Persist an arbitrary key/value pair. */
  set(key: string, value: unknown): void;
  /** Retrieve a value by key. Returns undefined if not found. */
  get(key: string): unknown;
  /** Delete a key. */
  delete(key: string): void;
  /** Return all keys. */
  keys(): string[];
}

/** In-memory adapter — suitable for tests and local dev. Not persistent across restarts. */
export class InMemoryStorage implements IStorage {
  private store = new Map<string, unknown>();

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  get(key: string): unknown {
    return this.store.get(key);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

// Singleton — swap out in tests or at startup for a different adapter.
let _storage: IStorage = new InMemoryStorage();

export function getStorage(): IStorage {
  return _storage;
}

export function setStorage(adapter: IStorage): void {
  _storage = adapter;
}
