// The pickup to max depth typed for an array, in the document and in the saved file.

import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { openFileText, serialiseDoc } from './array-file-io';
import { depthOf, editKey, newDoc, updatedDoc, withDepth, type Doc } from './doc';
import { FileError } from './migrations';

const NOW = new Date('2026-10-28T12:00:00Z');
const a = (): Doc => newDoc(parseFixture('a'), 'a.pdf');
const indexOf = (doc: Doc, name: string) => doc.result.report.sources.findIndex((s) => s.name === name);
const roundTrip = (doc: Doc): Doc => openFileText(serialiseDoc(doc, '0.1.0', NOW), 'x.arraysheet.json').doc;
const edited = (doc: Doc, change: (f: Record<string, unknown>) => void): string => {
  const f = JSON.parse(serialiseDoc(doc, '0.1.0', NOW)) as Record<string, unknown>;
  change(f);
  return JSON.stringify(f);
};

describe('the pickup to max depth in the document', () => {
  it('starts blank, is typed per array and forgotten when blank again', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    expect(depthOf(doc, i)).toBe('');
    const typed = withDepth(doc, i, '1.25');
    expect(depthOf(typed, i)).toBe('1.25');
    expect(withDepth(typed, i, '').depths).toEqual({});
  });

  it('cannot be changed on an approved or superseded file, and makes the file count as edited', () => {
    const doc = a();
    expect(withDepth({ ...doc, locked: true }, 0, '1')).toEqual({ ...doc, locked: true });
    expect(editKey(withDepth(doc, 0, '1'))).not.toBe(editKey(doc));
    expect(editKey(withDepth(withDepth(doc, 0, '1'), 0, ''))).toBe(editKey(doc));
  });

  it('stays with the array of the same name on Update from PDF', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    const next = updatedDoc(withDepth(doc, i, '2'), parseFixture('a'), 'a2.pdf');
    expect(depthOf(next, i)).toBe('2');
  });
});

describe('the pickup to max depth in a saved file', () => {
  it('is saved as one text for each array, written plainly, and opens again as it was', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    const saved = JSON.parse(serialiseDoc(withDepth(doc, i, '1,50'), '0.1.0', NOW));
    expect(saved.max_depth_m).toHaveLength(doc.result.report.sources.length);
    expect(saved.max_depth_m[i]).toBe('1.5');
    expect(roundTrip(withDepth(doc, i, '1,50')).depths).toEqual({ [i]: '1.5' });
  });

  it('refuses a depth that is not a depth, and a wrong number of them', () => {
    for (const bad of ['abc', '0', '-1', '20.5', '1.234']) {
      expect(() => openFileText(edited(a(), (f) => ((f['max_depth_m'] as string[])[0] = bad)), 'x.json'), bad).toThrow(FileError);
    }
    expect(() => openFileText(edited(a(), (f) => (f['max_depth_m'] as unknown[]).pop()), 'x.json')).toThrow(/one pickup to max depth for each array/);
  });

  it('is kept on a read-only file', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    const approved = openFileText(edited(withDepth(doc, i, '2'), (f) => (f['status'] = 'approved')), 'x.json').doc;
    expect(approved.locked).toBe(true);
    expect(depthOf(approved, i)).toBe('2');
  });
});
