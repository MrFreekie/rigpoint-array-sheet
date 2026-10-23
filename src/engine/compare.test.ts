import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { compareReports, matchByName } from './compare';
import type { Report } from './types';

const a = () => structuredClone(parseFixture('a').report);
const b = () => structuredClone(parseFixture('b').report);
const e = () => structuredClone(parseFixture('e').report);

describe('compareReports', () => {
  it('finds nothing when the reports are the same', () => {
    expect(compareReports(a(), a())).toEqual([]);
    expect(compareReports(b(), b())).toEqual([]);
  });

  it('names the array, the figure, and the old and new values', () => {
    const next = a();
    next.sources[0]!.weights.total = 420;
    expect(compareReports(a(), next)).toEqual([
      { kind: 'changed', array: 'KARA II L Main', what: 'Total weight', saved: '414.2', now: '420' },
    ]);
  });

  it('reports a changed enclosure row in full', () => {
    const next = a();
    next.sources[0]!.cabinets[2]!.angle = 3;
    const changes = compareReports(a(), next);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: 'changed', array: 'KARA II L Main', what: 'Enclosure #3' });
    expect(changes[0]?.saved).toContain('angle 2');
    expect(changes[0]?.now).toContain('angle 3');
  });

  it('reports a change in C1 #1 apart from C2 #1', () => {
    const d = () => structuredClone(parseFixture('d').report);
    const next = d();
    const source = next.sources.find((s) => s.name === 'SB28 L')!;
    source.cabinets.find((c) => c.column === 1)!.topZ = 1.5;
    const changes = compareReports(d(), next);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: 'changed', array: 'SB28 L', what: 'Enclosure C1 #1' });
  });

  it('reports added and removed enclosures, pickups and warnings', () => {
    const next = a();
    next.sources[0]!.cabinets.pop();
    next.sources[4]!.warnings.push({ severity: 'CAUTION', title: 'New', message: 'Something' });
    const changes = compareReports(a(), next);
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'removed', array: 'KARA II L Main', what: 'Enclosure #15' }));
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'added', array: 'SB28 L Front', what: 'Warning 3' }));
  });

  it('reports an array that is only in one of the reports', () => {
    const next = a();
    next.sources.splice(2, 1);
    next.sources.push({ ...structuredClone(next.sources[0]!), name: 'Brand new' });
    const changes = compareReports(a(), next);
    expect(changes).toContainEqual({ kind: 'removed', array: 'KARA II L Out', what: 'Array', saved: 'in the saved file', now: null });
    expect(changes).toContainEqual({ kind: 'added', array: 'Brand new', what: 'Array', saved: null, now: 'in the new PDF' });
  });

  it('reports changes to the report as a whole', () => {
    const next: Report = a();
    next.document.version = '2026.4.0';
    expect(compareReports(a(), next)).toEqual([
      { kind: 'changed', array: null, what: 'Soundvision version', saved: '2026.3.1', now: '2026.4.0' },
    ]);
  });

  it('is not fooled by arrays being in a different order', () => {
    const next = a();
    next.sources.reverse();
    expect(compareReports(a(), next)).toEqual([]);
  });

  it('matches two arrays with the same name in the order they appear', () => {
    const base = a();
    base.sources[1]!.name = base.sources[0]!.name;
    const next = structuredClone(base);
    next.sources[1]!.weights.total = 1;
    const changes = compareReports(base, next);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ what: 'Total weight', saved: '414.2', now: '1' });
  });
});

describe('matchByName', () => {
  it('maps each saved array to its place in the new report', () => {
    const saved = a();
    const next = a();
    next.sources.reverse();
    const m = matchByName(saved, next);
    expect(m.get(0)).toBe(17);
    expect(m.get(17)).toBe(0);
    expect(m.size).toBe(18);
  });

  it('leaves out an array that is no longer there', () => {
    const next = a();
    next.sources.splice(0, 1);
    const m = matchByName(a(), next);
    expect(m.has(0)).toBe(false);
    expect(m.get(1)).toBe(0);
  });
});

describe('compareReports and fixations', () => {
  it('finds nothing when the reports are the same', () => {
    expect(compareReports(e(), e())).toEqual([]);
  });

  it('names a fixation that moved', () => {
    const next = e();
    next.sources[10]!.fixations![0]!.at.x = -2.9;
    expect(compareReports(e(), next)).toEqual([
      { kind: 'changed', array: 'KARA II 2', what: 'Fixation Fr', saved: '-2.84, 4.6, 1', now: '-2.9, 4.6, 1' },
    ]);
  });

  it('lists a change to either of two fixations that share a name', () => {
    const twice = (second: number) => {
      const r = e();
      r.sources[10]!.fixations = [{ name: 'Fr', at: { x: 1, y: 2, z: 3 } }, { name: 'Fr', at: { x: second, y: 5, z: 6 } }];
      return r;
    };
    expect(compareReports(twice(4), twice(4))).toEqual([]);
    expect(compareReports(twice(4), twice(7))).toEqual([
      { kind: 'changed', array: 'KARA II 2', what: 'Fixation Fr #2', saved: '4, 5, 6', now: '7, 5, 6' },
    ]);
    const first = twice(4);
    first.sources[10]!.fixations![0]!.at.x = 7;
    expect(compareReports(twice(4), first)).toEqual([
      { kind: 'changed', array: 'KARA II 2', what: 'Fixation Fr', saved: '1, 2, 3', now: '7, 2, 3' },
    ]);
  });

  it('names a fixation that is gone, and the count', () => {
    const next = e();
    next.sources[10]!.fixations!.pop();
    next.sources[10]!.fixationCount = 3;
    expect(compareReports(e(), next)).toEqual([
      { kind: 'changed', array: 'KARA II 2', what: 'Fixations', saved: '4', now: '3' },
      { kind: 'removed', array: 'KARA II 2', what: 'Fixation Rl', saved: '-2.16, 3.9, 1', now: null },
    ]);
  });
});
