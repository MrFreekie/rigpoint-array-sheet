// The additional weight typed for a pickup, in the document and in the saved file.

import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { extraKgFor, sheetModel } from '../ui/sheet-model';
import { openFileText, serialiseDoc } from './array-file-io';
import { editKey, extraOf, newDoc, updatedDoc, withExtra, type Doc } from './doc';
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

describe('the additional weight of a pickup in the document', () => {
  it('starts empty and is typed for the front and the rear pickup separately', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    expect(extraOf(doc, i, 'front')).toBe('');
    const typed = withExtra(withExtra(doc, i, 'front', '12.5'), i, 'rear', '3');
    expect(extraOf(typed, i, 'front')).toBe('12.5');
    expect(extraOf(typed, i, 'rear')).toBe('3');
    expect(withExtra(typed, i, 'front', '').extras[i]).toEqual({ front: '', rear: '3' });
  });

  it('forgets an array whose two weights are blank again', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    expect(withExtra(withExtra(doc, i, 'front', '5'), i, 'front', '').extras).toEqual({});
  });

  it('cannot be changed on an approved or superseded file', () => {
    const doc = { ...a(), locked: true };
    expect(withExtra(doc, 0, 'front', '5')).toBe(doc);
  });

  it('makes the file count as edited, so it asks to be saved', () => {
    const doc = a();
    expect(editKey(withExtra(doc, 0, 'front', '5'))).not.toBe(editKey(doc));
    expect(editKey(withExtra(withExtra(doc, 0, 'front', '5'), 0, 'front', ''))).toBe(editKey(doc));
  });

  it('a mirror image that a card stands for takes the weight typed on that card', () => {
    const doc = a();
    const left = indexOf(doc, 'KARA II L Main');
    const right = indexOf(doc, 'KARA II R Main');
    const typed = withExtra(doc, left, 'front', '20');
    const collapsed = extraKgFor(typed, sheetModel(typed, false));
    expect(collapsed(left, 'front')).toBe(20);
    expect(collapsed(right, 'front')).toBe(20);
    const shown = extraKgFor(typed, sheetModel(typed, true));
    expect(shown(left, 'front')).toBe(20);
    expect(shown(right, 'front')).toBeNull();
  });
});

describe('the additional weight in a saved file', () => {
  it('is saved as one pair of text weights for each array and opens again as it was', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    const typed = withExtra(withExtra(doc, i, 'front', '12.50'), i, 'rear', '.5');
    const saved = JSON.parse(serialiseDoc(typed, '0.1.0', NOW));
    expect(saved.format).toBe('arraysheet/16');
    expect(saved.extra_weight).toHaveLength(doc.result.report.sources.length);
    expect(saved.extra_weight[i]).toEqual({ front: '12.5', rear: '0.5' });
    expect(saved.extra_weight[0 === i ? 1 : 0]).toEqual({ front: '', rear: '' });
    expect(roundTrip(typed).extras).toEqual({ [i]: { front: '12.5', rear: '0.5' } });
  });

  it('refuses a weight that is not a weight, naming it', () => {
    const doc = a();
    for (const bad of ['abc', '-5', '1.234', '100001', '1e3']) {
      expect(() => openFileText(edited(doc, (f) => ((f['extra_weight'] as { front: string }[])[0]!.front = bad)), 'x.json'), bad).toThrow(FileError);
    }
    expect(() => openFileText(edited(doc, (f) => ((f['extra_weight'] as { front: unknown }[])[0]!.front = 5)), 'x.json')).toThrow(FileError);
  });

  it('refuses a file with the wrong number of weights', () => {
    expect(() => openFileText(edited(a(), (f) => (f['extra_weight'] as unknown[]).pop()), 'x.json')).toThrow(/one pair of additional weights for each array/);
  });

  it('is kept on a file that is read-only, and cannot be changed there', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    const approved = openFileText(edited(withExtra(doc, i, 'front', '9'), (f) => (f['status'] = 'approved')), 'x.json').doc;
    expect(approved.locked).toBe(true);
    expect(extraOf(approved, i, 'front')).toBe('9');
    expect(withExtra(approved, i, 'front', '1')).toBe(approved);
  });
});

describe('Update from PDF and the additional weight', () => {
  it('keeps a weight on the array of the same name and the same pickup', () => {
    const doc = withExtra(a(), indexOf(a(), 'KARA II L Main'), 'front', '15');
    const next = updatedDoc(doc, parseFixture('a'), 'a2.pdf');
    expect(extraOf(next, indexOf(next, 'KARA II L Main'), 'front')).toBe('15');
  });
});
