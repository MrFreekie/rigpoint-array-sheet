import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { rng } from '../testing/random';
import { findMirrors, isMirror } from './symmetry';
import type { ArraySource } from './types';

const a = parseFixture('a').report.sources;
const b = parseFixture('b').report.sources;
const names = (list: ArraySource[]) => [...findMirrors(list)].map(([i, j]) => [list[i]!.name, list[j]!.name]);

/** The left-right mirror image of an array, as Soundvision would print it. */
function mirrorOf(s: ArraySource): ArraySource {
  const flip = (p: string | null) => (p === null ? null : p.split('/').reverse().join('/'));
  return {
    ...structuredClone(s),
    name: s.name + ' mirror',
    position: s.position && { ...s.position, x: -s.position.x },
    azimuth: s.azimuth === null ? null : -s.azimuth,
    pickups: s.pickups.map((p) => ({ ...p, at: { ...p.at, x: -p.at.x } })),
    cabinets: s.cabinets.map((c) => ({ ...c, panflex: flip(c.panflex) })),
  };
}

describe('findMirrors on the sample reports', () => {
  it('report A: pairs left with right and shows the first of each', () => {
    expect(names(a)).toEqual([
      ['KARA II L Main', 'KARA II R Main'],
      ['KARA II L Out', 'KARA II R Out'],
      ['SB28 L Front', 'SB28 R Front'],
      ['SB28 L Rear', 'SB28 R Rear'],
      ['X8 2', 'X8 7'],
      ['X8 3', 'X8 6'],
      ['X8 4', 'X8 5'],
      ['X12 A L', 'X12 A R'],
      ['X12 B L', 'X12 B R'],
    ]);
  });

  it('report B: pairs the flown, stacked and fill arrays', () => {
    expect(names(b)).toEqual([
      ['FL KARA II L', 'FL KARA II R'],
      ['GS KARA II L', 'GS KARA II R'],
      ['SB28 L', 'SB28 R'],
      ['X12 1', 'X12 3'],
      ['X12 2', 'X12 4'],
      ['X8 1', 'X8 6'],
      ['X8 2', 'X8 5'],
      ['X8 3', 'X8 4'],
    ]);
  });

  it('never pairs an array with itself or uses one twice', () => {
    for (const list of [a, b]) {
      const used = [...findMirrors(list)].flat();
      expect(new Set(used).size).toBe(used.length);
    }
  });
});

describe('isMirror', () => {
  const main = a.find((s) => s.name === 'KARA II L Main')!;

  it('accepts an exact mirror image', () => {
    expect(isMirror(main, mirrorOf(main))).toBe(true);
  });

  it('is not fooled by a copy that is not mirrored', () => {
    expect(isMirror(main, structuredClone(main))).toBe(false);
  });

  it('rejects an array on the centre line', () => {
    const centre = { ...structuredClone(main), position: { ...main.position!, x: 0 } };
    expect(isMirror(centre, mirrorOf(centre))).toBe(false);
  });

  it('rejects a Panflex that was not swapped', () => {
    const m = mirrorOf(main);
    m.cabinets[14]!.panflex = main.cabinets[14]!.panflex;
    expect(isMirror(main, m)).toBe(false);
  });

  it('property: changing any one figure of the mirror breaks the pairing', () => {
    const r = rng(11);
    const change: ((s: ArraySource) => void)[] = [
      (s) => { s.weights.total = (s.weights.total ?? 0) + 0.1; },
      (s) => { s.weights.frontMotorLoad = (s.weights.frontMotorLoad ?? 0) + 0.1; },
      (s) => { s.bumper = 'other'; },
      (s) => { s.motors = 2; },
      (s) => { s.site = (s.site ?? 0) + 0.1; },
      (s) => { s.azimuth = (s.azimuth ?? 0) + 1; },
      (s) => { s.bottomElevation = (s.bottomElevation ?? 0) + 0.01; },
      (s) => { s.position = { ...s.position!, z: s.position!.z + 0.01 }; },
      (s) => { s.position = { ...s.position!, y: s.position!.y + 0.01 }; },
      (s) => { s.pickups[0] = { ...s.pickups[0]!, position: 7 }; },
      (s) => { s.pickups[0] = { ...s.pickups[0]!, at: { ...s.pickups[0]!.at, z: 0 } }; },
      (s) => { s.groups = ['OTHER']; },
      (s) => { s.cabinets.pop(); },
      (s) => { s.cabinets[3]!.angle = 99; },
      (s) => { s.cabinets[3]!.site = 99; },
      (s) => { s.cabinets[3]!.type = 'K2'; },
      (s) => { s.cabinets[3]!.topZ = 99; },
      (s) => { s.cabinets[3]!.bottomZ = 99; },
      (s) => { s.warnings.push({ severity: 'CAUTION', title: 't', message: 'm' }); },
    ];
    for (let i = 0; i < 300; i++) {
      const m = mirrorOf(main);
      r.pick(change)(m);
      expect(isMirror(main, m)).toBe(false);
    }
    for (const f of change) {
      const m = mirrorOf(main);
      f(m);
      expect(isMirror(main, m)).toBe(false);
    }
  });
});
