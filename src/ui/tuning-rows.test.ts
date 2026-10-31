import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { newDoc, withDeleted, withTitle, type Doc } from './document';
import { autofilterText, hasTuning, lfContourText, noTuningNotice, tuningRows, TUNING_COLUMNS } from './tuning-rows';

const doc = (name: 'a' | 'b' | 'c' | 'd' | 'e' = 'a'): Doc => newDoc(parseFixture(name), `${name}.pdf`);
const texts = (cell: { text: string; small: boolean }[]) => cell.map((l) => l.text);
const row = (d: Doc, name: string) => {
  const index = d.result.report.sources.findIndex((s) => s.name === name);
  return tuningRows(d).find((r) => r.index === index)!;
};

describe('tuningRows', () => {
  it('has a cell for each column, and a row for every array of the report, mirror images included', () => {
    const d = doc();
    const rows = tuningRows(d);
    expect(rows).toHaveLength(18);
    expect(rows.map((r) => r.index)).toEqual(Array.from({ length: 18 }, (_, i) => i));
    expect(rows.every((r) => r.cells.length === TUNING_COLUMNS.length)).toBe(true);
  });

  it('shows the own figures, the autofilter without its lead, the LF Contour and the zoom', () => {
    const [name, delay, gain, autofilter, lf, zoom] = row(doc(), 'KARA II L Main').cells;
    expect(texts(name!)).toEqual(['KARA II L Main']);
    expect(delay).toEqual([]);
    expect(gain).toEqual([]);
    expect(texts(autofilter!)).toEqual(['Default']);
    expect(texts(lf!)).toEqual(['180 Hz, 2 dB']);
    expect(texts(zoom!)).toEqual(['1.1']);
  });

  it('puts the own figure first and one smaller line for each group after it', () => {
    const [, delay, gain] = row(doc(), 'SB28 L Rear').cells;
    expect(delay).toEqual([{ text: '4.17 ms', small: false }, { text: 'SUBS: 4 ms', small: true }]);
    expect(gain).toEqual([{ text: 'SUBS: -2 dB', small: true }]);
  });

  it('lists a group once for each figure it states, outermost first', () => {
    const [, delay, gain] = row(doc('c'), 'K2 Left').cells;
    expect(texts(delay!)).toEqual(['DELAY: 120 ms']);
    expect(texts(gain!)).toEqual(['DELAY: -6 dB']);
    const [, d2, g2] = row(doc('d'), 'SB28 L').cells;
    expect(texts(d2!)).toEqual(['9 ms']);
    expect(texts(g2!)).toEqual(['4 dB']);
  });

  it('keeps a whole autofilter line that does not start with the usual words, and leaves a blank cell truly empty', () => {
    const d = doc('b');
    d.result.report.sources[0]!.tuning = { ...d.result.report.sources[0]!.tuning!, autofilter: 'Filters off' };
    const cells = tuningRows(d)[0]!.cells;
    expect(texts(cells[3]!)).toEqual(['Filters off']);
    expect(cells.slice(1, 3)).toEqual([[], []]);
    expect(cells[4]).toEqual([]);
    expect(cells[5]).toEqual([]);
  });

  it('leaves out deleted arrays, and shows the report name under a title the person typed', () => {
    const d = withTitle(withDeleted(doc(), 0, true), 1, 'Hang R');
    const rows = tuningRows(d);
    expect(rows).toHaveLength(17);
    expect(rows.some((r) => r.index === 0)).toBe(false);
    expect(rows[0]!.cells[0]).toEqual([{ text: 'Hang R', small: false }, { text: 'Soundvision name: KARA II R Main', small: true }]);
  });

  it('gives blank cells for a file saved without tuning, and says so', () => {
    const d = doc();
    for (const s of d.result.report.sources) delete s.tuning;
    expect(hasTuning(d)).toBe(false);
    expect(hasTuning(doc())).toBe(true);
    expect(tuningRows(d)[0]!.cells.slice(1)).toEqual([[], [], [], [], []]);
    expect(noTuningNotice(false)).toBe('This file was saved before the app read tuning values. Use Update from PDF with the same report to read them. Update from PDF also brings back any array you deleted.');
    expect(noTuningNotice(true)).toBe('This file was saved before the app read tuning values. Create a new revision, then use Update from PDF with the same report to read them. Update from PDF also brings back any array you deleted.');
  });

  it('formats the pieces', () => {
    expect(autofilterText('Autofilter active - Default')).toBe('Default');
    expect(autofilterText('Autofilter active - ')).toBe('Autofilter active - ');
    expect(autofilterText(null)).toBe('');
    const t = { autofilter: null, lfContourFrequency: '60', lfContourGain: null, zoom: null, delay: null, gain: null, groups: [] };
    expect(lfContourText(t)).toBe('60 Hz');
    expect(lfContourText({ ...t, lfContourFrequency: null, lfContourGain: '-3' })).toBe('-3 dB');
    expect(lfContourText({ ...t, lfContourFrequency: null })).toBe('');
  });
});
