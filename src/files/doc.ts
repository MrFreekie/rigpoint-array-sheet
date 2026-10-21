// What the person is working on: a report read from a PDF, plus what they typed on top of it.
// The report itself is never edited. Everything it states is shown as printed.

import type { ParseResult } from '../engine/types';

export const STATUSES = ['draft', 'issued', 'approved', 'superseded'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  draft: 'Draft',
  issued: 'Issued',
  approved: 'Approved',
  superseded: 'Superseded',
};

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
  status: Status;
  /** Blank for the first issue, then A, B, C... */
  revision: string;
  /** Name of the file this was last saved to or opened from, or null if it has never been saved. */
  fileName: string | null;
  /** What the document looked like when it was last saved or opened. Null if it never was. */
  savedKey: string | null;
  /**
   * True for a file that was opened, or saved, as approved or superseded. Such a file is read-only.
   * Choosing Approved on a draft does not lock it until it is saved, so it can still be saved.
   */
  locked: boolean;
}

export const EMPTY_JOB: Job = { show: '', engineer: '', company: '', zAxisZero: '', defaultOffset: '' };

export function newDoc(result: ParseResult, sourceName: string): Doc {
  return {
    result,
    sourceName,
    job: { ...EMPTY_JOB },
    offsets: {},
    status: 'draft',
    revision: '',
    fileName: null,
    savedKey: null,
    locked: false,
  };
}

/** Approved and superseded files are read-only once saved: a change needs a new revision. */
export function statusLocks(status: Status): boolean {
  return status === 'approved' || status === 'superseded';
}

export function isLocked(doc: Doc): boolean {
  return doc.locked;
}

/** A string that changes whenever anything worth saving changes. */
export function editKey(doc: Doc): string {
  const offsets = Object.entries(doc.offsets)
    .filter(([, text]) => text.trim() !== '')
    .sort(([a], [b]) => Number(a) - Number(b));
  return JSON.stringify([doc.job, offsets, doc.status, doc.revision, doc.sourceName, doc.result]);
}

/** True when the document has never been saved, or has changed since it was. */
export function isDirty(doc: Doc): boolean {
  return doc.savedKey !== editKey(doc);
}
