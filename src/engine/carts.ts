// Carts: the groups of enclosures an array is built from, usually three or four to a cart. A person drawing a card by hand puts a
// line between carts or shades every other group. Here an array has a list of cart breaks, the gaps between rows where a new cart
// starts. They come from a size for each type of enclosure, or from the person. Nothing here works out a weight or a load.

import { matchByName } from './compare';
import type { Report } from './types';

/** How many enclosures of one type make a cart. */
export interface CartSize {
  type: string;
  size: number;
}

/** The sizes a new file starts with. Soundvision prints the type as KARA II or K2, so each name is its own row. */
export const DEFAULT_CART_SIZES: readonly CartSize[] = [
  { type: 'K2', size: 4 },
  { type: 'KARA II', size: 3 },
  { type: 'KARA', size: 3 },
];

/** The largest cart size, the most sizes a file keeps and the longest type name. */
export const CART_SIZE_MAX = 24;
export const CART_SIZES_MAX = 100;
export const CART_TYPE_MAX = 100;

/** The sizes of a new file, as copies. */
export const defaultCartSizes = (): CartSize[] => DEFAULT_CART_SIZES.map((s) => ({ ...s }));

const sameType = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The cart size for a type: an exact match after trimming, ignoring case. Undefined when the type has none, so it is not cut. */
export function sizeFor(sizes: readonly CartSize[], type: string): number | undefined {
  return sizes.find((s) => sameType(s.type, type))?.size;
}

/** True when `size` is a whole number a cart can be. */
export const isCartSize = (size: unknown): size is number => typeof size === 'number' && Number.isInteger(size) && size >= 1 && size <= CART_SIZE_MAX;

/** What the carts need to know of one enclosure row. */
export interface CartRow {
  type: string;
  /** The column of a ground stack laid out in columns, or null. A cart cannot span two columns. */
  column: number | null;
}

/** The breaks no click and no file can remove: where the type changes, or the stack column does. Each is the index of the first row of a new cart. */
export function forcedBreaks(rows: readonly CartRow[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1] as CartRow;
    const b = rows[i] as CartRow;
    if (a.type.trim() !== b.type.trim() || (a.column ?? null) !== (b.column ?? null)) out.push(i);
  }
  return out;
}

/**
 * The carts of an array cut from its sizes. A run is a stretch of rows of one type in one column. Each run is cut into carts of
 * the size for its type; a type with no size, or a run no longer than its size, stays whole. A flown array, or one whose mounting
 * is not stated, is cut from the top, so a short cart is the last one. A stacked array is cut from the bottom, so it is the first.
 * Returns the index of the first row of every cart after the first.
 */
export function autoBreaks(rows: readonly CartRow[], size: (type: string) => number | undefined, mounting: 'flown' | 'stacked' | null): number[] {
  if (rows.length === 0) return [];
  const forced = forcedBreaks(rows);
  const starts = [0, ...forced];
  const out = new Set<number>(forced);
  starts.forEach((s, n) => {
    const e = starts[n + 1] ?? rows.length;
    const k = size((rows[s] as CartRow).type);
    if (k === undefined || k >= e - s) return;
    if (mounting === 'stacked') for (let b = e - k; b > s; b -= k) out.add(b);
    else for (let b = s + k; b < e; b += k) out.add(b);
  });
  return [...out].sort((a, b) => a - b);
}

/** Breaks a person or a file gave, made safe: whole numbers inside the table, with the forced ones added, sorted, once each. */
export function normaliseBreaks(breaks: readonly number[], forced: readonly number[], rows: number): number[] {
  const set = new Set<number>(forced.filter((b) => b >= 1 && b < rows));
  for (const b of breaks) if (Number.isInteger(b) && b >= 1 && b < rows) set.add(b);
  return [...set].sort((a, b) => a - b);
}

/** Add or remove the break before row `at`. A forced break cannot be removed. */
export function toggleBreak(breaks: readonly number[], at: number, forced: readonly number[], rows: number): number[] {
  const has = breaks.includes(at);
  const next = has ? breaks.filter((b) => b !== at) : [...breaks, at];
  return normaliseBreaks(next, forced, rows);
}

/** The sizes of the carts, top to bottom, from the breaks: [4, 4, 3, 3]. An empty table has none. */
export function groupsOf(breaks: readonly number[], rows: number): number[] {
  if (rows <= 0) return [];
  const edges = [0, ...breaks.filter((b) => b > 0 && b < rows), rows];
  return edges.slice(1).map((e, i) => e - (edges[i] as number));
}

/** Which rows are shaded on a printed card: every other cart, counted from the top, with the first one white. */
export function cartShade(breaks: readonly number[], rows: number): boolean[] {
  const out: boolean[] = [];
  groupsOf(breaks, rows).forEach((size, g) => {
    for (let i = 0; i < size; i++) out.push(g % 2 === 1);
  });
  return out;
}

/** The summary a person reads: "4 + 4 + 3 + 3", or "14, one block" when there are no breaks. */
export function groupsText(groups: readonly number[]): string {
  if (groups.length === 0) return 'none';
  if (groups.length === 1) return `${groups[0]}, one block`;
  return groups.join(' + ');
}

/** The rows of a report array as the carts see them. */
export function cartRows(cabinets: readonly { type: string; column?: number | null | undefined }[]): CartRow[] {
  return cabinets.map((c) => ({ type: c.type, column: c.column ?? null }));
}

/** What follows from Update from PDF: the hand cut carts that carry over, by position in the new report, and the ones that cannot. */
export interface TrackedCarts {
  kept: Record<number, number[]>;
  reset: { array: string; groups: string }[];
}

/**
 * Update from PDF keeps an array's hand cut carts when the array of the same name has the same number of rows in the same order of
 * types. Otherwise the array goes back to automatic and is listed. An array that was automatic needs nothing.
 */
export function trackCarts(saved: Report, next: Report, carts: Readonly<Record<number, readonly number[]>>): TrackedCarts {
  const map = matchByName(saved, next);
  const kept: Record<number, number[]> = {};
  const reset: TrackedCarts['reset'] = [];
  for (const [key, breaks] of Object.entries(carts)) {
    const i = Number(key);
    const j = map.get(i);
    if (j === undefined) continue;
    const was = saved.sources[i]?.cabinets ?? [];
    const now = next.sources[j]?.cabinets ?? [];
    const same = was.length === now.length && was.every((c, n) => c.type.trim() === (now[n] as { type: string }).type.trim() && (c.column ?? null) === ((now[n] as { column?: number | null }).column ?? null));
    if (same) kept[j] = [...breaks];
    else reset.push({ array: saved.sources[i]?.name ?? '', groups: groupsText(groupsOf(breaks, was.length)) });
  }
  return { kept, reset };
}

/** The colour of a shaded group on a printed card. Neutral grey, so it prints the same in mono: luma 235, 20 below white. */
export const CART_SHADE = '#ebebeb';
