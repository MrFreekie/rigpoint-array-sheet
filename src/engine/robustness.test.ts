// Bad input must give a plain-English problem, never a crash and never an invented figure.

import { describe, expect, it } from 'vitest';
import { loadItems } from '../testing/fixtures';
import { NO_TEXT, NOT_A_REPORT } from './messages';
import { parseSoundvision } from './parse';
import type { TextItem } from './types';

const replaceText = (items: TextItem[], from: string, to: string) =>
  items.map((i) => (i.text === from ? { ...i, text: to } : i));

const errors = (items: TextItem[]) =>
  parseSoundvision(items).problems.filter((p) => p.level === 'error').map((p) => p.message).join(' ');

describe('bad input', () => {
  it('reports an empty PDF', () => {
    const r = parseSoundvision([]);
    expect(r.ok).toBe(false);
    expect(r.problems[0]?.message).toBe(NO_TEXT);
  });

  it('reports text that is not a Soundvision report', () => {
    const r = parseSoundvision([{ page: 1, x: 70, y: 700, text: 'Invoice 1234' }]);
    expect(r.ok).toBe(false);
    expect(r.problems.map((p) => p.message)).toContain(NOT_A_REPORT);
    expect(r.report.sources).toEqual([]);
  });

  it('refuses pounds and feet rather than showing them as kilograms and metres', () => {
    const items = replaceText(replaceText(loadItems('a'), 'kg', 'lb'), 'm', 'ft');
    expect(parseSoundvision(items).ok).toBe(false);
    expect(errors(items)).toMatch(/"lb"/);
    expect(errors(items)).toMatch(/"ft"/);
  });

  it('flags a report with no units', () => {
    const items = loadItems('a').filter((i) => !/^(Distance|Weight) unit:/.test(i.text));
    expect(parseSoundvision(items).ok).toBe(false);
  });

  it('flags a line it does not understand instead of dropping it silently', () => {
    const items = loadItems('b');
    const at = items.find((i) => i.text === 'Azimuth: 0 °');
    expect(at).toBeDefined();
    const r = parseSoundvision([...items, { ...at!, text: 'Rigging note: something new', y: at!.y - 1 }]);
    const unknown = r.problems.filter((p) => p.message.includes('Rigging note: something new'));
    expect(unknown).toHaveLength(1);
    expect(unknown[0]?.level).toBe('check');
  });

  it('flags an enclosure with an unreadable height', () => {
    const items = loadItems('b').map((i) => (i.text === '7.79' ? { ...i, text: '7.7?' } : i));
    const r = parseSoundvision(items);
    expect(r.problems.some((p) => p.level === 'check' && p.message.includes('could not read "7.7?"'))).toBe(true);
  });

  it('flags a flown table whose figures disagree, naming the array', () => {
    let changed = false;
    const items = loadItems('a').map((i) => {
      if (!changed && i.text === '-7.2') {
        changed = true;
        return { ...i, text: '-9.9' };
      }
      return i;
    });
    const r = parseSoundvision(items);
    expect(r.problems.some((p) => p.source === 'KARA II L Main' && p.message.includes('site angle does not equal'))).toBe(true);
  });

  it('flags a missing angle on any row of a flown array but the first', () => {
    const items = loadItems('a').filter((i) => !(i.page === 2 && i.y === 562.14 && i.text === '2'));
    const r = parseSoundvision(items);
    expect(r.problems.some((p) => p.level === 'check' && p.message.includes('Enclosure #2, angle: nothing was found'))).toBe(true);
  });

  it('reports an unreadable angle once, not also as missing', () => {
    const items = loadItems('a').map((i) => (i.page === 2 && i.y === 562.14 && i.text === '2' ? { ...i, text: '2?' } : i));
    const r = parseSoundvision(items).problems.filter((p) => p.message.includes('Enclosure #2, angle'));
    expect(r).toHaveLength(1);
    expect(r[0]?.message).toContain('could not read "2?"');
  });

  it('gives one check about the column when a flown table has lost its Angle heading', () => {
    const items = loadItems('a').map((i) => (i.text.startsWith('Angles') ? { ...i, text: 'Lost' } : i));
    const r = parseSoundvision(items).problems.filter((p) => p.source === 'KARA II L Main' && /angle/i.test(p.message));
    expect(r.map((p) => p.message.split('.')[0])).toEqual(['The enclosure table has no "Angle" column']);
  });

  it('flags a flown or stacked array with no Position line', () => {
    const items = loadItems('a');
    const first = items.find((i) => i.text.startsWith('Position (X; Y; Z, m)'));
    const r = parseSoundvision(items.filter((i) => i !== first));
    expect(r.problems.some((p) => p.level === 'check' && p.source === 'KARA II L Main' && p.message.includes('"Position" was not found'))).toBe(true);
  });

  it('flags a motor count that does not match the pickup positions', () => {
    let changed = false;
    const items = loadItems('b').map((i) => {
      if (!changed && i.text === '# motors: 2') {
        changed = true;
        return { ...i, text: '# motors: 3' };
      }
      return i;
    });
    const r = parseSoundvision(items);
    expect(r.problems.some((p) => p.message.includes('says 3 motors but 2 pickup positions were found'))).toBe(true);
  });

  it('does not depend on the order of the items', () => {
    const items = loadItems('b');
    const shuffled = [...items].sort((x, y) => ((x.x * 7919 + x.y * 104729) % 1000) - ((y.x * 7919 + y.y * 104729) % 1000));
    expect(parseSoundvision(shuffled)).toEqual(parseSoundvision(items));
  });

  it('survives random garbage', () => {
    const words = ['#1', 'Source:', '1. Source: X', '1. 1. Physical configuration', 'Site: ° ', '#', 'Type', 'WARNING', '9.9 kg', 'Mechanical warnings:', 'Page 1 of 3'];
    const garbage: TextItem[] = Array.from({ length: 300 }, (_, i) => ({
      page: 1 + (i % 3),
      x: (i * 37) % 500,
      y: (i * 91) % 800,
      text: words[i % words.length] ?? '',
    }));
    expect(() => parseSoundvision(garbage)).not.toThrow();
  });
});

describe('odd tuning lines', () => {
  /** A one source report whose acoustic configuration (and anything before the source) is the lines given, each a list of cells. */
  const report = (acoustic: string[][], before: string[][] = []) => {
    const rows: string[][] = [['Distance unit:', 'm'], ['Weight unit:', 'kg'], ...before, ['1. Source: A'], ['1. 1. Physical configuration'], ['Configuration: vertical, stacked array'], ['1. 2. Acoustic configuration'], ...acoustic];
    const items: TextItem[] = rows.flatMap((cells, n) => cells.map((text, i) => ({ page: 1, x: 71 + i * 45, y: 780 - n * 14, text })));
    return parseSoundvision(items);
  };
  const tuning = (acoustic: string[][], before: string[][] = []) => report(acoustic, before).report.sources[0]?.tuning;
  const blank = { autofilter: null, lfContourFrequency: null, lfContourGain: null, zoom: null, delay: null, gain: null, groups: [] };

  it('reads well formed lines', () => {
    expect(tuning([['Delay:', '4.17', 'ms'], ['Gain:', '−3', 'dB'], ['Zoom Factor (ratio): 1.2']])).toEqual({ ...blank, delay: '4.17', gain: '-3', zoom: '1.2' });
  });

  it('leaves a figure blank when it is not a number or the unit is not the expected one', () => {
    expect(tuning([['Delay:', 'abc', 'ms']])).toEqual(blank);
    expect(tuning([['Delay:', '3', 's']])).toEqual(blank);
    expect(tuning([['Gain:', '3', 'ms']])).toEqual(blank);
    expect(tuning([['Delay:', '1e3', 'ms']])).toEqual(blank);
    expect(tuning([['Delay:', '12345678901234567890123', 'ms']])).toEqual(blank);
    expect(tuning([['Delay:']])).toEqual(blank);
  });

  it('leaves the zoom blank when the line has no value', () => {
    expect(tuning([['Zoom Factor (ratio):']])).toEqual(blank);
    expect(tuning([['Zoom Factor (ratio): wide']])).toEqual(blank);
  });

  it('leaves the LF Contour blank when the line is broken, and keeps the figure that is fine when only one is', () => {
    expect(tuning([['LF Contour: Frequency = 180 Hz']])).toEqual(blank);
    expect(tuning([['LF Contour:']])).toEqual(blank);
    expect(tuning([['LF Contour: Frequency = high Hz; Gain = 2 dB']])).toEqual({ ...blank, lfContourGain: '2' });
  });

  it('keeps an Autofilter line only when the saved file could hold it', () => {
    expect(tuning([['Autofilter active - Default']])?.autofilter).toBe('Autofilter active - Default');
    expect(tuning([[`Autofilter ${'x'.repeat(200)}`]])?.autofilter).toBeNull();
    expect(tuning([['Autofilter active \u0007 bell']])?.autofilter).toBeNull();
  });

  it('ignores a delay and a gain printed before any group or source', () => {
    const r = report([], [['Delay:', '3', 'ms'], ['Gain:', '2', 'dB']]);
    expect(r.report.sources[0]?.tuning).toEqual(blank);
    expect(r.problems.some((p) => p.level === 'error')).toBe(false);
  });

  it('ignores everything after the first enclosure, the FIR and air lines included', () => {
    expect(
      tuning([['Autofilter active - Default'], ['Enclosure #1 - K2'], ['FIR 1 (1250 Hz): -1 dB'], ['Gain:', '9', 'dB'], ['Delay:', '9', 'ms'], ['Zoom Factor (ratio): 9'], ['Air compensation (gain): 8.2 dB']]),
    ).toEqual({ ...blank, autofilter: 'Autofilter active - Default' });
  });

  it('reads a source with no acoustic section as all blank, and raises nothing for it', () => {
    const items: TextItem[] = ['Distance unit: m', 'Weight unit: kg', '1. Source: A'].map((text, n) => ({ page: 1, x: 71, y: 780 - n * 14, text }));
    expect(parseSoundvision(items).report.sources[0]?.tuning).toEqual(blank);
  });
});
