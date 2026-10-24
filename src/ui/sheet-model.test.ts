import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { newDoc, withDeleted, withNote, withPrinted, withTitle } from './document';
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

  it('applies the ground offset to the heights, and a pair with the same typed offset collapses', () => {
    const doc = docA();
    doc.offsets[0] = '0.4';
    doc.offsets[1] = ' 0.4 ';
    const m = sheetModel(doc, false);
    expect(m.hidden.map((h) => h.name)).toContain('KARA II R Main');
    expect(m.entries[0]?.column.topHeight).toBe(9);
    expect(m.entries[1]?.column.topHeight).toBe(9.4);
  });

  it('keeps a card each when the typed offsets of a mirror pair differ, so no height is shown for the wrong array', () => {
    const doc = docA();
    doc.offsets[0] = '0.4';
    const m = sheetModel(doc, false);
    expect(m.hidden.map((h) => h.name)).not.toContain('KARA II R Main');
    expect(m.entries[0]?.column.topHeight).toBe(9);
    expect(m.entries[1]?.column.topHeight).toBe(9.4);
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

describe('sheetModel with deleted arrays, titles and notes', () => {
  it('leaves a deleted array out of the cards, the printing and the live set', () => {
    const doc = withDeleted(docA(), 0, true);
    const m = sheetModel(doc, true);
    expect(m.entries.some((e) => e.index === 0)).toBe(false);
    expect(m.printedSources.has(0)).toBe(false);
    expect(m.live.has(0)).toBe(false);
    expect(m.live.size).toBe(doc.result.report.sources.length - 1);
    expect(m.deletedList).toEqual([{ index: 0, name: 'KARA II L Main' }]);
    expect(m.sources).toHaveLength(doc.result.report.sources.length);
  });

  it('shows the mirror of a deleted array as a card of its own', () => {
    const doc = withDeleted(docA(), 0, true);
    const m = sheetModel(doc, false);
    const right = m.entries.find((e) => e.index === 1);
    expect(right).toBeDefined();
    expect(right?.coversMirror).toBeUndefined();
    expect(right?.mirrorOf).toBeUndefined();
    expect(m.mirrorPairs).toBe(8);
  });

  it('deletes only the array whose card was chosen when two stand for one card', () => {
    const doc = withDeleted(docA(), 1, true);
    const m = sheetModel(doc, false);
    const left = m.entries.find((e) => e.index === 0);
    expect(left?.coversMirror).toBeUndefined();
    expect(m.entries.some((e) => e.index === 1)).toBe(false);
  });

  it('uses the title typed in place of the name, and remembers the report name', () => {
    const doc = withTitle(docA(), 0, 'Front left');
    const m = sheetModel(doc, true);
    const e = m.entries.find((x) => x.index === 0);
    expect(e?.column.name).toBe('Front left');
    expect(e?.reportName).toBe('KARA II L Main');
    expect(e?.renamed).toBe(true);
    expect(m.sources[0]?.name).toBe('Front left');
    expect(m.entries.find((x) => x.index === 1)?.mirrorOf).toBe('Front left');
    expect(m.entries.find((x) => x.index === 2)?.renamed).toBe(false);
  });

  it('keeps both cards when two mirrored arrays carry different notes', () => {
    const doc = withNote(docA(), 1, 'Hang this one second');
    const m = sheetModel(doc, false);
    expect(m.entries.find((e) => e.index === 0)?.coversMirror).toBeUndefined();
    expect(m.entries.find((e) => e.index === 1)?.note).toBe('Hang this one second');
    expect(m.mirrorPairs).toBe(8);
  });

  it('still collapses a pair that carries the same note', () => {
    const doc = withNote(withNote(docA(), 0, 'Same'), 1, ' Same ');
    expect(sheetModel(doc, false).entries.find((e) => e.index === 0)?.coversMirror).toBe('KARA II R Main');
  });
});
