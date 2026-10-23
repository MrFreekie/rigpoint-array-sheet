// Expected values come from the owner's sample fly sheet output (report A and report B), where
// Top Height is the array's Position Z and Btm Height is its Bottom elevation, less the ground offset.

import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { rng } from '../testing/random';
import { flySheetColumn, minus, parseOffset, riggingFixations, riggingNote, riggingRows } from './sheet';
import type { ArraySource } from './types';

const a = parseFixture('a').report.sources;
const b = parseFixture('b').report.sources;
const e = parseFixture('e').report.sources;
const named = (list: ArraySource[], name: string) => {
  const s = list.find((x) => x.name === name);
  if (!s) throw new Error(name);
  return s;
};

describe('flySheetColumn, report A', () => {
  it('left main', () => {
    const c = flySheetColumn(named(a, 'KARA II L Main'));
    expect(c).toMatchObject({
      name: 'KARA II L Main', group: 'MAINS', totalMass: 414.2, groundOffset: 0,
      topHeight: 9.4, bottomHeight: 5.75, topSite: 3.8, bottomSite: -41.2, azimuth: 0,
      bumper: 'M-BUMP+MBAR hole A', motors: 1,
    });
    expect(c.rows).toHaveLength(15);
    expect(c.rows[0]?.angle).toBe(5);
    expect(c.rows[14]?.panflex?.text).toBe('90 On');
  });

  it('left out hang heights and sites', () => {
    expect(flySheetColumn(named(a, 'KARA II L Out'))).toMatchObject({ topHeight: 9.4, bottomHeight: 8.02, topSite: -0.8, bottomSite: -43.3 });
  });

  it('a lip fill has no bumper and its own group', () => {
    expect(flySheetColumn(named(a, 'X8 2'))).toMatchObject({ group: 'LIPFILL', totalMass: 12, topHeight: 2, bottomHeight: 1.88, bumper: null });
  });

  it('takes the ground offset off both heights', () => {
    expect(flySheetColumn(named(a, 'KARA II L Main'), 0.3)).toMatchObject({ groundOffset: 0.3, topHeight: 9.1, bottomHeight: 5.45 });
  });
});

describe('flySheetColumn, report B', () => {
  it('two-motor array', () => {
    const c = flySheetColumn(named(b, 'FL KARA II L'));
    expect(c).toMatchObject({ group: null, totalMass: 235.4, frontMotorLoad: 182.7, rearMotorLoad: 52.7, topHeight: 8.5, bottomHeight: 6.58, topSite: 22.3, bottomSite: -30.7 });
    expect(c.pickups.map((p) => p.position)).toEqual([16, 0]);
  });

  it('ground stack keeps the report order and blank angles', () => {
    const c = flySheetColumn(named(b, 'GS KARA II L'));
    expect(c.rows.map((r) => [r.number, r.type, r.angle])).toEqual([
      [6, 'KARA II', 4], [5, 'KARA II', 2], [4, 'KARA II', 10], [3, 'KARA II', 0], [2, 'SB18', null], [1, 'SB18', null],
    ]);
    expect(c.rows[4]?.panflex).toBeNull();
  });
});

describe('riggingRows', () => {
  it('matches the sample rigging sheet for report B', () => {
    expect(riggingRows(b).filter((r) => r.source.startsWith('FL'))).toEqual([
      { source: 'FL KARA II L', location: 'Front', pickupPosition: 16, x: 7.5, y: 3.91, z: 8.71, load: 182.7 },
      { source: 'FL KARA II L', location: 'Rear', pickupPosition: 0, x: 7.5, y: 3.08, z: 8.37, load: 52.7 },
      { source: 'FL KARA II R', location: 'Front', pickupPosition: 16, x: -7.5, y: 3.91, z: 8.71, load: 182.7 },
      { source: 'FL KARA II R', location: 'Rear', pickupPosition: 0, x: -7.5, y: 3.08, z: 8.37, load: 52.7 },
    ]);
  });

  it('matches the sample rigging sheet for report A: one row per flown main and out hang', () => {
    const rows = riggingRows(a);
    expect(rows.map((r) => [r.source, r.x, r.y, r.z, r.load])).toEqual([
      ['KARA II L Main', 10, 12.68, 9.51, 414.2],
      ['KARA II R Main', -10, 12.68, 9.51, 414.2],
      ['KARA II L Out', 17.36, 11.64, 9.53, 184.3],
      ['KARA II R Out', -17.36, 11.64, 9.53, 184.3],
    ]);
  });
});

describe('riggingRows for some arrays only', () => {
  it('lists only the pickups of the arrays given', () => {
    expect(riggingRows(a, new Set([0, 3])).map((r) => r.source)).toEqual(['KARA II L Main', 'KARA II R Out']);
  });

  it('lists nothing when no array is given, and everything when none is asked for', () => {
    expect(riggingRows(a, new Set())).toEqual([]);
    expect(riggingRows(a)).toHaveLength(4);
  });

  it('ignores arrays with no pickups', () => {
    expect(riggingRows(a, new Set([4, 8]))).toEqual([]);
  });
});

describe('minus', () => {
  it('keeps the report precision, with no floating point tails', () => {
    expect(minus(8.5, 0.3)).toBe(8.2);
    expect(minus(9.4, 0.1)).toBe(9.3);
    expect(minus(null, 1)).toBeNull();
  });

  it('property: adding the offset back gives the original, and a zero offset changes nothing', () => {
    const r = rng(5);
    for (let i = 0; i < 500; i++) {
      const value = r.int(0, 3000) / 100;
      const offset = r.int(-500, 500) / 100;
      const lowered = minus(value, offset) as number;
      expect(minus(lowered, -offset)).toBe(value);
      expect(minus(value, 0)).toBe(value);
    }
  });
});

describe('parseOffset', () => {
  it.each([
    ['', 0], ['  ', 0], ['0', 0], ['0.3', 0.3], ['-1.25', -1.25], ['−1', -1], [' 2 ', 2],
  ])('reads %j as %j', (text, expected) => expect(parseOffset(text)).toBe(expected));

  it.each(['abc', '1,5', '1.', '.5', '1e3', '--1', '1 m'])('rejects %j', (text) => expect(parseOffset(text)).toBeNull());
});

describe('riggingFixations, report E', () => {
  const index = (name: string) => e.findIndex((s) => s.name === name);

  it('lists the four positions of every stack, as printed and in report order', () => {
    const rows = riggingFixations(e);
    const stacks = e.filter((s) => (s.fixations?.length ?? 0) > 0);
    expect(rows).toHaveLength(stacks.length * 4);
    expect(rows.slice(0, 4).map((r) => [r.source, r.name, r.x, r.y, r.z])).toEqual(
      (stacks[0]?.fixations ?? []).map((f) => [stacks[0]?.name, f.name, f.at.x, f.at.y, f.at.z]),
    );
    expect(rows.filter((r) => r.source === 'KARA II 2')).toEqual([
      { source: 'KARA II 2', name: 'Fr', x: -2.84, y: 4.6, z: 1 },
      { source: 'KARA II 2', name: 'Fl', x: -2.16, y: 4.6, z: 1 },
      { source: 'KARA II 2', name: 'Rr', x: -2.84, y: 3.9, z: 1 },
      { source: 'KARA II 2', name: 'Rl', x: -2.16, y: 3.9, z: 1 },
    ]);
  });

  it('includes the stack that collapses into a mirror, with its own four positions', () => {
    const rows = riggingFixations(e).filter((r) => r.source === 'KARA II 1');
    expect(rows.map((r) => r.name)).toEqual(['Fr', 'Fl', 'Rr', 'Rl']);
    expect(rows.map((r) => r.x)).toEqual((named(e, 'KARA II 1').fixations ?? []).map((f) => f.at.x));
  });

  it('lists only the arrays chosen, and nothing for an array without fixations', () => {
    expect(new Set(riggingFixations(e, new Set([index('KARA II 2')])).map((r) => r.source))).toEqual(new Set(['KARA II 2']));
    expect(riggingFixations(e, new Set([index('KS28 4')]))).toEqual([]);
    expect(riggingFixations(e, new Set())).toEqual([]);
    expect(riggingFixations(a)).toEqual([]);
  });
});

describe('riggingNote', () => {
  it('names only what is listed', () => {
    expect(riggingNote(true, true)).toBe('Every pickup and fixation is listed, including those of mirrored arrays, because their positions differ.');
    expect(riggingNote(true, false)).toBe('Every pickup is listed, including those of mirrored arrays, because their positions differ.');
    expect(riggingNote(false, true)).toBe('Every fixation is listed, including those of mirrored arrays, because their positions differ.');
    expect(riggingNote(false, false)).toBeNull();
  });
});

describe('flySheetColumn fixations, report E', () => {
  it('copies the fixations as printed, and does not take the ground offset off their Z', () => {
    const c = flySheetColumn(named(e, 'KARA II 2'), 0.3);
    expect(c.fixations).toEqual([
      { name: 'Fr', at: { x: -2.84, y: 4.6, z: 1 } },
      { name: 'Fl', at: { x: -2.16, y: 4.6, z: 1 } },
      { name: 'Rr', at: { x: -2.84, y: 3.9, z: 1 } },
      { name: 'Rl', at: { x: -2.16, y: 3.9, z: 1 } },
    ]);
    expect(c.topHeight).toBe(0.7);
  });

  it('has none for an array that states none', () => {
    expect(flySheetColumn(named(e, 'KS28 4')).fixations).toEqual([]);
    expect(flySheetColumn(named(a, 'X8 2')).fixations).toEqual([]);
  });
});
