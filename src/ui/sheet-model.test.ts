import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { newDoc, withPrinted } from './document';
import { sheetModel } from './sheet-model';

const docA = () => newDoc(parseFixture('a'), 'a.pdf');

describe('sheetModel', () => {
  it('collapses mirrored arrays and says which ones were left out', () => {
    const m = sheetModel(docA(), false);
    expect(m.entries).toHaveLength(9);
    expect(m.mirrorPairs).toBe(9);
    expect(m.hidden).toHaveLength(9);
    expect(m.hidden[0]).toEqual({ name: 'KARA II R Main', mirrorOf: 'KARA II L Main' });
    expect(m.entries[0]?.coversMirror).toBe('KARA II R Main');
    expect(m.entries[0]?.mirrorOf).toBeUndefined();
  });

  it('shows everything when asked, and names each mirror', () => {
    const m = sheetModel(docA(), true);
    expect(m.entries).toHaveLength(18);
    expect(m.hidden).toEqual([]);
    expect(m.entries.find((e) => e.column.name === 'KARA II R Main')?.mirrorOf).toBe('KARA II L Main');
    expect(m.entries.find((e) => e.column.name === 'KARA II L Main')?.coversMirror).toBeUndefined();
  });

  it('applies the ground offset to the heights, and the mirror shares its partner offset', () => {
    const doc = docA();
    doc.offsets[0] = '0.4';
    const m = sheetModel(doc, true);
    expect(m.entries[0]?.column.topHeight).toBe(9);
    expect(m.entries[1]?.column.topHeight).toBe(9);
    expect(m.entries[2]?.column.topHeight).toBe(9.4);
  });

  it('hides heights and flags a bad offset', () => {
    const doc = docA();
    doc.job.defaultOffset = 'x';
    const m = sheetModel(doc, false);
    expect(m.badOffsets).toBe(true);
    expect(m.entries.every((e) => e.column.topHeight === null && e.column.bottomHeight === null)).toBe(true);
  });

  it('is fine with no offsets typed', () => {
    expect(sheetModel(docA(), false).badOffsets).toBe(false);
  });
});

describe('sheetModel print choices', () => {
  it('marks every entry as printed to begin with, and lists every source', () => {
    const m = sheetModel(docA(), false);
    expect(m.entries.every((e) => e.print)).toBe(true);
    expect(m.printedSources.size).toBe(18);
  });

  it('an unchosen array drops out, and takes the mirror it stands for with it', () => {
    const m = sheetModel(withPrinted(docA(), 0, false), false);
    expect(m.entries[0]?.print).toBe(false);
    expect(m.entries[1]?.print).toBe(true);
    expect(m.printedSources.has(0)).toBe(false);
    expect(m.printedSources.has(1)).toBe(false); // KARA II R Main is covered by the unchosen L Main
    expect(m.printedSources.size).toBe(16);
  });

  it('with the mirrors shown, each array is chosen on its own', () => {
    const m = sheetModel(withPrinted(docA(), 0, false), true);
    expect(m.entries.find((e) => e.index === 0)?.print).toBe(false);
    expect(m.entries.find((e) => e.index === 1)?.print).toBe(true);
    expect(m.printedSources.has(1)).toBe(true);
  });

  it('a chosen card that covers a mirror prints both pickups sets', () => {
    expect(sheetModel(docA(), false).entries[0]?.mirrorIndex).toBe(1);
  });
});
