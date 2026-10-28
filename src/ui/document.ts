// Helpers the interface uses on top of the document model in src/files/doc.ts.

import { parseOffset } from '../engine/sheet';
import type { Doc } from '../files/doc';

export {
  cartsOf,
  deletedList,
  displayName,
  editKey,
  EMPTY_JOB,
  isDeleted,
  isDirty,
  isLocked,
  isOnPlot,
  isPrinted,
  liveIndexes,
  markerOf,
  newDoc,
  patchOf,
  plotPrintChosen,
  withOnPlot,
  withPatch,
  withPlotPrinted,
  STATUS_LABELS,
  STATUSES,
  updatedDoc,
  visibleProblems,
  withCartBreak,
  withCartReset,
  withCartSizes,
  withDeleted,
  withLayerHidden,
  withUnderlay,
  withMarker,
  withNote,
  withPrinted,
  withSymbolValue,
  withSymbolValuesReset,
  withTitle,
} from '../files/doc';
export type { Doc, Job, Status } from '../files/doc';

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

export function showTitle(doc: Doc): string {
  return doc.job.show.trim() || doc.result.report.document.fileName || doc.sourceName;
}
