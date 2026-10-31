// The rows of the tuning sheet: what the report states for each array, as text, ready to show in the Tuning dialog and to draw
// in the PDF and the image of it. Pure: the report goes in and text comes out. Nothing is calculated, and a blank stays blank.

import { deletedList, displayName, type Doc } from '../files/doc';
import type { ArrayTuning } from '../engine/types';

export const TUNING_COLUMNS = ['Array', 'Delay', 'Gain', 'Autofilter', 'LF Contour', 'Zoom'] as const;

export const TUNING_FOOTNOTE = 'A blank means the report states nothing the app could read for it.';

export interface TuningLine {
  text: string;
  /** True for a line set smaller under the main one: a group's figure, or the name in the report. */
  small: boolean;
}

/** The lines of one cell. An empty list is a blank cell. */
export type TuningCell = TuningLine[];

export interface TuningRow {
  /** Position of the array in the report. */
  index: number;
  /** One cell for each of TUNING_COLUMNS. */
  cells: TuningCell[];
}

/** True when the report holds tuning: a file saved before the app read it has none. */
export function hasTuning(doc: Doc): boolean {
  return doc.result.report.sources.some((s) => s.tuning !== undefined);
}

/** What to tell the person when the file holds no tuning. A read-only file cannot be updated, so it needs a new revision first. */
export function noTuningNotice(locked: boolean): string {
  return `This file was saved before the app read tuning values. ${locked ? 'Create a new revision, then use' : 'Use'} Update from PDF with the same report to read them. Update from PDF also brings back any array you deleted.`;
}

const line = (text: string, small = false): TuningLine => ({ text, small });

/** The text after "Autofilter active - " when the line starts that way, else the whole line. */
export function autofilterText(autofilter: string | null): string {
  if (autofilter === null) return '';
  const prefix = 'Autofilter active - ';
  return autofilter.startsWith(prefix) && autofilter.length > prefix.length ? autofilter.slice(prefix.length) : autofilter;
}

/** "180 Hz, 2 dB", or the one figure the report states. */
export function lfContourText(t: ArrayTuning): string {
  return [t.lfContourFrequency === null ? null : `${t.lfContourFrequency} Hz`, t.lfContourGain === null ? null : `${t.lfContourGain} dB`].filter((p) => p !== null).join(', ');
}

/** The own figure first, then one smaller line for each group that states one: "SUBS: 6 ms". */
function figureCell(own: string | null, unit: string, groups: { group: string; value: string | null }[]): TuningCell {
  return [
    ...(own === null ? [] : [line(`${own} ${unit}`)]),
    ...groups.flatMap((g) => (g.value === null ? [] : [line(`${g.group}: ${g.value} ${unit}`, true)])),
  ];
}

/** One row for each array that is not deleted, mirror images included, in the order of the report. */
export function tuningRows(doc: Doc): TuningRow[] {
  const gone = new Set(deletedList(doc));
  const rows: TuningRow[] = [];
  doc.result.report.sources.forEach((s, index) => {
    if (gone.has(index)) return;
    const name = displayName(doc, index);
    const t = s.tuning;
    const text = (value: string) => (value === '' ? [] : [line(value)]);
    rows.push({
      index,
      cells: [
        [line(name), ...(name !== s.name ? [line(`Soundvision name: ${s.name}`, true)] : [])],
        figureCell(t?.delay ?? null, 'ms', (t?.groups ?? []).map((g) => ({ group: g.group, value: g.delay }))),
        figureCell(t?.gain ?? null, 'dB', (t?.groups ?? []).map((g) => ({ group: g.group, value: g.gain }))),
        text(autofilterText(t?.autofilter ?? null)),
        text(t ? lfContourText(t) : ''),
        text(t?.zoom ?? ''),
      ],
    });
  });
  return rows;
}
