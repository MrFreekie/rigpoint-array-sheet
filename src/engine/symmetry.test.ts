import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { rng } from '../testing/random';
import { findMirrors, isMirror } from './symmetry';
import type { ArraySource } from './types';

const a = parseFixture('a').report.sources;
const b = parseFixture('b').report.sources;
const e = parseFixture('e').report.sources;
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

describe('isMirror without a position', () => {
  it('never pairs arrays that have no position', () => {
    const main = a.find((s) => s.name === 'KARA II L Main')!;
    const m = { ...mirrorOf(main), position: null };
    expect(isMirror({ ...structuredClone(main), position: null }, m)).toBe(false);
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

describe('findMirrors with stacks laid out in columns', () => {
  const d = parseFixture('d').report.sources;

  it('report D: pairs the left and right subs', () => {
    expect(names(d).some(([x, y]) => x === 'SB28 L' && y === 'SB28 R')).toBe(true);
  });

  it('does not pair arrays whose rows sit in different columns', () => {
    const left = d.find((s) => s.name === 'SB28 L')!;
    const right = mirrorOf(left);
    right.cabinets[1] = { ...right.cabinets[1]!, column: 3 };
    expect(isMirror(left, right)).toBe(false);
  });
});

describe('report E and fixations', () => {
  it('pairs the flown hangs, the subs and the fills that mirror left to right, and the two centre hangs that mirror front to back', () => {
    expect(names(e)).toEqual([
      ['YZ Sym of Left', 'YZ Sym of YZ Sym of Left'],
      ['XZ Sym of YZ Sym of Left', 'XZ Sym of Left'],
      ['KS28 4', 'KS28 3'],
      ['KARA II 2', 'KARA II 1'],
      // Azimuth 180 against 180 is a left-right pair too, and a symmetry prefix on a group name does not stop a pair.
      ['XZ Sym of KARA II 2', 'XZ Sym of KARA II 1'],
      ['Copy of XZ Sym of KARA II 2', 'YZ Sym of Copy of XZ Sym of KARA II 2'],
      ['XZ Sym of Copy of XZ Sym of KARA II 2', 'YZ Sym of XZ Sym of Copy of XZ Sym of KARA II 2'],
      // Front-back pairs, found after the left-right ones: the two centre hangs, azimuth 0 and 180, and two subs.
      ['Copy of YZ Sym of Left', 'XZ Sym of Copy of YZ Sym of Left'],
      ['KS28 2', 'KS28 1'],
    ]);
  });

  const fill = e.find((s) => s.name === 'KARA II 2')!;
  const other = e.find((s) => s.name === 'KARA II 1')!;

  it('needs the fixations to mirror too: Fr to Fl and Rr to Rl, with X negated', () => {
    expect(isMirror(fill, other)).toBe(true);
    const moved = structuredClone(other);
    moved.fixations![0]!.at.y += 0.01;
    expect(isMirror(fill, moved)).toBe(false);
    const missing = structuredClone(other);
    delete missing.fixations;
    delete missing.fixationCount;
    expect(isMirror(fill, missing)).toBe(false);
  });

  it('matches repeated names one to one: two Fr against Fl and a different Fl is not a mirror', () => {
    const at = (x: number, y: number, z: number) => ({ x, y, z });
    const one = { ...structuredClone(fill), fixationCount: 2, fixations: [{ name: 'Fr', at: at(1, 2, 3) }, { name: 'Fr', at: at(1, 2, 3) }] };
    const twin = { ...structuredClone(other), fixationCount: 2, fixations: [{ name: 'Fl', at: at(-1, 2, 3) }, { name: 'Fl', at: at(9, 9, 9) }] };
    expect(isMirror(one, twin)).toBe(false);
    twin.fixations[1] = { name: 'Fl', at: at(-1, 2, 3) };
    expect(isMirror(one, twin)).toBe(true);
  });

  it('does not pair a fill with a copy that has the same fixations unmirrored', () => {
    const same = { ...structuredClone(fill), position: { ...fill.position!, x: -fill.position!.x } };
    expect(isMirror(fill, same)).toBe(false);
  });
});

describe('findMirrors with arrays left out', () => {
  const list = () => structuredClone(parseFixture('a').report.sources);

  it('does not pair an array in the skip set, so its partner stands alone', () => {
    const base = findMirrors(list());
    expect(base.get(0)).toBe(1);
    const skipped = findMirrors(list(), new Set([0]));
    expect(skipped.has(0)).toBe(false);
    expect([...skipped.values()]).not.toContain(0);
    expect([...skipped.values()]).not.toContain(1);
    expect(skipped.size).toBe(base.size - 1);
  });

  it('lets the caller refuse a pair', () => {
    const refused = findMirrors(list(), new Set(), (i, j) => !(i === 0 && j === 1));
    expect(refused.has(0)).toBe(false);
    expect(refused.size).toBe(findMirrors(list()).size - 1);
  });
});

/** The front-back mirror image of an array: Y negated, azimuth 180 less the original, everything else as it was. */
function frontBackOf(s: ArraySource): ArraySource {
  return {
    ...structuredClone(s),
    name: s.name + ' behind',
    position: s.position && { ...s.position, y: -s.position.y },
    azimuth: s.azimuth === null ? null : 180 - s.azimuth,
    pickups: s.pickups.map((p) => ({ ...p, at: { ...p.at, y: -p.at.y } })),
  };
}

describe('front-back mirrors', () => {
  const main = () => structuredClone(a.find((s) => s.name === 'KARA II L Main')!);
  const kara = () => ({ ...main(), fixations: [], fixationCount: undefined });

  it('pairs an array with its image across Y = 0', () => {
    const one = kara();
    const two = frontBackOf(one);
    expect(isMirror(one, two, 'frontBack')).toBe(true);
    expect(isMirror(one, two)).toBe(false);
  });

  it('takes azimuths that add up to 180 modulo 360, whichever way they are printed', () => {
    for (const [x, y] of [
      [0, 180],
      [10, 170],
      [-10, -170],
      [180, 0],
      [-170, -10],
      [90, 90],
      [-90, 270],
    ] as const) {
      const one = { ...kara(), azimuth: x };
      const two = { ...frontBackOf(one), azimuth: y };
      expect(isMirror(one, two, 'frontBack'), `${x} and ${y}`).toBe(true);
    }
    const one = { ...kara(), azimuth: 10 };
    expect(isMirror(one, { ...frontBackOf(one), azimuth: 171 }, 'frontBack')).toBe(false);
  });

  it('never pairs an array whose Y is 0, and does pair one whose X is 0', () => {
    const on = { ...kara(), position: { ...kara().position!, y: 0 } };
    expect(isMirror(on, frontBackOf(on), 'frontBack')).toBe(false);
    const centre = { ...kara(), position: { ...kara().position!, x: 0 } };
    expect(isMirror(centre, frontBackOf(centre), 'frontBack')).toBe(true);
  });

  it('refuses arrays with fixations, because nobody knows whether their names swap', () => {
    const fill = structuredClone(e.find((s) => s.name === 'KARA II 2')!);
    expect(fill.fixations?.length).toBeGreaterThan(0);
    expect(isMirror(fill, frontBackOf(fill), 'frontBack')).toBe(false);
  });

  it('refuses a pair whose Panflex figures differ, and any other difference', () => {
    const one = kara();
    const two = frontBackOf(one);
    const row = two.cabinets.findIndex((c) => c.panflex !== null);
    expect(row).toBeGreaterThanOrEqual(0);
    two.cabinets[row] = { ...two.cabinets[row]!, panflex: two.cabinets[row]!.panflex!.split('/').reverse().join('/') };
    if (two.cabinets[row]!.panflex !== one.cabinets[row]!.panflex) expect(isMirror(one, two, 'frontBack')).toBe(false);
    const three = frontBackOf(one);
    three.position = { ...three.position!, y: three.position!.y + 0.01 };
    expect(isMirror(one, three, 'frontBack')).toBe(false);
  });

  it('finds left-right pairs first, so a quad of four arrays gives two left-right pairs', () => {
    const lr = { ...kara(), name: 'LR one', azimuth: 20 };
    const lr2 = { ...mirrorOf(lr), name: 'LR two' };
    // Soundvision prints azimuths between -180 and 180, so the turned copies are brought into that range.
    const wrapped = (s: ArraySource) => ({ ...s, azimuth: s.azimuth === null ? null : ((((s.azimuth + 180) % 360) + 360) % 360) - 180 });
    const fb = wrapped(frontBackOf(lr));
    const fb2 = wrapped(frontBackOf(lr2));
    const list = [lr, lr2, { ...fb, name: 'FB one' }, { ...fb2, name: 'FB two' }];
    expect([...findMirrors(list)]).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('pairs a front-back image when no left-right partner exists, and leaves the samples alone', () => {
    const one = kara();
    const list = [one, frontBackOf(one)];
    expect([...findMirrors(list)]).toEqual([[0, 1]]);
    expect(names(a).length).toBe(9);
    expect(names(b).length).toBe(8);
  });

  it('honours the skip set and the veto for front-back pairs too', () => {
    const one = kara();
    const list = [one, frontBackOf(one)];
    expect(findMirrors(list, new Set([0])).size).toBe(0);
    expect(findMirrors(list, new Set(), () => false).size).toBe(0);
  });
});

describe('left-right pairs: azimuth, group prefixes and typed offsets', () => {
  const base = a.find((s) => s.name === 'KARA II L Main')!;
  const twin = (over: Partial<ArraySource>): ArraySource => ({ ...mirrorOf(base), ...over });
  const withAz = (x: ArraySource, az: number) => ({ ...structuredClone(x), azimuth: az });

  it('treats 180 and -180 as the same heading, and pairs azimuths that add up to 0 modulo 360', () => {
    for (const [p, q] of [[180, 180], [180, -180], [-180, -180], [10, -10], [350, 10], [0, 0], [90, 270]] as const) {
      expect(isMirror(withAz(base, p), withAz(twin({}), q))).toBe(true);
    }
  });

  it('does not pair azimuths that do not add up to 0 modulo 360', () => {
    for (const [p, q] of [[10, 10], [10, -9.9], [180, 0], [90, 90]] as const) {
      expect(isMirror(withAz(base, p), withAz(twin({}), q))).toBe(false);
    }
  });

  it('leaves a pair that differs only in Configuration alone', () => {
    expect(isMirror(base, twin({ configuration: (base.configuration ?? '') + ' R' }))).toBe(false);
  });

  it('ignores YZ Sym of and XZ Sym of in front of a group name, however many, on either side', () => {
    const grouped = { ...structuredClone(base), groups: ['ALL', 'Fills 1'] };
    expect(isMirror(grouped, twin({ groups: ['ALL', 'YZ Sym of Fills 1'] }))).toBe(true);
    expect(isMirror(grouped, twin({ groups: ['ALL', 'XZ Sym of YZ Sym of Fills 1'] }))).toBe(true);
    expect(isMirror({ ...grouped, groups: ['ALL', 'YZ Sym of Fills 1'] }, twin({ groups: ['ALL', 'Fills 1'] }))).toBe(true);
    expect(isMirror(grouped, twin({ groups: ['ALL', 'Fills 2'] }))).toBe(false);
    expect(isMirror(grouped, twin({ groups: ['ALL', 'Copy of Fills 1'] }))).toBe(false);
    expect(isMirror(grouped, twin({ groups: ['ALL'] }))).toBe(false);
  });
});
