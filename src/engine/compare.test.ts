import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { compareReports, matchByName } from './compare';
import type { Report } from './types';

const a = () => structuredClone(parseFixture('a').report);
const b = () => structuredClone(parseFixture('b').report);

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
