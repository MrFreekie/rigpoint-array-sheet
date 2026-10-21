// What the person types on top of a report: show details and ground offsets.
// The report itself is never edited. Everything it states is shown as printed.

import { parseOffset } from '../engine/sheet';
import type { ParseResult } from '../engine/types';

export interface Job {
  show: string;
  engineer: string;
  company: string;
  /** Where heights are measured from, e.g. "Arena floor". Text only; the number is the ground offset. */
  zAxisZero: string;
  /** Ground offset used by every array that has none of its own, in metres, as typed. */
  defaultOffset: string;
}

export interface Doc {
  result: ParseResult;
  /** Name of the PDF the report came from. */
  sourceName: string;
  job: Job;
  /** Ground offset typed for one array, by position in the report. Blank means use the default. */
  offsets: Record<number, string>;
}

export const EMPTY_JOB: Job = { show: '', engineer: '', company: '', zAxisZero: '', defaultOffset: '' };

export function newDoc(result: ParseResult, sourceName: string): Doc {
  return { result, sourceName, job: { ...EMPTY_JOB }, offsets: {} };
}

export interface EffectiveOffset {
  /** The offset to use, or null when what was typed is not a number. */
  value: number | null;
  /** The text the person typed in the field that is wrong, for the error message. */
  badField: 'default' | 'array' | null;
}

/**
 * The offset for one array: its own if typed, else its mirror's (the mirror is what is shown on the
 * sheet when the pair is collapsed), else the one for every array.
 */
export function effectiveOffset(doc: Doc, index: number, mirrorIndex?: number): EffectiveOffset {
  const typed = (i: number | undefined) => (i === undefined ? '' : (doc.offsets[i] ?? ''));
  const own = typed(index).trim() !== '' ? typed(index) : typed(mirrorIndex);
  const useOwn = own.trim() !== '';
  const value = parseOffset(useOwn ? own : doc.job.defaultOffset);
  return { value, badField: value === null ? (useOwn ? 'array' : 'default') : null };
}

/** True when the person has typed anything, so starting again would lose it. */
export function hasEdits(doc: Doc): boolean {
  const j = doc.job;
  return (
    [j.show, j.engineer, j.company, j.zAxisZero, j.defaultOffset].some((t) => t.trim() !== '') ||
    Object.values(doc.offsets).some((t) => t.trim() !== '')
  );
}

export function showTitle(doc: Doc): string {
  return doc.job.show.trim() || doc.result.report.document.fileName || doc.sourceName;
}
