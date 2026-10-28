// Additional weight: a figure the person types for a pickup, in kilograms, for something the report does not include (a
// bridle, a hoist, a lighting bar). It is the only sum the app makes. The report's own figures are never changed: the
// typed weight is added to a pickup's motor load and to its array's stated total, and always shown as a separate item.
// All sums are made in whole hundredths of a kilogram, so no figure is ever printed as 589.8000001.

import { matchByName } from './compare';
import type { Report } from './types';

/** The largest additional weight for one pickup, in kilograms. */
export const EXTRA_WEIGHT_MAX_KG = 100000;

export type PickupSideKey = 'front' | 'rear';

/** What is typed for the two pickups of one array, as text. Blank means none. */
export interface ExtraText {
  front: string;
  rear: string;
}

export const EMPTY_EXTRA: ExtraText = { front: '', rear: '' };

/** The typed text of one pickup as a number of kilograms, or null for blank. Null too for text that is not a weight. */
export function parseExtra(text: string): number | null {
  const t = text.trim();
  if (!/^(\d{1,6})?(\.\d{0,2})?$/.test(t) || t === '' || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) && n <= EXTRA_WEIGHT_MAX_KG ? n : null;
}

/** True when the text is blank or a weight: at most 6 whole digits and 2 decimals, not above the maximum. */
export function isValidExtra(text: string): boolean {
  const t = text.trim();
  if (t === '') return true;
  return /^\d{1,6}(\.\d{1,2})?$/.test(t) && Number(t) <= EXTRA_WEIGHT_MAX_KG;
}

/** What the person is allowed to type while writing a weight: digits, then a point, then at most 2 decimals. */
export function isTypingExtra(text: string): boolean {
  return /^(\d{0,6})(\.\d{0,2})?$/.test(text);
}

/** The text saved in the file: blank, or the weight written plainly (12 not 12., 0.5 not .5). */
export function canonicalExtra(text: string): string {
  const n = parseExtra(text);
  return n === null ? '' : String(n);
}

const hundredths = (kg: number): number => Math.round(kg * 100);

/** The sum of kilograms, exact to the hundredth. */
export function sumKg(...values: readonly number[]): number {
  return values.reduce((acc, v) => acc + hundredths(v), 0) / 100;
}

/** a plus b when both are known; null when either is not. */
export function addKg(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : sumKg(a, b);
}

/** A weight as the pages print it: plainly, to at most two decimals. */
export const kgText = (kg: number): string => String(Math.round(kg * 100) / 100);

/** What follows from Update from PDF: the weights that carry over, by position in the new report, and the ones that cannot. */
export interface TrackedExtras {
  kept: Record<number, ExtraText>;
  reset: { array: string; side: PickupSideKey; weight: string }[];
}

/**
 * Update from PDF keeps a typed weight when the array of the same name still has the same pickup, the front or the rear one
 * with the same position number. One it cannot follow is dropped and listed, so the person can be told.
 */
export function trackExtras(saved: Report, next: Report, extras: Readonly<Record<number, ExtraText>>): TrackedExtras {
  const map = matchByName(saved, next);
  const kept: Record<number, ExtraText> = {};
  const reset: TrackedExtras['reset'] = [];
  for (const [key, pair] of Object.entries(extras)) {
    const i = Number(key);
    const old = saved.sources[i];
    const j = map.get(i);
    const now = j === undefined ? undefined : next.sources[j];
    const out: ExtraText = { front: '', rear: '' };
    for (const side of ['front', 'rear'] as const) {
      const text = pair[side];
      if (text.trim() === '') continue;
      const was = old?.pickups.find((p) => p.which === side);
      const is = now?.pickups.find((p) => p.which === side);
      if (was && is && was.position === is.position) out[side] = text;
      else reset.push({ array: old?.name ?? '', side, weight: text });
    }
    if (j !== undefined && (out.front !== '' || out.rear !== '')) kept[j] = out;
  }
  return { kept, reset };
}
