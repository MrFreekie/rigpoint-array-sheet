import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from './kv';
import { addRecent, listRecent, MAX_RECENT, removeRecent, type SameFile } from './recent';

function memory(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (k) => data.get(k),
    set: async (k, v) => void data.set(k, v),
    del: async (k) => void data.delete(k),
  };
}

type H = { name: string; id: string };
const same: SameFile<H> = async (a, b) => a.id === b.id;
const file = (id: string, name = `${id}.arraysheet.json`): H => ({ id, name });

describe('recent files', () => {
  it('starts empty, and ignores damaged data', async () => {
    const store = memory();
    expect(await listRecent(store)).toEqual([]);
    store.data.set('rigpoint-array-sheet:recent-files', 'nonsense');
    expect(await listRecent(store)).toEqual([]);
    store.data.set('rigpoint-array-sheet:recent-files', [{ name: 1 }, null, 5, { name: 'ok', usedAt: 1, handle: {} }]);
    expect((await listRecent(store)).map((r) => r.name)).toEqual(['ok']);
  });

  it('puts the newest first', async () => {
    const store = memory();
    await addRecent(store, file('a'), same, 1);
    await addRecent(store, file('b'), same, 2);
    expect((await listRecent<H>(store)).map((r) => r.name)).toEqual(['b.arraysheet.json', 'a.arraysheet.json']);
  });

  it('moves a file already in the list to the top instead of listing it twice', async () => {
    const store = memory();
    await addRecent(store, file('a'), same, 1);
    await addRecent(store, file('b'), same, 2);
    const list = await addRecent(store, file('a', 'a renamed.json'), same, 3);
    expect(list.map((r) => [r.name, r.usedAt])).toEqual([['a renamed.json', 3], ['b.arraysheet.json', 2]]);
  });

  it('keeps only the most recent few', async () => {
    const store = memory();
    for (let i = 0; i < MAX_RECENT + 5; i++) await addRecent(store, file(String(i)), same, i);
    const list = await listRecent<H>(store);
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]?.name).toBe(`${MAX_RECENT + 4}.arraysheet.json`);
  });

  it('removes one file and leaves the rest', async () => {
    const store = memory();
    await addRecent(store, file('a'), same, 1);
    await addRecent(store, file('b'), same, 2);
    const list = await removeRecent(store, file('a'), same);
    expect(list.map((r) => r.name)).toEqual(['b.arraysheet.json']);
    expect((await listRecent<H>(store)).map((r) => r.name)).toEqual(['b.arraysheet.json']);
  });

  it('treats a handle that cannot be compared as a different file', async () => {
    const store = memory();
    const broken: SameFile<H> = async () => {
      throw new Error('gone');
    };
    await addRecent(store, file('a'), broken, 1);
    expect(await addRecent(store, file('a'), broken, 2)).toHaveLength(2);
  });
});
