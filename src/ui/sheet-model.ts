// Which arrays the fly sheet shows and with what offset. The screen cards, the print sheet and the
// image export all use this one model, so they can never disagree.

import { flySheetColumn, type FlySheetColumn } from '../engine/sheet';
import { findMirrors } from '../engine/symmetry';
import { effectiveOffset, type Doc, type EffectiveOffset } from './document';

export interface SheetEntry {
  /** Position of the array in the report. */
  index: number;
  column: FlySheetColumn;
  offset: EffectiveOffset;
  /** Set when this card stands for a pair: the mirror image that is not shown separately. */
  coversMirror?: string | undefined;
  /** Set when this card is the mirror image of another array that is also shown. */
  mirrorOf?: string | undefined;
}

export interface SheetModel {
  entries: SheetEntry[];
  /** Number of mirrored pairs found. */
  mirrorPairs: number;
  /** Mirror images left out of the sheet because their partner stands for them. */
  hidden: { name: string; mirrorOf: string }[];
  /** True when any offset in use is not a number, so heights cannot be shown. */
  badOffsets: boolean;
}

export function sheetModel(doc: Doc, showMirrors: boolean): SheetModel {
  const sources = doc.result.report.sources;
  const mirrors = findMirrors(sources);
  const mirrorToShown = new Map([...mirrors].map(([shown, mirror]) => [mirror, shown]));
  const entries: SheetEntry[] = [];
  const hidden: SheetModel['hidden'] = [];

  sources.forEach((s, i) => {
    const mirror = mirrors.get(i);
    const shown = mirrorToShown.get(i);
    if (!showMirrors && shown !== undefined) {
      hidden.push({ name: s.name, mirrorOf: sources[shown]?.name ?? '' });
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
      mirrorOf: shown !== undefined ? sources[shown]?.name : undefined,
    });
  });

  return { entries, mirrorPairs: mirrors.size, hidden, badOffsets: entries.some((e) => e.offset.value === null) };
}
