// A small key-value store in this browser (IndexedDB through idb-keyval). Every call is safe to fail:
// a private window or blocked site data must never stop the app, only remove the conveniences.

import { del, get, set } from 'idb-keyval';

export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

export const idbStore: KeyValueStore = {
  async get(key) {
    try {
      return (await get(key)) as unknown;
    } catch {
      return undefined;
    }
  },
  async set(key, value) {
    try {
      await set(key, value);
    } catch {
      // Not remembered in this browser.
    }
  },
  async del(key) {
    try {
      await del(key);
    } catch {
      // Nothing to remove.
    }
  },
};
