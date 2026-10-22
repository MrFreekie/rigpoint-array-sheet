import { describe, expect, it } from 'vitest';
import { firstLaunchedFile } from './launch';

const h = (kind: 'file' | 'directory', name: string) => ({ kind, name }) as unknown as FileSystemHandle;

describe('firstLaunchedFile', () => {
  it('takes the first file', () => {
    expect(firstLaunchedFile({ files: [h('file', 'a.json'), h('file', 'b.json')] })).toMatchObject({ name: 'a.json' });
  });

  it('ignores a launch with no files, or a folder', () => {
    expect(firstLaunchedFile({ files: [] })).toBeNull();
    expect(firstLaunchedFile({ files: [h('directory', 'x')] })).toBeNull();
  });
});
