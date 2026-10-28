// A test helper for carts: cut one array into carts of one size, as the old per card buttons did. The app itself no longer offers it.

import { autoBreaks, cartRows } from '../engine/carts';
import type { Doc } from '../files/doc';

/** Cut an array into carts of one size, from the top (from the bottom for a stack), still breaking at every change of type. The array becomes hand cut. */
export function withCartSize(doc: Doc, index: number, size: number): Doc {
  const source = doc.result.report.sources[index];
  if (doc.locked || !source || !Number.isInteger(size) || size < 1) return doc;
  return { ...doc, carts: { ...doc.carts, [index]: autoBreaks(cartRows(source.cabinets), () => size, source.mounting) } };
}
