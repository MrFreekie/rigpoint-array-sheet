// A safety net, not a save. While there are unsaved changes, a copy is kept in this browser
// (IndexedDB) so a crash or an accidental close can be recovered from. It is replaced as the person
// works and removed when they save to a file, start again or decline to restore it.

import { del, get, set } from 'idb-keyval';
import type { Doc } from './doc';
import { openFileText, serialiseDoc } from './array-file-io';

export interface AutosaveRecord {
  /** The document as a saved-file text. */
  text: string;
  /** The name of the file it was opened from, if any. */
  fileName: string | null;
}

export interface AutosaveStore {
  get(): Promise<AutosaveRecord | undefined>;
  set(record: AutosaveRecord): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'rigpoint-array-sheet:autosave';

/** IndexedDB can be missing or refuse to open (private windows, blocked site data): every call is safe to fail. */
export const browserStore: AutosaveStore = {
  async get() {
    try {
      const value: unknown = await get(KEY);
      if (typeof value !== 'object' || value === null) return undefined;
      const r = value as Partial<AutosaveRecord>;
      return typeof r.text === 'string' ? { text: r.text, fileName: typeof r.fileName === 'string' ? r.fileName : null } : undefined;
    } catch {
      return undefined;
    }
  },
  async set(record) {
    try {
      await set(KEY, record);
    } catch {
      // No safety net in this browser; saving to a file still works.
    }
  },
  async clear() {
    try {
      await del(KEY);
    } catch {
      // Nothing to clear.
    }
  },
};

export async function writeAutosave(store: AutosaveStore, doc: Doc, appVersion: string, now: Date = new Date()): Promise<void> {
  await store.set({ text: serialiseDoc(doc, appVersion, now), fileName: doc.fileName });
}

export interface Restorable {
  doc: Doc;
  savedAt: string;
}

/** The kept copy, checked like any opened file. A copy that fails the check is discarded. */
export async function readAutosave(store: AutosaveStore): Promise<Restorable | null> {
  const record = await store.get();
  if (!record) return null;
  try {
    const { doc, savedAt } = openFileText(record.text, record.fileName);
    // A restored copy has not been saved to a file, so it counts as unsaved.
    doc.savedKey = null;
    doc.locked = false;
    return { doc, savedAt };
  } catch {
    await store.clear();
    return null;
  }
}
