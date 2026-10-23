// The geometry behind the rigging plot: where each flown or stacked array sits on the plan and which pickup gets which number.
// It reads the report's Position, Spatial dimensions and Azimuth as printed and turns them into a box on the plan.
// Nothing here works out a load, an angle or a height. The one figure it derives is the plan distance between an array's
// front and rear pickups, from their X and Y only.

import type { ArraySource, Pickup, Point3 } from './types';

export interface Pt2 {
  x: number;
  y: number;
}

/** Arrays whose Position y differ by no more than this many metres count as one row when numbering. */
export const BAND_TOLERANCE_M = 1;

export interface PlotArray {
  /** Position of the array in the report. */
  index: number;
  name: string;
  /** Hung from the rig, or standing on the ground. A stack has no pickups. */
  kind: 'flown' | 'stacked';
  /** The array Position as printed. */
  position: Point3;
  /** Front left, front right, rear right, rear left, as seen looking the way the array points. */
  corners: [Pt2, Pt2, Pt2, Pt2];
  pickups: Pickup[];
  frontMotorLoad: number | null;
  rearMotorLoad: number | null;
  totalWeight: number | null;
}

export interface PlotPoint {
  /** PA1, PA2 ... */
  label: string;
  number: number;
  /** Position of the array in the report. */
  arrayIndex: number;
  source: string;
  which: 'front' | 'rear';
  /** The pickup position number as the report prints it. */
  pickupPosition: number;
  at: Point3;
  load: number | null;
  /** On a front pickup whose array also has a rear one: the plan distance between the two, in metres to 2 decimals. */
  spacing: number | null;
}

/** The distance between two pickups on the plan, from X and Y only (never Z), rounded to 2 decimals. */
export function planSpacing(a: Pt2, b: Pt2): number {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 100) / 100;
}

/**
 * The box of an array on the plan. Position x is the middle of the front edge and Position y is that edge; the box
 * runs rearward from it, turned about the Position by the azimuth, which is read as a compass bearing: clockwise from +Y.
 * Null when the report does not state a position, a size or an azimuth.
 */
export function footprint(s: Pick<ArraySource, 'position' | 'dimensions' | 'azimuth'>): [Pt2, Pt2, Pt2, Pt2] | null {
  const { position, dimensions } = s;
  if (!position || !dimensions || s.azimuth === null) return null;
  const a = (s.azimuth * Math.PI) / 180;
  const across = { x: Math.cos(a), y: -Math.sin(a) };
  const rearward = { x: -Math.sin(a), y: -Math.cos(a) };
  const half = dimensions.x / 2;
  const depth = dimensions.y;
  const at = (w: number, d: number): Pt2 => ({
    x: position.x + across.x * w + rearward.x * d,
    y: position.y + across.y * w + rearward.y * d,
  });
  return [at(-half, 0), at(half, 0), at(half, depth), at(-half, depth)];
}

export interface PlotArrays {
  drawn: PlotArray[];
  /** Names of arrays the plot cannot draw because the report lacks a position, a size or an azimuth. */
  notDrawn: string[];
}

/** The flown and stacked arrays of the report, in report order. `include` limits them to some positions in the report. */
export function plotArrays(sources: readonly ArraySource[], include?: ReadonlySet<number>): PlotArrays {
  const drawn: PlotArray[] = [];
  const notDrawn: string[] = [];
  sources.forEach((s, index) => {
    if (s.mounting !== 'flown' && s.mounting !== 'stacked') return;
    if (include && !include.has(index)) return;
    const corners = footprint(s);
    if (!corners || !s.position) {
      notDrawn.push(s.name);
      return;
    }
    drawn.push({
      index,
      name: s.name,
      kind: s.mounting,
      position: s.position,
      corners,
      pickups: s.pickups,
      frontMotorLoad: s.weights.frontMotorLoad,
      rearMotorLoad: s.weights.rearMotorLoad,
      totalWeight: s.weights.total,
    });
  });
  return { drawn, notDrawn };
}

/**
 * Numbers the pickups PA1, PA2 ... Arrays go in rows by Position y from the highest (nearest the audience) to the lowest,
 * a row being arrays within `toleranceM` of the first one in it. Inside a row the highest x (house left) comes first.
 * An array's front pickup has the lower number. Arrays with no pickup are not numbered.
 */
export function numberPickups(arrays: readonly PlotArray[], toleranceM = BAND_TOLERANCE_M): PlotPoint[] {
  const withPickups = arrays.filter((a) => a.pickups.length > 0).sort((a, b) => b.position.y - a.position.y);
  const bands: PlotArray[][] = [];
  let anchor = Number.NaN;
  for (const a of withPickups) {
    if (bands.length > 0 && anchor - a.position.y <= toleranceM) {
      bands[bands.length - 1]?.push(a);
    } else {
      bands.push([a]);
      anchor = a.position.y;
    }
  }
  const points: PlotPoint[] = [];
  for (const band of bands) {
    for (const a of band.sort((p, q) => q.position.x - p.position.x)) {
      const ordered = [...a.pickups].sort((p, q) => (p.which === q.which ? 0 : p.which === 'front' ? -1 : 1));
      const front = ordered.find((p) => p.which === 'front');
      const rear = ordered.find((p) => p.which === 'rear');
      for (const p of ordered) {
        const number = points.length + 1;
        points.push({
          label: `PA${number}`,
          number,
          arrayIndex: a.index,
          source: a.name,
          which: p.which,
          pickupPosition: p.position,
          at: p.at,
          load: p.which === 'front' ? a.frontMotorLoad : a.rearMotorLoad,
          spacing: p === front && rear ? planSpacing(front.at, rear.at) : null,
        });
      }
    }
  }
  return points;
}
