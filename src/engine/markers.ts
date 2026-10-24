// The pickup symbols of the rigging plot: four shapes that stand for a nominal rating, picked for each pickup, with
// optional typed text in place of the rating. A symbol is a guide only. Nothing here works out a load.

import { matchByName } from './compare';
import type { Report } from './types';

/** The four symbols: 2 ton, 1 ton (the default), half ton and quarter ton. Metric tonnes. */
export const SHAPES = ['two', 'one', 'half', 'quarter'] as const;
export type Shape = (typeof SHAPES)[number];

/** The nominal rating of each symbol, in kilograms. */
export const RATING_KG: Record<Shape, number> = { two: 2000, one: 1000, half: 500, quarter: 250 };
/** How each rating is written on the plot, in the table and in the picker. */
export const RATING_LABEL: Record<Shape, string> = { two: '2 t', one: '1 t', half: '0.5 t', quarter: '0.25 t' };
/** What each shape looks like, for the picker and the legend. */
export const SHAPE_NAME: Record<Shape, string> = {
  two: 'square with a cross',
  one: 'circle with a cross',
  half: 'triangle with a vertical line',
  quarter: 'diamond with a cross',
};

/** The longest typed value for a symbol. */
export const MARKER_TEXT_MAX = 12;

export interface Marker {
  shape: Shape;
  /** Typed text shown in place of the rating, such as "1.5 t". Blank means the rating of the shape. */
  text: string;
}

/** The choice for the front and the rear pickup of one array. A single pickup uses the one that matches its side. */
export interface MarkerPair {
  front: Marker;
  rear: Marker;
}

export type PickupSide = keyof MarkerPair;

export const DEFAULT_MARKER: Marker = { shape: 'one', text: '' };

export const defaultPair = (): MarkerPair => ({ front: { ...DEFAULT_MARKER }, rear: { ...DEFAULT_MARKER } });

export const sameMarker = (a: Marker, b: Marker): boolean => a.shape === b.shape && a.text.trim() === b.text.trim();
export const isDefaultMarker = (m: Marker): boolean => sameMarker(m, DEFAULT_MARKER);
export const isDefaultPair = (p: MarkerPair): boolean => isDefaultMarker(p.front) && isDefaultMarker(p.rear);

/** Typed text is one line of plain text, at most MARKER_TEXT_MAX characters. */
export function cleanMarkerText(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, MARKER_TEXT_MAX);
}

/** True when the symbol carries typed text of its own. */
export const isCustom = (m: Marker): boolean => m.text.trim() !== '';

/** What a symbol is worth as written: the typed text, else the rating of its shape. */
export const markerValue = (m: Marker): string => (isCustom(m) ? m.text.trim() : RATING_LABEL[m.shape]);

/** True when a shape's rating is below the stated total weight of the array. A guide only. */
export const shapeBelow = (shape: Shape, total: number | null): boolean => total !== null && RATING_KG[shape] < total;

/** A symbol is drawn grey when its rating is below the array's stated total weight. Typed text is never greyed. */
export const isGreyed = (m: Marker, total: number | null): boolean => !isCustom(m) && shapeBelow(m.shape, total);

export interface MarkerLine {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface MarkerCircle {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
}
export type MarkerPrim = MarkerLine | MarkerCircle;

/**
 * The strokes of a symbol of overall width `size`, centred on (0, 0) with y up. The caller moves them to the pickup
 * and turns y over where its own y runs down.
 */
export function markerPrims(shape: Shape, size: number): MarkerPrim[] {
  const r = size / 2;
  const line = (x1: number, y1: number, x2: number, y2: number): MarkerLine => ({ kind: 'line', x1, y1, x2, y2 });
  const polygon = (pts: [number, number][]): MarkerLine[] =>
    pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length] as [number, number];
      return line(p[0], p[1], q[0], q[1]);
    });
  switch (shape) {
    case 'two':
      return [...polygon([[-r, -r], [r, -r], [r, r], [-r, r]]), line(-r, 0, r, 0), line(0, -r, 0, r)];
    case 'one':
      return [{ kind: 'circle', cx: 0, cy: 0, r }, line(-r, 0, r, 0), line(0, -r, 0, r)];
    case 'half':
      return [...polygon([[0, r], [r, -0.8 * r], [-r, -0.8 * r]]), line(0, r, 0, -0.8 * r)];
    default:
      return [...polygon([[0, r], [r, 0], [0, -r], [-r, 0]]), line(-r, 0, r, 0), line(0, -r, 0, r)];
  }
}

/** The side of a pickup an array's choice applies to. */
export const pickupSide = (which: 'front' | 'rear'): PickupSide => which;

/** What follows from Update from PDF: the choices that carry over, by position in the new report, and the ones that cannot. */
export interface TrackedMarkers {
  kept: Record<number, MarkerPair>;
  reset: { array: string; side: PickupSide; value: string }[];
}

/**
 * Update from PDF keeps a symbol when the array of the same name still has the same pickup, the front or the rear one with
 * the same position number. A symbol it cannot follow goes back to the default and is listed, so the person can be told.
 */
export function trackMarkers(saved: Report, next: Report, markers: Readonly<Record<number, MarkerPair>>): TrackedMarkers {
  const map = matchByName(saved, next);
  const kept: Record<number, MarkerPair> = {};
  const reset: TrackedMarkers['reset'] = [];
  for (const [key, pair] of Object.entries(markers)) {
    const i = Number(key);
    const old = saved.sources[i];
    const j = map.get(i);
    const now = j === undefined ? undefined : next.sources[j];
    const out = defaultPair();
    for (const side of ['front', 'rear'] as const) {
      const m = pair[side];
      if (isDefaultMarker(m)) continue;
      const was = old?.pickups.find((p) => p.which === side);
      const is = now?.pickups.find((p) => p.which === side);
      if (was && is && was.position === is.position) out[side] = { ...m };
      else reset.push({ array: old?.name ?? '', side, value: markerValue(m) });
    }
    if (j !== undefined && !isDefaultPair(out)) kept[j] = out;
  }
  return { kept, reset };
}
