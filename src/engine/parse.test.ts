// Expected values below were read by hand from the two sample Soundvision reports
// (fixtures/soundvision-a and -b, anonymised copies of the PDFs the owner supplied).
// The PDF is the source of truth: never edit an expected value to make a test pass. Raise it.

import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { parseSoundvision } from './parse';
import type { ArraySource } from './types';

const a = parseFixture('a');
const b = parseFixture('b');
const c = parseFixture('c');
const d = parseFixture('d');

function find(result: typeof a, name: string): ArraySource {
  const s = result.report.sources.find((x) => x.name === name);
  if (!s) throw new Error(`No source called ${name}`);
  return s;
}

describe('report A (L and R mains, out hangs, subs, fills)', () => {
  it('reads cleanly with nothing to check', () => {
    expect(a.problems).toEqual([]);
    expect(a.ok).toBe(true);
  });

  it('reads the document heading', () => {
    expect(a.report.document).toEqual({
      version: '2026.3.1',
      author: 'Example Author',
      date: '2026/10/21',
      fileName: 'Example Arena - Example Show.xmlp',
      distanceUnit: 'm',
      weightUnit: 'kg',
    });
  });

  it('finds all 18 sources, in order', () => {
    expect(a.report.sources.map((s) => s.name)).toEqual([
      'KARA II L Main', 'KARA II R Main', 'KARA II L Out', 'KARA II R Out',
      'SB28 L Front', 'SB28 R Front', 'SB28 L Rear', 'SB28 R Rear',
      'X8 2', 'X8 3', 'X8 4', 'X8 5', 'X8 6', 'X8 7',
      'X12 A L', 'X12 B L', 'X12 B R', 'X12 A R',
    ]);
  });

  it('follows the group numbering', () => {
    expect(find(a, 'KARA II L Main').groups).toEqual(['ALL', 'MAINS & SUBS', 'MAINS']);
    expect(find(a, 'KARA II L Out').groups).toEqual(['ALL', 'MAINS & SUBS', 'OUT HANGS']);
    expect(find(a, 'SB28 R Rear').groups).toEqual(['ALL', 'MAINS & SUBS', 'SUBS']);
    expect(find(a, 'X8 2').groups).toEqual(['ALL', 'LIPFILL']);
    expect(find(a, 'X12 A R').groups).toEqual(['ALL', 'X12']);
  });

  it('reads the left main array', () => {
    const s = find(a, 'KARA II L Main');
    expect(s.configuration).toBe('vertical, flown array');
    expect(s.orientation).toBe('vertical');
    expect(s.mounting).toBe('flown');
    expect(s.bumper).toBe('M-BUMP+MBAR hole A');
    expect(s.motors).toBe(1);
    expect(s.pickups).toEqual([{ which: 'front', position: 6, at: { x: 10, y: 12.68, z: 9.51 } }]);
    expect(s.position).toEqual({ x: 10, y: 13.01, z: 9.4 });
    expect(s.site).toBe(3.8);
    expect(s.azimuth).toBe(0);
    expect(s.dimensions).toEqual({ x: 0.75, y: 1.09, z: 3.81 });
    expect(s.bottomElevation).toBe(5.75);
    expect(s.topSite).toBe(3.8);
    expect(s.bottomSite).toBe(-41.2);
    expect(s.weights).toEqual({ total: 414.2, enclosures: 383.2, frontMotorLoad: 414.2, rearMotorLoad: null });
    expect(s.warnings).toEqual([]);
  });

  it('reads the left main enclosure table', () => {
    const s = find(a, 'KARA II L Main');
    expect(s.cabinets).toHaveLength(15);
    expect(s.cabinets[0]).toEqual({ number: 1, type: 'KARA II', angle: 5, site: 3.8, topZ: 9.4, bottomZ: 9.15, panflex: '35/35' });
    expect(s.cabinets[1]).toEqual({ number: 2, type: 'KARA II', angle: 2, site: 1.8, topZ: 9.15, bottomZ: 8.9, panflex: '35/35' });
    expect(s.cabinets[2]).toEqual({ number: 3, type: 'KARA II', angle: 2, site: -0.2, topZ: 8.89, bottomZ: 8.64, panflex: '35/35' });
    expect(s.cabinets[6]).toEqual({ number: 7, type: 'KARA II', angle: 1, site: -7.2, topZ: 7.88, bottomZ: 7.63, panflex: '35/35' });
    expect(s.cabinets[14]).toEqual({ number: 15, type: 'KARA II', angle: 10, site: -41.2, topZ: 5.94, bottomZ: 5.75, panflex: '55/35' });
  });

  it('reads an out hang whose table runs onto the next page', () => {
    const s = find(a, 'KARA II L Out');
    expect(s.azimuth).toBe(25);
    expect(s.site).toBe(-0.8);
    expect(s.weights).toEqual({ total: 184.3, enclosures: 153.3, frontMotorLoad: 184.3, rearMotorLoad: null });
    expect(s.cabinets.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(s.cabinets[2]).toEqual({ number: 3, type: 'KARA II', angle: 7.5, site: -13.3, topZ: 8.89, bottomZ: 8.65, panflex: '35/55' });
    expect(s.cabinets[5]).toEqual({ number: 6, type: 'KARA II', angle: 10, site: -43.3, topZ: 8.2, bottomZ: 8.02, panflex: '35/55' });
  });

  it('keeps the sign of the right out hang azimuth and pickup', () => {
    const s = find(a, 'KARA II R Out');
    expect(s.azimuth).toBe(-25);
    expect(s.pickups[0]?.at).toEqual({ x: -17.36, y: 11.64, z: 9.53 });
  });

  it('reads a stacked sub with its Soundvision warnings', () => {
    const s = find(a, 'SB28 L Front');
    expect(s.configuration).toBe('horizontal, stacked array');
    expect(s.mounting).toBe('stacked');
    expect(s.bumper).toBeNull();
    expect(s.motors).toBeNull();
    expect(s.pickups).toEqual([]);
    expect(s.weights).toEqual({ total: 93, enclosures: null, frontMotorLoad: null, rearMotorLoad: null });
    expect(s.cabinets).toEqual([{ number: 1, type: 'SB28', angle: null, site: 0, topZ: 1.3, bottomZ: 0, panflex: null }]);
    expect(s.warnings).toEqual([
      { severity: 'WARNING', title: 'Tipping hazard', message: 'Change the site angle, rigging option, or number of enclosures.' },
      { severity: 'CAUTION', title: 'Tipping hazard', message: 'L-Acoustics recommends securing the array to the ground.' },
    ]);
  });

  it('reads the single-enclosure fills', () => {
    const x8 = find(a, 'X8 2');
    expect(x8.mounting).toBe('flown');
    expect(x8.weights.total).toBe(12);
    expect(x8.cabinets).toEqual([{ number: 1, type: 'X8', angle: null, site: 0, topZ: 2.13, bottomZ: 1.88, panflex: null }]);
    expect(find(a, 'X12 A L').weights.total).toBe(20);
  });

  it('does not take the acoustic settings for array information', () => {
    expect(JSON.stringify(a.report)).not.toMatch(/FIR|Air compensation|Zoom/);
  });
});

describe('report B (flown with two motors, ground stacks, no groups)', () => {
  it('reads cleanly with nothing to check', () => {
    expect(b.problems).toEqual([]);
    expect(b.ok).toBe(true);
  });

  it('finds 16 sources and no groups, numbered from 8', () => {
    expect(b.report.sources).toHaveLength(16);
    expect(b.report.sources[0]?.number).toBe(8);
    expect(b.report.sources.every((s) => s.groups.length === 0)).toBe(true);
  });

  it('reads a two-motor array', () => {
    const s = find(b, 'FL KARA II L');
    expect(s.bumper).toBe('M-BUMP+MBAR inv Hole A');
    expect(s.motors).toBe(2);
    expect(s.pickups).toEqual([
      { which: 'front', position: 16, at: { x: 7.5, y: 3.91, z: 8.71 } },
      { which: 'rear', position: 0, at: { x: 7.5, y: 3.08, z: 8.37 } },
    ]);
    expect(s.weights).toEqual({ total: 235.4, enclosures: 204.4, frontMotorLoad: 182.7, rearMotorLoad: 52.7 });
    expect(s.cabinets).toHaveLength(8);
    expect(s.cabinets[3]).toEqual({ number: 4, type: 'KARA II', angle: 10, site: 9.3, topZ: 7.79, bottomZ: 7.54, panflex: '55/55' });
    expect(s.cabinets[7]).toEqual({ number: 8, type: 'KARA II', angle: 10, site: -30.7, topZ: 6.79, bottomZ: 6.58, panflex: '55/55' });
  });

  it('reads a mixed ground stack listed top first, with blank angles on the subs', () => {
    const s = find(b, 'GS KARA II L');
    expect(s.mounting).toBe('stacked');
    expect(s.cabinets.map((c) => c.number)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(s.cabinets[0]).toEqual({ number: 6, type: 'KARA II', angle: 4, site: 1, topZ: 2.17, bottomZ: 1.92, panflex: '55/55' });
    expect(s.cabinets[4]).toEqual({ number: 2, type: 'SB18', angle: null, site: 0, topZ: 1.09, bottomZ: 0.54, panflex: null });
    expect(s.cabinets[5]).toEqual({ number: 1, type: 'SB18', angle: null, site: 0, topZ: 0.54, bottomZ: 0, panflex: null });
    expect(s.weights.total).toBe(233.2);
    expect(s.warnings).toEqual([
      { severity: 'CAUTION', title: 'Tipping hazard', message: 'L-Acoustics recommends securing the array to the ground.' },
    ]);
  });
});

describe('report C (K1, K2 and A15 arrays, nested groups, an HF stack)', () => {
  it('reads cleanly with nothing to check', () => {
    expect(c.problems).toEqual([]);
    expect(c.ok).toBe(true);
    expect(c.report.sources).toHaveLength(20);
  });

  it('follows deeper group nesting', () => {
    expect(find(c, 'K1 1 Left').groups).toEqual(['ALL', 'MAIN', 'K1']);
    expect(find(c, 'K2 Left').groups).toEqual(['ALL', 'MAIN', 'DELAY']);
    expect(find(c, 'KARA II 2').groups).toEqual(['ALL', 'MAIN', 'Fills', 'Sub Fill']);
    expect(find(c, 'K2 SR').groups).toEqual(['ALL', 'MAIN', 'Fills', 'VIP']);
  });

  it('reads a two-motor K1 array with large splays and a blank first angle', () => {
    const s = find(c, 'K1 1 Left');
    expect(s.bumper).toBe('K2-BUMP + 1xK2-BAR hole A');
    expect(s.motors).toBe(2);
    expect(s.pickups).toEqual([
      { which: 'front', position: 4, at: { x: 11.4, y: 2.16, z: 11.68 } },
      { which: 'rear', position: 21, at: { x: 11.4, y: 1.15, z: 11.78 } },
    ]);
    expect(s.position).toEqual({ x: 11.4, y: 2.2, z: 11.5 });
    expect(s.bottomElevation).toBe(6.35);
    expect(s.weights).toEqual({ total: 1332.6, enclosures: 1272, frontMotorLoad: 379.4, rearMotorLoad: 953.2 });
    expect(s.cabinets).toHaveLength(12);
    expect(s.cabinets[0]).toEqual({ number: 1, type: 'K1', angle: null, site: -6.5, topZ: 11.5, bottomZ: 11.07, panflex: null });
    expect(s.cabinets[1]).toEqual({ number: 2, type: 'K1', angle: 0.5, site: -7, topZ: 11.06, bottomZ: 10.63, panflex: null });
    expect(s.cabinets[11]).toEqual({ number: 12, type: 'K1', angle: 5, site: -41.5, topZ: 6.68, bottomZ: 6.35, panflex: null });
  });

  it('does not call the gaps between splayed K1 enclosures a reading problem', () => {
    expect(c.problems.some((p) => p.message.includes('top height'))).toBe(false);
  });

  it('reads a single-motor flown array and an HF stack with its warnings', () => {
    expect(find(c, 'K2 SR').motors).toBe(1);
    expect(find(c, 'K2 SR').weights.total).toBe(396.6);
    const hf = find(c, 'A15 WIDE Out SR');
    expect(hf.configuration).toBe('vertical, stacked array with HF right');
    expect(hf.mounting).toBe('stacked');
    expect(hf.warnings.map((w) => `${w.severity}: ${w.title}`)).toEqual([
      'WARNING: L-Acoustics does not allow this configuration.',
      'WARNING: Tipping hazard',
      'CAUTION: Tipping hazard',
    ]);
  });
});

describe('report D (flown arrays and ground-stacked subs laid out in columns)', () => {
  it('reads cleanly with nothing to check', () => {
    expect(d.problems).toEqual([]);
    expect(d.ok).toBe(true);
  });

  it('finds 8 sources and their mounting', () => {
    expect(d.report.sources.map((s) => s.name)).toEqual([
      '12 KARA II L',
      '12 KARA II R',
      '9 KARA II',
      '9 KARA II RIGHT',
      'SB28 L',
      'SB28 R',
      'X12 L',
      'X12 R',
    ]);
    expect(d.report.sources.map((s) => s.mounting)).toEqual(['flown', 'flown', 'flown', 'flown', 'stacked', 'stacked', 'flown', 'flown']);
  });

  it('reads a stacked sub array laid out in columns, keeping the column of each row', () => {
    const s = find(d, 'SB28 L');
    expect(s.groups).toEqual(['ALL', 'MAIN', 'SUB']);
    expect(s.orientation).toBe('horizontal');
    expect(s.weights.total).toBe(186);
    expect(s.cabinets).toEqual([
      { number: 1, column: 1, type: 'SB28', angle: null, site: 0, topZ: 1.3, bottomZ: 0, panflex: null },
      { number: 1, column: 2, type: 'SB28', angle: null, site: 0, topZ: 1.3, bottomZ: 0, panflex: null },
    ]);
    expect(find(d, 'SB28 R').cabinets.map((c) => c.column)).toEqual([1, 2]);
  });

  it('keeps the tipping hazard warning on the stacked subs', () => {
    for (const name of ['SB28 L', 'SB28 R']) {
      expect(find(d, name).warnings).toEqual([
        { severity: 'CAUTION', title: 'Tipping hazard', message: 'L-Acoustics recommends securing the array to the ground.' },
      ]);
    }
  });

  it('leaves flown rows without a column', () => {
    expect(d.report.sources.filter((s) => s.mounting === 'flown').every((s) => s.cabinets.every((x) => x.column === undefined))).toBe(true);
  });
});

describe('numbering of a stack laid out in columns', () => {
  const row = (y: number, label: string) => [
    { page: 1, x: 73, y, text: label },
    { page: 1, x: 135, y, text: 'SB28' },
    { page: 1, x: 250, y, text: '0' },
    { page: 1, x: 322, y, text: '1.3' },
    { page: 1, x: 432, y, text: '0' },
  ];
  const head = (y: number, text: string) => ({ page: 1, x: 71, y, text });
  const report = (labels: string[], without?: number) =>
    parseSoundvision([
      head(700, 'Distance unit: m'),
      head(690, 'Weight unit: kg'),
      head(680, '1. Source: SB'),
      head(670, '1. 1. Physical configuration'),
      head(660, 'Configuration: horizontal, stacked array'),
      head(650, 'Position (X; Y; Z, m): 1; 0; 0'),
      head(640, 'Site: 0 °'),
      head(630, 'Total weight (Enclosures + Frames): 186 kg'),
      { page: 1, x: 98, y: 600, text: '#' },
      { page: 1, x: 149, y: 600, text: 'Type' },
      { page: 1, x: 207, y: 600, text: 'Site (°)' },
      { page: 1, x: 273, y: 600, text: 'Top Z (m)' },
      { page: 1, x: 356, y: 600, text: 'Bottom Z (m)' },
      ...labels.flatMap((l, i) => row(580 - i * 18, l).filter((c) => c.x !== without)),
    ]);

  it('accepts #1 once in each column', () => {
    expect(report(['C1 #1', 'C2 #1']).problems).toEqual([]);
  });

  it('accepts several rows in each column', () => {
    expect(report(['C1 #1', 'C1 #2', 'C2 #1', 'C2 #2']).problems).toEqual([]);
  });

  it('still catches a missing row within a column', () => {
    const p = report(['C1 #1', 'C2 #2']).problems;
    expect(p).toHaveLength(1);
    expect(p[0]?.message).toMatch(/not numbered in order/);
  });

  it('accepts columns numbered 1 to n', () => {
    expect(report(['C1 #1', 'C2 #1', 'C3 #1']).problems).toEqual([]);
  });

  it('catches a column that is missing', () => {
    const p = report(['C1 #1', 'C3 #1']).problems;
    expect(p).toHaveLength(1);
    expect(p[0]?.message).toMatch(/columns of the stack are not numbered.*found C1, C3/);
  });

  it('catches columns that do not start at C1', () => {
    const p = report(['C2 #1', 'C3 #1']).problems;
    expect(p).toHaveLength(1);
    expect(p[0]?.message).toMatch(/found C2, C3/);
  });

  it('catches a table that mixes plain and column rows', () => {
    const p = report(['#1', 'C1 #1']).problems;
    expect(p).toHaveLength(1);
    expect(p[0]?.message).toMatch(/some do not/);
  });

  it('names the column when a cell is missing', () => {
    const p = report(['C1 #1', 'C2 #1'], 250).problems;
    expect(p.map((x) => x.message)).toEqual([
      expect.stringContaining('Enclosure C1 #1, site angle: nothing was found'),
      expect.stringContaining('Enclosure C2 #1, site angle: nothing was found'),
    ]);
  });

  it('does not take column 0 as a column', () => {
    const r = report(['C0 #1']);
    expect(r.report.sources[0]?.cabinets).toEqual([]);
    expect(r.problems.some((x) => /not understood/.test(x.message))).toBe(true);
  });
});
