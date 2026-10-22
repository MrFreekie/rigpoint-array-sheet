import { describe, expect, it } from 'vitest';
import { saveText, type Access, type SaveRequest } from './save-flow';

interface Log {
  picks: string[];
  permissions: string[];
  writes: { name: string; text: string }[];
  downloads: { name: string; text: string }[];
}

function handle(name: string) {
  return { name } as unknown as FileSystemFileHandle;
}

function fake(opts: { supported?: boolean; pick?: FileSystemFileHandle | null; allow?: boolean } = {}): { access: Access; log: Log } {
  const log: Log = { picks: [], permissions: [], writes: [], downloads: [] };
  const access: Access = {
    supported: () => opts.supported ?? true,
    pickSave: async (name) => {
      log.picks.push(name);
      return opts.pick === undefined ? handle(name) : opts.pick;
    },
    ensurePermission: async (h, mode) => {
      log.permissions.push(`${h.name}:${mode}`);
      return opts.allow ?? true;
    },
    write: async (h, text) => {
      log.writes.push({ name: h.name, text });
    },
    download: (name, text) => {
      log.downloads.push({ name, text });
    },
  };
  return { access, log };
}

const request = (over: Partial<SaveRequest> = {}): SaveRequest => ({
  text: '{"x":1}',
  suggestedName: 'Main stage.arraysheet.json',
  handle: null,
  asNew: false,
  ...over,
});

describe('saveText', () => {
  it('downloads where the browser cannot save in place', async () => {
    const { access, log } = fake({ supported: false });
    expect(await saveText(request(), access)).toEqual({ kind: 'download', name: 'Main stage.arraysheet.json' });
    expect(log.downloads).toEqual([{ name: 'Main stage.arraysheet.json', text: '{"x":1}' }]);
    expect(log.picks).toEqual([]);
  });

  it('also downloads for Save As where in-place saving is missing', async () => {
    const { access, log } = fake({ supported: false });
    expect((await saveText(request({ asNew: true, handle: handle('old.json') }), access)).kind).toBe('download');
    expect(log.writes).toEqual([]);
  });

  it('asks where to save the first time, then writes there', async () => {
    const { access, log } = fake();
    const outcome = await saveText(request(), access);
    expect(outcome).toMatchObject({ kind: 'handle', name: 'Main stage.arraysheet.json' });
    expect(log.picks).toEqual(['Main stage.arraysheet.json']);
    expect(log.permissions).toEqual(['Main stage.arraysheet.json:readwrite']);
    expect(log.writes).toEqual([{ name: 'Main stage.arraysheet.json', text: '{"x":1}' }]);
  });

  it('saves in place without asking when it has a handle', async () => {
    const { access, log } = fake();
    const outcome = await saveText(request({ handle: handle('Chosen name.json') }), access);
    expect(outcome).toMatchObject({ kind: 'handle', name: 'Chosen name.json' });
    expect(log.picks).toEqual([]);
    expect(log.writes).toEqual([{ name: 'Chosen name.json', text: '{"x":1}' }]);
  });

  it('Save As asks where even when it has a handle, and never touches the old file', async () => {
    const { access, log } = fake();
    const outcome = await saveText(request({ handle: handle('old.json'), asNew: true }), access);
    expect(outcome).toMatchObject({ kind: 'handle', name: 'Main stage.arraysheet.json' });
    expect(log.writes.map((w) => w.name)).toEqual(['Main stage.arraysheet.json']);
    expect(log.permissions.some((p) => p.startsWith('old.json'))).toBe(false);
  });

  it('writes nothing when the person cancels the picker', async () => {
    const { access, log } = fake({ pick: null });
    expect(await saveText(request(), access)).toEqual({ kind: 'cancelled' });
    expect(log.writes).toEqual([]);
    expect(log.permissions).toEqual([]);
  });

  it('writes nothing when the browser refuses permission, and says which file', async () => {
    const { access, log } = fake({ allow: false });
    expect(await saveText(request({ handle: handle('locked.json') }), access)).toEqual({ kind: 'denied', name: 'locked.json' });
    expect(log.writes).toEqual([]);
  });

  it('lets a failed write surface, so nothing is reported as saved', async () => {
    const { access } = fake();
    access.write = async () => {
      throw new Error('disk full');
    };
    await expect(saveText(request({ handle: handle('a.json') }), access)).rejects.toThrow('disk full');
  });
});
