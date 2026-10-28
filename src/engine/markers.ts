// The pickup symbols of the rigging plot: four shapes, picked for each pickup. Each shape has a value written for it, such
// as "1 t", set once for the whole job in Settings. A symbol is a guide only. Nothing here works out a load.

import { matchByName } from './compare';
import type { Report } from './types';

/** The four symbols: 2 ton, 1 ton (the default), half ton and quarter ton. Metric tonnes. */
export const SHAPES = ['two', 'one', 'half', 'quarter'] as const;
export type Shape = (typeof SHAPES)[number];

/** The value written for each symbol until the person changes it in Settings, in metric tonnes. */
export const DEFAULT_SYMBOL_VALUES: Readonly<Record<Shape, string>> = { two: '2 t', one: '1 t', half: '0.5 t', quarter: '0.25 t' };
/** What each shape looks like, for the picker and the legend. */
export const SHAPE_NAME: Record<Shape, string> = {
  two: 'square with a cross',
  one: 'circle with a cross',
  half: 'triangle with a cross',
  quarter: 'diamond with a cross',
};

/** The longest value for a symbol. */
export const SYMBOL_VALUE_MAX = 12;

/** The value written for each of the four shapes. Set once for the job. */
export type SymbolValues = Record<Shape, string>;

export const defaultSymbolValues = (): SymbolValues => ({ ...DEFAULT_SYMBOL_VALUES });

/** A value is one line of plain text, at most SYMBOL_VALUE_MAX characters. */
export function cleanSymbolValue(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, SYMBOL_VALUE_MAX);
}

/** The value of a shape. A blank one falls back to the default. */
export function symbolValue(values: Readonly<Record<Shape, string>>, shape: Shape): string {
  return cleanSymbolValue(values[shape]).trim() || DEFAULT_SYMBOL_VALUES[shape];
}

export const sameSymbolValues = (a: Readonly<Record<Shape, string>>, b: Readonly<Record<Shape, string>>): boolean =>
  SHAPES.every((shape) => symbolValue(a, shape) === symbolValue(b, shape));

export interface Marker {
  shape: Shape;
}

/** The choice for the front and the rear pickup of one array. A single pickup uses the one that matches its side. */
export interface MarkerPair {
  front: Marker;
  rear: Marker;
}

export type PickupSide = keyof MarkerPair;

export const DEFAULT_MARKER: Marker = { shape: 'one' };

export const defaultPair = (): MarkerPair => ({ front: { ...DEFAULT_MARKER }, rear: { ...DEFAULT_MARKER } });

export const isDefaultMarker = (m: Marker): boolean => m.shape === DEFAULT_MARKER.shape;
export const isDefaultPair = (p: MarkerPair): boolean => isDefaultMarker(p.front) && isDefaultMarker(p.rear);

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
      // The side edges run from the apex (0, r) to the base corners (+-r, -0.8r), so at y = 0 the triangle is r / 1.8 either side.
      return [...polygon([[0, r], [r, -0.8 * r], [-r, -0.8 * r]]), line(0, r, 0, -0.8 * r), line(-r / 1.8, 0, r / 1.8, 0)];
    default:
      return [...polygon([[0, r], [r, 0], [0, -r], [-r, 0]]), line(-r, 0, r, 0), line(0, -r, 0, r)];
  }
}

/** What follows from Update from PDF: the choices that carry over, by position in the new report, and the ones that cannot. */
export interface TrackedMarkers {
  kept: Record<number, MarkerPair>;
  reset: { array: string; side: PickupSide; shape: Shape }[];
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
      else reset.push({ array: old?.name ?? '', side, shape: m.shape });
    }
    if (j !== undefined && !isDefaultPair(out)) kept[j] = out;
  }
  return { kept, reset };
}
