// What the rigging plot draws for a document: the arrays chosen for printing and their numbered pickups.

import { SHAPES, symbolValue, type PickupSide, type SymbolValues } from '../engine/markers';
import { numberPickups, plotArrays } from '../engine/plot';
import { markerOf, type Doc } from '../files/doc';
import type { SheetModel } from '../ui/sheet-model';
import { panelHeader } from './panel-header';
import { riggingSubtitle } from './pdf-layout';
import { visibleLayers } from '../engine/underlay';
import type { PlotInput } from './plot-layout';

export type PlotContent = Omit<PlotInput, 'footer'>;

/** What the printout draws: the plot, unless Print rigging plot is off or no array is on it. The screen preview and the DXF use plotContent. */
export function plotForPrint(doc: Doc, model: SheetModel): PlotContent | null {
  return model.printsPlot ? plotContent(doc, model) : null;
}

/** Null when no array on the plot can be drawn, in which case there is nothing to show. */
export function plotContent(doc: Doc, model: SheetModel): PlotContent | null {
  const { drawn, notDrawn } = plotArrays(model.sources, model.plottedSources);
  if (drawn.length === 0) return null;
  // A mirror image that a card stands for has no choice of its own: it takes its pickup's symbol from that card.
  const standsFor = new Map<number, number>();
  for (const e of model.entries) if (e.mirrorIndex !== undefined) standsFor.set(e.mirrorIndex, e.index);
  const symbolOf = (arrayIndex: number, side: PickupSide) => markerOf(doc, standsFor.get(arrayIndex) ?? arrayIndex, side);
  return {
    arrays: drawn,
    points: numberPickups(drawn, undefined, symbolOf),
    notDrawn,
    origin: doc.job.origin,
    sideLabels: doc.job.sideLabels,
    symbolValues: Object.fromEntries(SHAPES.map((shape) => [shape, symbolValue(doc.symbolValues, shape)])) as SymbolValues,
    venue: visibleLayers(doc.underlay),
    subtitle: riggingSubtitle(doc.job),
    status: panelHeader(doc).status,
  };
}
