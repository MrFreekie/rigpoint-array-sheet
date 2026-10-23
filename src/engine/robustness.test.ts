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
