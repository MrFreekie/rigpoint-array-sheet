// Turning a document into a saved file and back. Opening is strict: the text is untrusted until
// it has passed the size limit, the format check, any upgrade steps and the schema.

import { defaultPair, isDefaultPair, SHAPES, symbolValue, type MarkerPair, type SymbolValues } from '../engine/markers';
import { fitPatch, patchUsed, type PatchRow } from '../engine/patch';
import { packEdges, unpackEdges, type Underlay } from '../engine/underlay';
import { ArrayFileSchema, FORMAT, type ArrayFile } from '../schema/array-file';
import { formatIssues } from '../schema/errors';
import { cartsOf, editKey, statusLocks, type Doc } from './doc';
import { MAX_FILE_BYTES } from './limits';
import { FileError, migrate } from './migrations';

export function docToFile(doc: Doc, appVersion: string, now: Date): ArrayFile {
  const count = doc.result.report.sources.length;
  return {
    format: FORMAT,
    app_version: appVersion,
    saved_at: now.toISOString(),
    status: doc.status,
    revision: doc.revision,
    source_name: doc.sourceName,
    job: {
      show: doc.job.show,
      venue: doc.job.venue,
      engineer: doc.job.engineer,
      company: doc.job.company,
      z_axis_zero: doc.job.zAxisZero,
      default_offset: doc.job.defaultOffset,
      origin: doc.job.origin,
      side_labels: doc.job.sideLabels,
      notes: doc.job.notes,
      show_date: doc.job.showDate,
    },
    offsets: Array.from({ length: count }, (_, i) => doc.offsets[i] ?? ''),
    print: Array.from({ length: count }, (_, i) => !doc.noPrint[i]),
    plot: Array.from({ length: count }, (_, i) => !doc.noPlot[i]),
    print_plot: !doc.plotPrintOff,
    titles: Array.from({ length: count }, (_, i) => doc.titles[i] ?? ''),
    notes: Array.from({ length: count }, (_, i) => doc.notes[i] ?? ''),
    deleted: Array.from({ length: count }, (_, i) => doc.deleted[i] === true),
    markers: Array.from({ length: count }, (_, i) => {
      const pair = doc.markers[i] ?? defaultPair();
      return { front: { ...pair.front }, rear: { ...pair.rear } };
    }),
    patch: Array.from({ length: count }, (_, i) => fitPatch(doc.patches[i], doc.result.report.sources[i]?.cabinets.length ?? 0)),
    symbol_values: { two: symbolValue(doc.symbolValues, 'two'), one: symbolValue(doc.symbolValues, 'one'), half: symbolValue(doc.symbolValues, 'half'), quarter: symbolValue(doc.symbolValues, 'quarter') },
    cart_sizes: doc.cartSizes.map((c) => ({ type: c.type, size: c.size })),
    carts: Array.from({ length: count }, (_, i) => {
      const c = cartsOf(doc, i);
      return c.manual ? { manual: true, breaks: c.breaks } : { manual: false, breaks: [] };
    }),
    underlay: doc.underlay
      ? { layers: doc.underlay.layers.map((l) => ({ name: l.name, hidden: l.hidden, shades: l.shades.map((sh) => ({ step: sh.step, edges: packEdges(sh.edges) })) })) }
      : null,
    report: doc.result.report,
    problems: doc.result.problems,
  };
}

export function serialiseDoc(doc: Doc, appVersion: string, now: Date = new Date()): string {
  return `${JSON.stringify(docToFile(doc, appVersion, now), null, 2)}\n`;
}

export interface OpenedFile {
  doc: Doc;
  /** When the file was saved, as the file states. */
  savedAt: string;
}

/** @param fileName the name to show as the file this was opened from, or null when there is none. */
export function openFileText(text: string, fileName: string | null): OpenedFile {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) {
    throw new FileError(`This file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB, which is too big for a RigPoint Array Sheet file.`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new FileError('This file is not a RigPoint Array Sheet file. It could not be read as saved data.');
  }
  const upgraded = migrate(raw);
  const checked = ArrayFileSchema.safeParse(upgraded);
  if (!checked.success) {
    throw new FileError(`This file could not be opened. ${formatIssues(checked.error).join(' ')}`);
  }
  const f = checked.data;
  const offsets: Record<number, string> = {};
  f.offsets.forEach((t, i) => {
    if (t.trim() !== '') offsets[i] = t;
  });
  const noPrint: Record<number, boolean> = {};
  f.print.forEach((printed, i) => {
    if (!printed) noPrint[i] = true;
  });
  const noPlot: Record<number, boolean> = {};
  f.plot.forEach((on, i) => {
    if (!on) noPlot[i] = true;
  });
  const titles: Record<number, string> = {};
  f.titles.forEach((t, i) => {
    if (t.trim() !== '') titles[i] = t;
  });
  const notes: Record<number, string> = {};
  f.notes.forEach((t, i) => {
    if (t.trim() !== '') notes[i] = t;
  });
  const deleted: Record<number, boolean> = {};
  f.deleted.forEach((gone, i) => {
    if (gone) deleted[i] = true;
  });
  const markers: Record<number, MarkerPair> = {};
  f.markers.forEach((pair, i) => {
    if (!isDefaultPair(pair)) markers[i] = pair;
  });
  const patches: Record<number, PatchRow[]> = {};
  f.patch.forEach((rows, i) => {
    if (patchUsed(rows)) patches[i] = rows;
  });
  const carts: Record<number, number[]> = {};
  f.carts.forEach((c, i) => {
    if (c.manual) carts[i] = c.breaks;
  });
  const underlay: Underlay | null = f.underlay
    ? { layers: f.underlay.layers.map((l) => ({ name: l.name, hidden: l.hidden, shades: l.shades.map((sh) => ({ step: sh.step, edges: unpackEdges(sh.edges) ?? [] })) })) }
    : null;
  const doc: Doc = {
    result: { report: f.report, problems: f.problems, ok: !f.problems.some((p) => p.level === 'error') },
    sourceName: f.source_name,
    job: {
      show: f.job.show,
      venue: f.job.venue,
      engineer: f.job.engineer,
      company: f.job.company,
      zAxisZero: f.job.z_axis_zero,
      defaultOffset: f.job.default_offset,
      origin: f.job.origin,
      sideLabels: f.job.side_labels,
      notes: f.job.notes,
      showDate: f.job.show_date,
    },
    offsets,
    titles,
    notes,
    deleted,
    status: f.status,
    revision: f.revision,
    fileName,
    savedKey: null,
    locked: statusLocks(f.status),
    noPrint,
    printOverride: null,
    noPlot,
    plotOverride: null,
    plotPrintOff: !f.print_plot,
    plotPrintOverride: null,
    markers,
    markerOverride: null,
    symbolValues: Object.fromEntries(SHAPES.map((shape) => [shape, f.symbol_values[shape]])) as SymbolValues,
    patches,
    underlay,
    cartSizes: f.cart_sizes.map((c) => ({ type: c.type, size: c.size })),
    carts,
  };
  doc.savedKey = editKey(doc);
  return { doc, savedAt: f.saved_at };
}
