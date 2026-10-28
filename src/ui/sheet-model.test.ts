import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { newDoc, patchOf, withDeleted, withNote, withOnPlot, withPatch, withPrinted, withTitle } from './document';
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

  it('collapses a pair whatever offsets are typed: the shown card uses its own offset, else the one on its partner, else the default', () => {
    const own = docA();
    own.offsets[0] = '0.4';
    own.offsets[1] = '0.2';
    const m = sheetModel(own, false);
    expect(m.hidden.map((h) => h.name)).toContain('KARA II R Main');
    expect(m.entries[0]?.column.topHeight).toBe(9);
    const partnerOnly = docA();
    partnerOnly.offsets[1] = '0.4';
    expect(sheetModel(partnerOnly, false).entries[0]?.column.topHeight).toBe(9);
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

  it('collapses a pair whatever notes are typed: the shown card prints its own note and the hidden one is not printed', () => {
    const doc = withNote(docA(), 1, 'Hang this one second');
    const m = sheetModel(doc, false);
    expect(m.entries.find((e) => e.index === 0)?.coversMirror).toBe('KARA II R Main');
    expect(m.entries.find((e) => e.index === 0)?.note).toBe('');
    expect(m.entries.find((e) => e.index === 1)).toBeUndefined();
    expect(m.mirrorPairs).toBe(9);
    expect(sheetModel(doc, true).entries.find((e) => e.index === 1)?.note).toBe('Hang this one second');
  });
});

describe('sheetModel cable patch', () => {
  it('gives each card its own array patch, one row for each enclosure', () => {
    const doc = withPatch(docA(), 0, 2, 'feeder', '7');
    const m = sheetModel(doc, false);
    expect(m.entries[0]?.patch).toHaveLength(m.entries[0]?.column.rows.length ?? -1);
    expect(m.entries[0]?.patch[2]).toEqual({ feeder: '7', way: '' });
    expect(m.entries[1]?.patch.every((r) => r.feeder === '' && r.way === '')).toBe(true);
  });

  it('a collapsed pair shows the shown array patch only', () => {
    const doc = withPatch(docA(), 1, 0, 'way', '3');
    const m = sheetModel(doc, false);
    expect(m.hidden[0]).toEqual({ name: 'KARA II R Main', mirrorOf: 'KARA II L Main' });
    expect(m.entries[0]?.patch.every((r) => r.way === '')).toBe(true);
  });

  it('a pair with different patches still collapses, and each card shows its own patch when the mirrors are shown', () => {
    const doc = withPatch(withPatch(docA(), 0, 0, 'feeder', '1'), 1, 0, 'feeder', '2');
    const hidden = sheetModel(doc, false);
    expect(hidden.entries).toHaveLength(9);
    expect(hidden.mirrorPairs).toBe(9);
    const shown = sheetModel(doc, true);
    expect(shown.hidden).toEqual([]);
    expect(shown.entries.find((e) => e.index === 0)?.patch[0]?.feeder).toBe('1');
    expect(shown.entries.find((e) => e.index === 1)?.patch[0]?.feeder).toBe('2');
  });

  it('keeps the hidden partner patch in the file, and each array shows its own when the mirrors are shown', () => {
    const same = withPatch(withPatch(docA(), 0, 0, 'feeder', '1'), 1, 0, 'feeder', '1');
    expect(patchOf(same, 1)[0]?.feeder).toBe('1');
  });

  it('does not change which arrays are paired', () => {
    const plain = sheetModel(docA(), false);
    const patched = sheetModel(withPatch(docA(), 1, 0, 'way', '3'), false);
    expect(patched.hidden.map((h) => h.name)).toEqual(plain.hidden.map((h) => h.name));
    expect(patched.mirrorPairs).toBe(plain.mirrorPairs);
  });
});

describe('sheetModel plot choices', () => {
  it('puts every live array on the plot until one is left off, whatever is chosen for printing', () => {
    const doc = withPrinted(docA(), 0, false);
    const m = sheetModel(doc, true);
    expect(m.plottedSources.size).toBe(18);
    expect(m.entries.every((e) => e.plot)).toBe(true);
    expect(m.printedSources.size).toBe(17);
  });

  it('takes a mirror image off the plot with the card that stands for it', () => {
    const left = docA().result.report.sources.findIndex((s) => s.name === 'KARA II L Main');
    const m = sheetModel(withOnPlot(docA(), left, false), false);
    expect(m.plottedSources.has(left)).toBe(false);
    expect(m.plottedSources.size).toBe(16);
    expect(m.entries.find((e) => e.index === left)?.plot).toBe(false);
  });

  it('leaves a deleted array off the plot', () => {
    const m = sheetModel(withDeleted(docA(), 3, true), true);
    expect(m.plottedSources.has(3)).toBe(false);
  });
});
