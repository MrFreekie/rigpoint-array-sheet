// What the person is working on: a report read from a PDF, plus what they typed on top of it.
// The report itself is never edited. Everything it states is shown as printed.

import { autoBreaks, cartRows, defaultCartSizes, forcedBreaks, groupsOf, normaliseBreaks, sizeFor, toggleBreak, trackCarts, type CartSize } from '../engine/carts';
import { matchByName } from '../engine/compare';
import { cleanSymbolValue, defaultPair, defaultSymbolValues, isDefaultPair, SHAPES, sameSymbolValues, symbolValue, trackMarkers, type Marker, type MarkerPair, type PickupSide, type Shape, type SymbolValues } from '../engine/markers';
import { fitPatch, patchUsed, trackPatches, type PatchField, type PatchRow, type PatchValue } from '../engine/patch';
import type { ParseResult, Problem } from '../engine/types';
import type { Underlay } from '../engine/underlay';

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
  /** Where the show is. Soundvision reports do not state it, so it is typed. */
  venue: string;
  engineer: string;
  company: string;
  /** Where heights are measured from, e.g. "Arena floor". Text only; the number is the ground offset. */
  zAxisZero: string;
  /** Ground offset used by every array that has none of its own, in metres, as typed. */
  defaultOffset: string;
  /** What the Soundvision origin (P0) is, e.g. "DSE" or "Iron Line". Text only; the rigging plot prints it. */
  origin: string;
  /** Whether the rigging plot names the sides (House left, House right, Stage, Audience). Off suits a show in the round. */
  sideLabels: boolean;
  /** Notes about the whole show, for the crew. Printed on the rigging summary. */
  notes: string;
  /** The date of the show as YYYY-MM-DD, or blank. Printed UK style wherever the show and venue are. */
  showDate: string;
}

export interface Doc {
  result: ParseResult;
  /** Name of the PDF the report came from. */
  sourceName: string;
  job: Job;
  /** Ground offset typed for one array, by position in the report. Blank means use the default. */
  offsets: Record<number, string>;
  /** A card title typed for one array, by position in the report. Blank means use the name in the report. */
  titles: Record<number, string>;
  /** A note for the crew typed for one array, by position in the report. */
  notes: Record<number, string>;
  /** Arrays the person deleted, by position in the report. Their data stays in the file, so they can be restored. */
  deleted: Record<number, boolean>;
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
  /** Arrays the person chose not to print, by position in the report. Saved in the file. */
  noPrint: Record<number, boolean>;
  /**
   * The same choices while the file is read-only. A read-only file cannot change, but the person may
   * still pick what to print this time. Never saved. Null when there is nothing to override.
   */
  printOverride: Record<number, boolean> | null;
  /** Arrays the person left off the rigging plot, by position in the report. Saved in the file. */
  noPlot: Record<number, boolean>;
  /** The same choices while the file is read-only. Never saved. Null when there is nothing to override. */
  plotOverride: Record<number, boolean> | null;
  /** True when the person turned Print rigging plot off. Saved in the file. */
  plotPrintOff: boolean;
  /** The same choice while the file is read-only: true for off. Never saved. Null when there is nothing to override. */
  plotPrintOverride: boolean | null;
  /** Whether the rigging plot shows the Position dots and the array outlines. Saved in the file. */
  plotShow: PlotShow;
  /** The same choices while the file is read-only. Never saved. Null when there is nothing to override. */
  plotShowOverride: PlotShow | null;
  /** The plot symbol chosen for the front and rear pickup of an array, by position in the report. Arrays not listed use the default. Saved in the file. */
  markers: Record<number, MarkerPair>;
  /** The same choices while the file is read-only. Never saved. Null when there is nothing to override. */
  markerOverride: Record<number, MarkerPair> | null;
  /** The value written for each of the four plot symbols, such as "1 t". One for the whole job. Saved in the file. */
  symbolValues: SymbolValues;
  /**
   * The cable patch of an array, by position in the report: one feeder and way for each enclosure row. Arrays not listed have
   * nothing set. Notes only. Saved in the file.
   */
  patches: Record<number, PatchRow[]>;
  /** The venue drawn grey under the rigging plot, as plan lines, or null when none was imported. Saved in the file. */
  underlay: Underlay | null;
  /** How many enclosures of each type make a cart. Automatic arrays are cut from this. Saved in the file. */
  cartSizes: CartSize[];
  /** The carts of an array the person cut by hand, by position in the report: the index of the first row of every cart after the first. Arrays not listed are automatic. Saved in the file. */
  carts: Record<number, number[]>;
}

/** What the rigging plot draws besides the pickups: the Position dot of every array, and the outline of every array. */
export interface PlotShow {
  position: boolean;
  outlines: boolean;
}

export const SHOW_ALL: PlotShow = { position: true, outlines: true };

export const EMPTY_JOB: Job = { show: '', venue: '', engineer: '', company: '', zAxisZero: '', defaultOffset: '', origin: '', sideLabels: true, notes: '', showDate: '' };

export function newDoc(result: ParseResult, sourceName: string): Doc {
  return {
    result,
    sourceName,
    job: { ...EMPTY_JOB },
    offsets: {},
    titles: {},
    notes: {},
    deleted: {},
    status: 'draft',
    revision: '',
    fileName: null,
    savedKey: null,
    locked: false,
    noPrint: {},
    printOverride: null,
    noPlot: {},
    plotOverride: null,
    plotPrintOff: false,
    plotPrintOverride: null,
    plotShow: { ...SHOW_ALL },
    plotShowOverride: null,
    markers: {},
    markerOverride: null,
    symbolValues: defaultSymbolValues(),
    patches: {},
    underlay: null,
    cartSizes: defaultCartSizes(),
    carts: {},
  };
}

/** Approved and superseded files are read-only once saved: a change needs a new revision. */
export function statusLocks(status: Status): boolean {
  return status === 'approved' || status === 'superseded';
}

export function isLocked(doc: Doc): boolean {
  return doc.locked;
}

/** True when `cur` is still the report that `snapshot` was taken from, so a late save result belongs to it. */
export function sameDocument(cur: Doc, snapshot: Doc): boolean {
  return cur.result === snapshot.result && cur.sourceName === snapshot.sourceName;
}

/**
 * True when the file handle a save returned still belongs to `cur`. It does not if another document was opened
 * meanwhile, or if the status went back from approved or superseded to something editable while the file was
 * written: that file is read-only, so the next Save must ask where.
 */
export function keepsHandle(cur: Doc, snapshot: Doc): boolean {
  return sameDocument(cur, snapshot) && (!statusLocks(snapshot.status) || statusLocks(cur.status));
}

/**
 * The document after a save wrote `key` to `name`. Anything changed since stays unsaved. A different document
 * is returned as it was. The lock is applied only while the status still locks, as it did when saved.
 */
export function markSaved(cur: Doc, snapshot: Doc, name: string, key: string): Doc {
  if (!sameDocument(cur, snapshot)) return cur;
  return { ...cur, fileName: name, savedKey: key, locked: statusLocks(snapshot.status) && statusLocks(cur.status) ? true : cur.locked };
}

/** A string that changes whenever anything worth saving changes. */
export function editKey(doc: Doc): string {
  const offsets = Object.entries(doc.offsets)
    .filter(([, text]) => text.trim() !== '')
    .sort(([a], [b]) => Number(a) - Number(b));
  const skipped = Object.entries(doc.noPrint)
    .filter(([, skip]) => skip)
    .map(([i]) => Number(i))
    .sort((a, b) => a - b);
  const offPlot = Object.entries(doc.noPlot)
    .filter(([, skip]) => skip)
    .map(([i]) => Number(i))
    .sort((a, b) => a - b);
  const typed = (r: Record<number, string>) =>
    Object.entries(r)
      .filter(([, text]) => text.trim() !== '')
      .sort(([a], [b]) => Number(a) - Number(b));
  return JSON.stringify([doc.job, offsets, doc.status, doc.revision, doc.sourceName, doc.result, skipped, typed(doc.titles), typed(doc.notes), deletedList(doc), savedMarkers(doc), SHAPES.map((shape) => symbolValue(doc.symbolValues, shape)), savedPatches(doc), doc.underlay, doc.cartSizes, savedCarts(doc), offPlot, doc.plotPrintOff, doc.plotShow.position, doc.plotShow.outlines]);
}

/** The plot symbols that are not the default, by position, in order. Only what is saved counts, not a read-only file's override. */
function savedMarkers(doc: Doc): [number, MarkerPair][] {
  return Object.entries(doc.markers)
    .filter(([, pair]) => !isDefaultPair(pair))
    .map(([i, pair]): [number, MarkerPair] => [Number(i), pair])
    .sort((a, b) => a[0] - b[0]);
}

/** The cable patches that have something set, by position, in order. Only what is saved counts, not a read-only file's override. */
function savedPatches(doc: Doc): [number, PatchRow[]][] {
  return Object.entries(doc.patches)
    .filter(([, rows]) => patchUsed(rows))
    .map(([i, rows]): [number, PatchRow[]] => [Number(i), rows])
    .sort((a, b) => a[0] - b[0]);
}

/** The hand cut carts, by position, in order. */
function savedCarts(doc: Doc): [number, number[]][] {
  return Object.entries(doc.carts)
    .map(([i, breaks]): [number, number[]] => [Number(i), breaks])
    .sort((a, b) => a[0] - b[0]);
}

/** The carts of one array as the card shows them: where the breaks are, whether the person cut them, and the size of each cart. */
export interface CartsOf {
  breaks: number[];
  manual: boolean;
  groups: number[];
  /** The breaks no one can remove: where the type or the stack column changes. */
  forced: number[];
}

export function cartsOf(doc: Doc, index: number): CartsOf {
  const source = doc.result.report.sources[index];
  const rows = cartRows(source?.cabinets ?? []);
  const forced = forcedBreaks(rows);
  const stored = doc.carts[index];
  const manual = stored !== undefined;
  const breaks = manual ? normaliseBreaks(stored, forced, rows.length) : autoBreaks(rows, (type) => sizeFor(doc.cartSizes, type), source?.mounting ?? null);
  return { breaks, manual, groups: groupsOf(breaks, rows.length), forced };
}

/** Add or remove the break before row `row` of an array. The array becomes hand cut. A read-only file cannot change. */
export function withCartBreak(doc: Doc, index: number, row: number): Doc {
  const rows = doc.result.report.sources[index]?.cabinets.length ?? 0;
  if (doc.locked || row < 1 || row >= rows) return doc;
  const c = cartsOf(doc, index);
  return { ...doc, carts: { ...doc.carts, [index]: toggleBreak(c.breaks, row, c.forced, rows) } };
}

/** Put an array back to automatic carts. */
export function withCartReset(doc: Doc, index: number): Doc {
  if (doc.locked || doc.carts[index] === undefined) return doc;
  return { ...doc, carts: Object.fromEntries(Object.entries(doc.carts).filter(([i]) => Number(i) !== index)) };
}

/** Replace the table of cart sizes. A read-only file cannot change. */
export function withCartSizes(doc: Doc, sizes: CartSize[]): Doc {
  return doc.locked ? doc : { ...doc, cartSizes: sizes };
}

/** The value written for a plot symbol. */
export function symbolValueOf(doc: Doc, shape: Shape): string {
  return symbolValue(doc.symbolValues, shape);
}

/** Set the value written for one plot symbol. A blank value goes back to the usual one. A read-only file cannot change. */
export function withSymbolValue(doc: Doc, shape: Shape, text: string): Doc {
  if (doc.locked) return doc;
  const value = cleanSymbolValue(text).trim() || defaultSymbolValues()[shape];
  return { ...doc, symbolValues: { ...doc.symbolValues, [shape]: value } };
}

/** Put the values of all four plot symbols back to the usual ones. A read-only file cannot change. */
export function withSymbolValuesReset(doc: Doc): Doc {
  return doc.locked || sameSymbolValues(doc.symbolValues, defaultSymbolValues()) ? doc : { ...doc, symbolValues: defaultSymbolValues() };
}

/** The cable patch of an array, one row for each enclosure. */
export function patchOf(doc: Doc, index: number): PatchRow[] {
  return fitPatch(doc.patches[index], doc.result.report.sources[index]?.cabinets.length ?? 0);
}

/** Set the feeder or the way of one enclosure row. A read-only file cannot change, so it comes back as it was. */
export function withPatch(doc: Doc, index: number, row: number, field: PatchField, value: PatchValue): Doc {
  const rows = doc.result.report.sources[index]?.cabinets.length ?? 0;
  if (doc.locked || row < 0 || row >= rows) return doc;
  const next = fitPatch(doc.patches[index], rows);
  next[row] = { ...(next[row] as PatchRow), [field]: value };
  return { ...doc, patches: { ...doc.patches, [index]: next } };
}

/** The plot symbol of one pickup side of an array. A read-only file shows its session choice, if it has one. */
export function markerOf(doc: Doc, index: number, side: PickupSide): Marker {
  return (doc.markerOverride ?? doc.markers)[index]?.[side] ?? defaultPair()[side];
}

/** Choose the plot symbol of one pickup side. A read-only file keeps the choice for this session only. */
export function withMarker(doc: Doc, index: number, side: PickupSide, marker: Marker): Doc {
  const set = (from: Record<number, MarkerPair>): Record<number, MarkerPair> => ({ ...from, [index]: { ...(from[index] ?? defaultPair()), [side]: marker } });
  if (doc.locked) return { ...doc, markerOverride: set(doc.markerOverride ?? doc.markers) };
  return { ...doc, markers: set(doc.markers), markerOverride: null };
}

/** Import a venue, or remove it with null. Replacing one starts with every layer on. A read-only file cannot change. */
export function withUnderlay(doc: Doc, underlay: Underlay | null): Doc {
  return doc.locked ? doc : { ...doc, underlay };
}

/** Show or hide one layer of the venue. A read-only file cannot change. */
export function withLayerHidden(doc: Doc, name: string, hidden: boolean): Doc {
  if (doc.locked || !doc.underlay) return doc;
  return { ...doc, underlay: { layers: doc.underlay.layers.map((l) => (l.name === name ? { ...l, hidden } : l)) } };
}

/** Positions in the report of the deleted arrays, in order. */
export function deletedList(doc: Doc): number[] {
  return Object.entries(doc.deleted)
    .filter(([, gone]) => gone)
    .map(([i]) => Number(i))
    .sort((a, b) => a - b);
}

/** True when the array at this position was deleted. */
export function isDeleted(doc: Doc, index: number): boolean {
  return doc.deleted[index] === true;
}

/** Delete or restore an array. A read-only file cannot change, so it comes back as it was. */
export function withDeleted(doc: Doc, index: number, gone: boolean): Doc {
  if (doc.locked) return doc;
  return { ...doc, deleted: { ...doc.deleted, [index]: gone } };
}

/** Set the card title of an array. Blank goes back to the name in the report. */
export function withTitle(doc: Doc, index: number, title: string): Doc {
  return doc.locked ? doc : { ...doc, titles: { ...doc.titles, [index]: title } };
}

/** Set the note of an array. */
export function withNote(doc: Doc, index: number, note: string): Doc {
  return doc.locked ? doc : { ...doc, notes: { ...doc.notes, [index]: note } };
}

/** What an array is called on the sheet: the title typed for it, else the name in the report. */
export function displayName(doc: Doc, index: number): string {
  const typed = doc.titles[index]?.trim();
  return typed ? typed : (doc.result.report.sources[index]?.name ?? '');
}

/**
 * The document after Update from PDF. Everything the person typed stays with the array of the same name: ground offset,
 * print choice, title and note. Arrays that were deleted come back if the new PDF has them, with the new PDF's data.
 */
export function updatedDoc(doc: Doc, fresh: ParseResult, sourceName: string): Doc {
  const map = matchByName(doc.result.report, fresh.report);
  const carry = <T>(from: Record<number, T>, keep: (v: T) => boolean): Record<number, T> => {
    const out: Record<number, T> = {};
    for (const [i, v] of Object.entries(from)) {
      const j = map.get(Number(i));
      if (j !== undefined && keep(v)) out[j] = v;
    }
    return out;
  };
  return {
    ...doc,
    result: fresh,
    sourceName,
    offsets: carry(doc.offsets, () => true),
    titles: carry(doc.titles, () => true),
    notes: carry(doc.notes, () => true),
    noPrint: carry(doc.noPrint, (skip) => skip),
    noPlot: carry(doc.noPlot, (skip) => skip),
    plotOverride: null,
    plotPrintOverride: null,
    deleted: {},
    printOverride: null,
    markers: trackMarkers(doc.result.report, fresh.report, doc.markerOverride ?? doc.markers).kept,
    markerOverride: null,
    patches: trackPatches(doc.result.report, fresh.report, doc.patches).kept,
    carts: trackCarts(doc.result.report, fresh.report, doc.carts).kept,
  };
}

/**
 * The problems found reading the PDF, without the checks that concern only deleted arrays. An error always stays, because it
 * means the report cannot be relied on. A check stays if any array of that name is still there, or it names no array.
 */
export function visibleProblems(doc: Doc): Problem[] {
  const names = doc.result.report.sources.map((s, i) => ({ name: s.name, gone: isDeleted(doc, i) }));
  return doc.result.problems.filter((p) => {
    if (p.level !== 'check' || !p.source) return true;
    const same = names.filter((n) => n.name === p.source);
    return same.length === 0 || same.some((n) => !n.gone);
  });
}

/** The arrays of the report that have not been deleted, as positions in the report. */
export function liveIndexes(doc: Doc): number[] {
  return doc.result.report.sources.flatMap((_, i) => (isDeleted(doc, i) ? [] : [i]));
}

/** True when the array at this position is chosen for printing. */
export function isPrinted(doc: Doc, index: number): boolean {
  return !(doc.printOverride ?? doc.noPrint)[index];
}

/** Choose, or unchoose, an array for printing. A read-only file keeps the choice for this session only. */
export function withPrinted(doc: Doc, index: number, printed: boolean): Doc {
  if (doc.locked) return { ...doc, printOverride: { ...(doc.printOverride ?? doc.noPrint), [index]: !printed } };
  return { ...doc, noPrint: { ...doc.noPrint, [index]: !printed }, printOverride: null };
}

/** True when the array at this position is on the rigging plot. Every array is until the person leaves it off. */
export function isOnPlot(doc: Doc, index: number): boolean {
  return !(doc.plotOverride ?? doc.noPlot)[index];
}

/** Put an array on the rigging plot, or take it off. A read-only file keeps the choice for this session only. */
export function withOnPlot(doc: Doc, index: number, on: boolean): Doc {
  if (doc.locked) return { ...doc, plotOverride: { ...(doc.plotOverride ?? doc.noPlot), [index]: !on } };
  return { ...doc, noPlot: { ...doc.noPlot, [index]: !on }, plotOverride: null };
}

/** True when the person has Print rigging plot ticked. The sheet model adds that some array must be on the plot. */
export function plotPrintChosen(doc: Doc): boolean {
  return !(doc.plotPrintOverride ?? doc.plotPrintOff);
}

/** Turn Print rigging plot on or off. A read-only file keeps the choice for this session only. */
export function withPlotPrinted(doc: Doc, printed: boolean): Doc {
  if (doc.locked) return { ...doc, plotPrintOverride: !printed };
  return { ...doc, plotPrintOff: !printed, plotPrintOverride: null };
}

/** What the rigging plot shows now: the saved choice, or this session's choice on a read-only file. */
export function plotShown(doc: Doc): PlotShow {
  return doc.plotShowOverride ?? doc.plotShow;
}

/** Show or hide the Position dots and the array outlines. A read-only file keeps the choice for this session only. */
export function withPlotShow(doc: Doc, patch: Partial<PlotShow>): Doc {
  const next = { ...plotShown(doc), ...patch };
  if (doc.locked) return { ...doc, plotShowOverride: next };
  return { ...doc, plotShow: next, plotShowOverride: null };
}

/** True when the document has never been saved, or has changed since it was. */
export function isDirty(doc: Doc): boolean {
  return doc.savedKey !== editKey(doc);
}
