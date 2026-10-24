// Finds arrays that are mirror images of each other, so a fly sheet can show one of the pair.
// Left to right, X and azimuth are negated and the two Panflex figures swapped. Front to back, Y is negated and the
// azimuth is 180 degrees less the other. The test is strict: every figure the sheet shows must match. If anything
// differs, even by 0.01, the arrays are not paired.

import type { ArraySource, Point3 } from './types';

const same = (a: number | null, b: number | null) => a === b;
/** An angle taken modulo 360, as the shortest distance from zero. */
const offFromZero = (turn: number) => {
  const t = ((turn % 360) + 360) % 360;
  return Math.min(t, 360 - t);
};

/** True when `b` faces the way `a` does in a mirror across the centre line: azimuths that add up to 0, taken modulo 360, so 180 and -180 are the same heading. */
function azimuthLeftRight(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return offFromZero(a + b) < 1e-9;
}

/** Soundvision's symmetry copies are named with a prefix: "YZ Sym of X" or "XZ Sym of X". The prefix is not part of the name for a pair. */
const stripSymPrefix = (name: string) => name.replace(/^(?:(?:YZ|XZ) Sym of )+/, '');

/** True when two arrays are in the same groups, once the symmetry prefixes are taken off each group name. */
const sameGroups = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((g, i) => stripSymPrefix(g) === stripSymPrefix(b[i] ?? ''));

function mirroredPoint(a: Point3 | null, b: Point3 | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === -b.x && a.y === b.y && a.z === b.z;
}

/** Fr and Fl, Rr and Rl change places in a mirror image. */
const swapSide = (name: string) => name.replace(/[rl]$/, (c) => (c === 'r' ? 'l' : 'r'));

function swapPanflex(p: string | null): string | null {
  if (p === null) return null;
  const m = /^(.+)\/(.+)$/.exec(p);
  return m ? `${m[2]}/${m[1]}` : p;
}

function mirroredFrontBack(a: Point3 | null, b: Point3 | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === -b.y && a.z === b.z;
}

/** True when `b` faces the way `a` would after a half turn about the Y axis: azimuths that add up to 180, taken modulo 360. */
function azimuthFrontBack(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return offFromZero(a + b - 180) < 1e-9;
}

/** Which way a pair is mirrored: across the centre line (X = 0), or across the line through the stage (Y = 0). */
export type MirrorAxis = 'leftRight' | 'frontBack';

/**
 * True when `b` is `a` reflected across the centre line (X = 0), or, with `frontBack`, across Y = 0. Front to back is
 * stricter. Nobody has seen how the report names the fixations or the Panflex sides of such a pair, so an array that has
 * fixations, or Panflex figures that differ from its partner's, is never paired that way.
 */
export function isMirror(a: ArraySource, b: ArraySource, across: MirrorAxis = 'leftRight'): boolean {
  if (across === 'frontBack') return isMirrorFrontBack(a, b);
  if (a.position === null || b.position === null || a.position.x === 0) return false;
  if (!sameGroups(a.groups, b.groups)) return false;
  if (a.configuration !== b.configuration || a.bumper !== b.bumper || a.motors !== b.motors) return false;
  if (!mirroredPoint(a.position, b.position)) return false;
  if (!same(a.site, b.site) || !azimuthLeftRight(a.azimuth, b.azimuth)) return false;
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

  const fa = a.fixations ?? [];
  const fb = b.fixations ?? [];
  if (fa.length !== fb.length || (a.fixationCount ?? null) !== (b.fixationCount ?? null)) return false;
  // Names can repeat, so compare the two lists sorted, A's seen in the mirror, instead of looking each one up by name.
  const seenInMirror = fa.map((f) => ({ name: swapSide(f.name), x: 0 - f.at.x, y: f.at.y, z: f.at.z }));
  const theirs = fb.map((f) => ({ name: f.name, x: f.at.x, y: f.at.y, z: f.at.z }));
  type Row = (typeof theirs)[number];
  const order = (p: Row, q: Row) => (p.name < q.name ? -1 : p.name > q.name ? 1 : p.x - q.x || p.y - q.y || p.z - q.z);
  seenInMirror.sort(order);
  theirs.sort(order);
  for (let i = 0; i < theirs.length; i++) {
    const p = seenInMirror[i];
    const q = theirs[i];
    if (!p || !q || p.name !== q.name || p.x !== q.x || p.y !== q.y || p.z !== q.z) return false;
  }

  if (a.cabinets.length !== b.cabinets.length) return false;
  for (let i = 0; i < a.cabinets.length; i++) {
    const c = a.cabinets[i];
    const d = b.cabinets[i];
    if (!c || !d) return false;
    if (c.number !== d.number || (c.column ?? null) !== (d.column ?? null) || c.type !== d.type || !same(c.angle, d.angle) || !same(c.site, d.site)) return false;
    if (!same(c.topZ, d.topZ) || !same(c.bottomZ, d.bottomZ) || swapPanflex(c.panflex) !== d.panflex) return false;
  }

  if (a.warnings.length !== b.warnings.length) return false;
  return a.warnings.every((w, i) => {
    const v = b.warnings[i];
    return v !== undefined && w.severity === v.severity && w.title === v.title && w.message === v.message;
  });
}

function isMirrorFrontBack(a: ArraySource, b: ArraySource): boolean {
  if (a.position === null || b.position === null || a.position.y === 0) return false;
  if (!sameGroups(a.groups, b.groups)) return false;
  if (a.configuration !== b.configuration || a.bumper !== b.bumper || a.motors !== b.motors) return false;
  if (!mirroredFrontBack(a.position, b.position) || !azimuthFrontBack(a.azimuth, b.azimuth)) return false;
  if (!same(a.site, b.site) || !same(a.bottomElevation, b.bottomElevation) || !same(a.topSite, b.topSite) || !same(a.bottomSite, b.bottomSite)) return false;
  const da = a.dimensions;
  const db = b.dimensions;
  if ((da === null) !== (db === null) || (da && db && (da.x !== db.x || da.y !== db.y || da.z !== db.z))) return false;
  if (JSON.stringify(a.weights) !== JSON.stringify(b.weights)) return false;

  if (a.pickups.length !== b.pickups.length) return false;
  for (let i = 0; i < a.pickups.length; i++) {
    const p = a.pickups[i];
    const q = b.pickups[i];
    if (!p || !q || p.which !== q.which || p.position !== q.position || !mirroredFrontBack(p.at, q.at)) return false;
  }

  if ((a.fixations ?? []).length > 0 || (b.fixations ?? []).length > 0) return false;
  if ((a.fixationCount ?? null) !== (b.fixationCount ?? null) || (a.fixationCount ?? 0) > 0) return false;

  if (a.cabinets.length !== b.cabinets.length) return false;
  for (let i = 0; i < a.cabinets.length; i++) {
    const c = a.cabinets[i];
    const d = b.cabinets[i];
    if (!c || !d) return false;
    if (c.number !== d.number || (c.column ?? null) !== (d.column ?? null) || c.type !== d.type || !same(c.angle, d.angle) || !same(c.site, d.site)) return false;
    if (!same(c.topZ, d.topZ) || !same(c.bottomZ, d.bottomZ) || c.panflex !== d.panflex) return false;
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
 * is in at most one pair. Left-right pairs are found first over every array, then front-back pairs among
 * those still free. Positions in `skip` are left out, and `canPair` can veto a pair.
 */
export function findMirrors(
  sources: readonly ArraySource[],
  skip: ReadonlySet<number> = new Set(),
  canPair: (a: number, b: number) => boolean = () => true,
): Map<number, number> {
  const pairs = new Map<number, number>();
  // An array left out (deleted) is never paired, so its partner stands alone.
  const taken = new Set<number>(skip);
  for (const across of ['leftRight', 'frontBack'] as const) {
    for (let i = 0; i < sources.length; i++) {
      if (taken.has(i)) continue;
      const a = sources[i];
      if (!a) continue;
      for (let j = i + 1; j < sources.length; j++) {
        const b = sources[j];
        if (taken.has(j) || !b || !canPair(i, j) || !isMirror(a, b, across)) continue;
        pairs.set(i, j);
        taken.add(i);
        taken.add(j);
        break;
      }
    }
  }
  return pairs;
}
