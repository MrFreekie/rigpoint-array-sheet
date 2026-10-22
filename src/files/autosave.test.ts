import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { readAutosave, writeAutosave, type AutosaveRecord, type AutosaveStore } from './autosave';
import { newDoc } from './doc';

function memoryStore(): AutosaveStore & { record: AutosaveRecord | undefined } {
  const store = {
    record: undefined as AutosaveRecord | undefined,
    get: async () => store.record,
    set: async (r: AutosaveRecord) => {
      store.record = r;
    },
    clear: async () => {
      store.record = undefined;
    },
  };
  return store;
}

describe('autosave', () => {
  it('gives nothing back when nothing was kept', async () => {
    expect(await readAutosave(memoryStore())).toBeNull();
  });

  it('keeps a copy and offers it back as unsaved work', async () => {
    const store = memoryStore();
    const doc = newDoc(parseFixture('a'), 'a.pdf');
    doc.job.show = 'Main stage';
    doc.offsets[2] = '0.5';
    doc.fileName = 'Main stage.arraysheet.json';
    await writeAutosave(store, doc, '0.1.0', new Date('2026-10-22T09:00:00.000Z'));

    const back = await readAutosave(store);
    expect(back?.savedAt).toBe('2026-10-22T09:00:00.000Z');
    expect(back?.doc.job.show).toBe('Main stage');
    expect(back?.doc.offsets).toEqual({ 2: '0.5' });
    expect(back?.doc.fileName).toBe('Main stage.arraysheet.json');
    expect(back?.doc.savedKey).toBeNull();
  });

  it('replaces the earlier copy as the person keeps working', async () => {
    const store = memoryStore();
    const doc = newDoc(parseFixture('b'), 'b.pdf');
    await writeAutosave(store, doc, '0.1.0');
    doc.job.company = 'Acme';
    await writeAutosave(store, doc, '0.1.0');
    expect((await readAutosave(store))?.doc.job.company).toBe('Acme');
  });

  it('checks a kept copy like any opened file, and throws away one that fails', async () => {
    const store = memoryStore();
    store.record = { text: '{"format":"arraysheet/3","status":"nope"}', fileName: null };
    expect(await readAutosave(store)).toBeNull();
    expect(store.record).toBeUndefined();
  });

  it('can be cleared', async () => {
    const store = memoryStore();
    await writeAutosave(store, newDoc(parseFixture('a'), 'a.pdf'), '0.1.0');
    await store.clear();
    expect(await readAutosave(store)).toBeNull();
  });
});
