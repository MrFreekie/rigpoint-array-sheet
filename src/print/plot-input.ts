// What the rigging plot draws for a document: the arrays chosen for printing and their numbered pickups.

import { SHAPES, symbolValue, type PickupSide, type SymbolValues } from '../engine/markers';
import { numberPickups, plotArrays } from '../engine/plot';
import { markerOf, plotShown, type Doc } from '../files/doc';
import { extraKgFor, type SheetModel } from '../ui/sheet-model';
import { addKg, sumKg } from '../engine/extra-weight';
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
  // An additional weight typed for a pickup is added to its motor load and to its array's stated total, in whole hundredths.
  const extraOf = extraKgFor(doc, model);
  const points = numberPickups(drawn, undefined, symbolOf).map((p) => {
    const extra = extraOf(p.arrayIndex, p.which);
    return extra === null ? p : { ...p, load: addKg(p.load, extra) };
  });
  const arrays = drawn.map((a) => {
    const extras = a.pickups.map((p) => extraOf(a.index, p.which)).filter((v): v is number => v !== null);
    return extras.length === 0 || a.totalWeight === null ? a : { ...a, totalWeight: sumKg(a.totalWeight, ...extras) };
  });
  const additionalWeight = drawn.some((a) => a.pickups.some((p) => extraOf(a.index, p.which) !== null));
  return {
    arrays,
    points,
    additionalWeight,
    notDrawn,
    origin: doc.job.origin,
    sideLabels: doc.job.sideLabels,
    showPosition: plotShown(doc).position,
    showOutlines: plotShown(doc).outlines,
    symbolValues: Object.fromEntries(SHAPES.map((shape) => [shape, symbolValue(doc.symbolValues, shape)])) as SymbolValues,
    venue: visibleLayers(doc.underlay),
    subtitle: riggingSubtitle(doc.job),
    status: panelHeader(doc).status,
  };
}
