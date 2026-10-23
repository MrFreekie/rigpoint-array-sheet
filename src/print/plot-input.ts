// What the rigging plot draws for a document: the flown arrays chosen for printing, their numbered pickups and
// the ground offset each height is corrected by.

import { numberPickups, plotArrays } from '../engine/plot';
import type { Doc } from '../files/doc';
import { effectiveOffset } from '../ui/document';
import type { SheetModel } from '../ui/sheet-model';
import { panelHeader } from './panel-header';
import { riggingSubtitle } from './pdf-layout';
import type { PlotInput } from './plot-layout';

export type PlotContent = Omit<PlotInput, 'footer'>;

/** Null when no chosen array can be drawn, in which case the printout has no plot page. */
export function plotContent(doc: Doc, model: SheetModel): PlotContent | null {
  const sources = doc.result.report.sources;
  const { drawn, notDrawn } = plotArrays(sources, model.printedSources);
  if (drawn.length === 0) return null;
  // A collapsed mirror pair shares the offset of its card, so a hidden mirror takes its partner's.
  const card = new Map<number, { shown: number; mirror: number | undefined }>();
  for (const e of model.entries) {
    card.set(e.index, { shown: e.index, mirror: e.mirrorIndex });
    if (e.mirrorIndex !== undefined) card.set(e.mirrorIndex, { shown: e.index, mirror: e.mirrorIndex });
  }
  const offsets: Record<number, number | null> = {};
  for (const a of drawn) {
    const c = card.get(a.index);
    offsets[a.index] = (c ? effectiveOffset(doc, c.shown, c.mirror) : effectiveOffset(doc, a.index)).value;
  }
  return {
    arrays: drawn,
    points: numberPickups(drawn),
    notDrawn,
    offsets,
    origin: doc.job.origin,
    sideLabels: doc.job.sideLabels,
    subtitle: riggingSubtitle(doc.job),
    status: panelHeader(doc).status,
  };
}
