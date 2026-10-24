// Which arrays the fly sheet shows and with what offset. The screen cards, the print sheet and the
// image export all use this one model, so they can never disagree.

import type { PatchRow } from '../engine/patch';
import { flySheetColumn, type FlySheetColumn } from '../engine/sheet';
import { findMirrors } from '../engine/symmetry';
import type { ArraySource } from '../engine/types';
import { patchOf, deletedList, displayName, effectiveOffset, isDeleted, isPrinted, type Doc, type EffectiveOffset } from './document';

export interface SheetEntry {
  /** Position of the array in the report. */
  index: number;
  column: FlySheetColumn;
  offset: EffectiveOffset;
  /** Set when this card stands for a pair: the mirror image that is not shown separately. */
  coversMirror?: string | undefined;
  /** Position in the report of that mirror image. */
  mirrorIndex?: number | undefined;
  /** True when the person chose this array for printing. */
  print: boolean;
  /** Set when this card is the mirror image of another array that is also shown. */
  mirrorOf?: string | undefined;
  /** The name the report gives the array, which can differ from the title shown. */
  reportName: string;
  /** True when the person gave the array a title of their own. */
  renamed: boolean;
  /** What the person wrote for the crew, or blank. */
  note: string;
  /** This array's own cable patch, one row for each enclosure. A card that stands for a mirror pair shows this one only. */
  patch: PatchRow[];
}

export interface SheetModel {
  entries: SheetEntry[];
  /** Number of mirrored pairs found. */
  mirrorPairs: number;
  /** Mirror images left out of the sheet because their partner stands for them. */
  hidden: { name: string; mirrorOf: string; patchDiffers: boolean }[];
  /** True when any offset in use is not a number, so heights cannot be shown. */
  badOffsets: boolean;
  /** Arrays chosen for printing, and the mirror images they stand for. Positions in the report. */
  printedSources: Set<number>;
  /** The arrays of the report at the same positions, each with the title shown in place of its name. Deleted ones are included. */
  sources: ArraySource[];
  /** Positions in the report of the arrays that are not deleted. Every reader of arrays goes through this. */
  live: Set<number>;
  /** The arrays the person deleted, by position, with the name they had. They can be restored. */
  deletedList: { index: number; name: string }[];
}

export function sheetModel(doc: Doc, showMirrors: boolean): SheetModel {
  const report = doc.result.report.sources;
  const sources = report.map((s, i) => ({ ...s, name: displayName(doc, i) }));
  const gone = new Set(deletedList(doc));
  const live = new Set(report.flatMap((_, i) => (gone.has(i) ? [] : [i])));
  const noteOf = (i: number) => (doc.notes[i] ?? '').trim();
  const offsetOf = (i: number) => (doc.offsets[i] ?? '').trim();
  // Two mirrored arrays with different notes keep a card each, so no instruction is hidden. The same goes for two
  // arrays whose typed ground offsets differ, because the card would show the heights of only one of them.
  const mirrors = findMirrors(sources, gone, (a, b) => noteOf(a) === noteOf(b) && offsetOf(a) === offsetOf(b));
  const mirrorToShown = new Map([...mirrors].map(([shown, mirror]) => [mirror, shown]));
  const entries: SheetEntry[] = [];
  const hidden: SheetModel['hidden'] = [];

  sources.forEach((s, i) => {
    if (isDeleted(doc, i)) return;
    const mirror = mirrors.get(i);
    const shown = mirrorToShown.get(i);
    if (!showMirrors && shown !== undefined) {
      hidden.push({ name: s.name, mirrorOf: sources[shown]?.name ?? '', patchDiffers: JSON.stringify(patchOf(doc, i)) !== JSON.stringify(patchOf(doc, shown)) });
      return;
    }
    const offset = effectiveOffset(doc, i, mirror ?? shown);
    const column = flySheetColumn(s, offset.value ?? 0);
    if (offset.value === null) {
      column.topHeight = null;
      column.bottomHeight = null;
    }
    entries.push({
      index: i,
      column,
      offset,
      coversMirror: mirror !== undefined && !showMirrors ? sources[mirror]?.name : undefined,
      mirrorIndex: mirror !== undefined && !showMirrors ? mirror : undefined,
      print: isPrinted(doc, i),
      mirrorOf: shown !== undefined ? sources[shown]?.name : undefined,
      reportName: report[i]?.name ?? s.name,
      renamed: s.name !== (report[i]?.name ?? s.name),
      note: doc.notes[i] ?? '',
      patch: patchOf(doc, i),
    });
  });

  const printedSources = new Set<number>();
  for (const e of entries) {
    if (!e.print) continue;
    printedSources.add(e.index);
    if (e.mirrorIndex !== undefined) printedSources.add(e.mirrorIndex);
  }
  return {
    entries,
    mirrorPairs: mirrors.size,
    hidden,
    badOffsets: entries.some((e) => e.offset.value === null),
    printedSources,
    sources,
    live,
    deletedList: [...gone].map((index) => ({ index, name: report[index]?.name ?? '' })),
  };
}
