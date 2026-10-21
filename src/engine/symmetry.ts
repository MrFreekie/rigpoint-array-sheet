// Finds arrays that are left-right mirror images of each other, so a fly sheet can show one of the pair.
// The test is strict: every figure the sheet shows must match, with X and azimuth negated and the
// two Panflex figures swapped. If anything differs, even by 0.01, the arrays are not paired.

import type { ArraySource, Point3 } from './types';

const same = (a: number | null, b: number | null) => a === b;
const mirrored = (a: number | null, b: number | null) => (a === null || b === null ? a === b : a === -b);

function mirroredPoint(a: Point3 | null, b: Point3 | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === -b.x && a.y === b.y && a.z === b.z;
}

function swapPanflex(p: string | null): string | null {
  if (p === null) return null;
  const m = /^(.+)\/(.+)$/.exec(p);
  return m ? `${m[2]}/${m[1]}` : p;
}

/** True when `b` is `a` reflected across the centre line (X = 0). */
export function isMirror(a: ArraySource, b: ArraySource): boolean {
  if (a.position !== null && a.position.x === 0) return false;
  if (a.groups.length !== b.groups.length || a.groups.some((g, i) => g !== b.groups[i])) return false;
  if (a.configuration !== b.configuration || a.bumper !== b.bumper || a.motors !== b.motors) return false;
  if (!mirroredPoint(a.position, b.position)) return false;
  if (!same(a.site, b.site) || !mirrored(a.azimuth, b.azimuth)) return false;
  if (!same(a.bottomElevation, b.bottomElevation) || !same(a.topSite, b.topSite) || !same(a.bottomSite, b.bottomSite)) return false;
  const da = a.dimensions;
  const db = b.dimensions;
  if ((da === null) !== (db === null) || (da && db && (da.x !== db.x || da.y !== db.y || da.z !== db.z))) return false;
  if (JSON.stringify(a.weights) !== JSON.stringify(b.weights)) return false;

  if (a.pickups.length !== b.pickups.length) return false;
  for (let i = 0; i < a.pickups.length; i++) {
    const p = a.pickups[i];
    const q = b.pickups[i];
    if (!p || !q || p.which !== q.which || p.position !== q.position || !mirroredPoint(p.at, q.at)) return false;
  }

  if (a.cabinets.length !== b.cabinets.length) return false;
  for (let i = 0; i < a.cabinets.length; i++) {
    const c = a.cabinets[i];
    const d = b.cabinets[i];
    if (!c || !d) return false;
    if (c.number !== d.number || c.type !== d.type || !same(c.angle, d.angle) || !same(c.site, d.site)) return false;
    if (!same(c.topZ, d.topZ) || !same(c.bottomZ, d.bottomZ) || swapPanflex(c.panflex) !== d.panflex) return false;
  }

  if (a.warnings.length !== b.warnings.length) return false;
  return a.warnings.every((w, i) => {
    const v = b.warnings[i];
    return v !== undefined && w.severity === v.severity && w.title === v.title && w.message === v.message;
  });
}

/**
 * Pairs each array with its mirror image, the first in report order being the one to show.
 * Returns a map from the index of the array to show to the index of its mirror. Each array
 * is in at most one pair.
 */
export function findMirrors(sources: readonly ArraySource[]): Map<number, number> {
  const pairs = new Map<number, number>();
  const taken = new Set<number>();
  for (let i = 0; i < sources.length; i++) {
    if (taken.has(i)) continue;
    const a = sources[i];
    if (!a) continue;
    for (let j = i + 1; j < sources.length; j++) {
      const b = sources[j];
      if (taken.has(j) || !b || !isMirror(a, b)) continue;
      pairs.set(i, j);
      taken.add(i);
      taken.add(j);
      break;
    }
  }
  return pairs;
}
