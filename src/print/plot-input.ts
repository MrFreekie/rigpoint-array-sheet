// What the rigging plot draws for a document: the arrays chosen for printing and their numbered pickups.

import { numberPickups, plotArrays } from '../engine/plot';
import type { Doc } from '../files/doc';
import type { SheetModel } from '../ui/sheet-model';
import { panelHeader } from './panel-header';
import { riggingSubtitle } from './pdf-layout';
import type { PlotInput } from './plot-layout';

export type PlotContent = Omit<PlotInput, 'footer'>;

/** Null when no chosen array can be drawn, in which case the printout has no plot page. */
export function plotContent(doc: Doc, model: SheetModel): PlotContent | null {
  const { drawn, notDrawn } = plotArrays(model.sources, model.printedSources);
  if (drawn.length === 0) return null;
  return {
    arrays: drawn,
    points: numberPickups(drawn),
    notDrawn,
    origin: doc.job.origin,
    sideLabels: doc.job.sideLabels,
    subtitle: riggingSubtitle(doc.job),
    status: panelHeader(doc).status,
  };
}
