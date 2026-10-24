// What one array's card says, as plain data. The printed pocket card and the PNG export both draw from
// this, so they show the same thing as each other and as the screen.

import { isPatchColumn, PATCH_COLOURS, PATCH_COLUMNS, type PatchColour, type PatchDigit } from '../engine/patch';
import { enclosureLabel } from '../engine/types';
import { STATUS_LABELS, type Status } from '../files/doc';
import { showDateText } from '../files/show-date';
import { degrees, kg, metres, NOT_STATED, num } from '../ui/format';
import type { SheetEntry } from '../ui/sheet-model';

export interface CardContext {
  show: string;
  venue: string;
  status: Status;
  revision: string;
  zAxisZero: string;
  /** The show date as YYYY-MM-DD, or blank. */
  showDate?: string;
}

export interface CardContent {
  title: string;
  /** Group and configuration. */
  subtitle: string;
  /** Show, status and Z-axis zero, so a card on its own is still traceable. */
  context: string;
  /** "Also mirrored with: " and the name of the other array, when this card stands for a mirror image or is one. */
  mirrorNote: string | null;
  /** "Soundvision name: " and the name in the report, only when the person gave the array a title of their own. */
  reportNameNote: string | null;
  /** What the person wrote for the crew, trimmed, with its line breaks. Null when blank. */
  note: string | null;
  facts: [label: string, value: string][];
  /** One row per fixation: name, X, Y, Z as the report prints them. Empty when the report states none. */
  fixations: string[][];
  warnings: { severity: string; title: string; message: string }[];
  columns: string[];
  rows: string[][];
  /** One flag for each row of the table: true when the row is in a shaded cart. All false when the array is one block. */
  cartShade: boolean[];
}

/** Heading of the fixation block and its columns. Z is the report's own, with no ground offset taken off. */
export const FIXATION_COLUMNS = ['Fixations', 'X (m)', 'Y (m)', 'Z (m)'];

/** Longest fixation name drawn in full. The report's are two letters; a longer one is cut so it stays in its column and the row keeps its height. */
const FIXATION_NAME_MAX = 12;

/**
 * Widths of the columns of the enclosure table of a pocket card, in mm, on the card's 93 mm. The Type column takes whatever
 * these leave. The print view, the PDF and the PNG all use this one map (the PNG scales it), so they agree on where each column
 * sits and on how much room Type has.
 */
export const CARD_TABLE_WIDTHS_MM: Readonly<Record<string, number>> = { '#': 6, 'Col #': 12, 'Row #': 12, Panflex: 13, Angle: 11, Feeder: 12, Way: 9 };
/** Width of each of the X, Y and Z columns of the fixation block, in mm. */
export const FIXATION_NUMBER_MM = 14;

/** The chip behind a feeder or way digit: 3.4 mm wide and 8.4 pt high, with a 0.2 mm outline when its colour has one. */
export const PATCH_CHIP = { widthMm: 3.4, heightPt: 8.4, outlineMm: 0.2 };

/** The look of a blank cell of a patch column: an empty box with a thin black outline, so a person can write in it in pencil. */
export const EMPTY_PATCH_BOX: PatchColour = { name: 'empty', fill: '#ffffff', text: '#000000', outline: '#000000' };

/** The chip of a cell of a patch column: its colour when it holds a digit, the empty pencil box when it is blank, and null for every other column. */
export function patchChip(column: string, cell: string): PatchColour | null {
  if (!isPatchColumn(column)) return null;
  return cell === '' ? EMPTY_PATCH_BOX : (PATCH_COLOURS[cell as PatchDigit] ?? null);
}

/** True when a column of the enclosure table is set left. Every other value is centred. */
export const isLeftColumn = (column: string): boolean => column === 'Type';

export function fixationName(name: string): string {
  return name.length > FIXATION_NAME_MAX ? `${name.slice(0, FIXATION_NAME_MAX - 1)}…` : name;
}

/** One Soundvision warning as a sentence, the same on the screen card, the print preview, the PNG and the PDF. */
export function warningText(w: { title: string; message: string }): string {
  if (!w.message) return w.title;
  return w.title.endsWith('.') ? `${w.title} ${w.message}` : `${w.title}. ${w.message}`;
}

/**
 * The pickup row of a card, the same on the screen card, the print view, the PNG and the PDF. An array with one pickup shows
 * the position number as its frame and bar hole; with two, each pickup is named front or rear.
 */
export function pickupFact(pickups: readonly { which: 'front' | 'rear'; position: number | string }[]): [label: string, value: string] {
  if (pickups.length === 0) return ['Pickups', NOT_STATED];
  if (pickups.length === 1) return ['Frame/Bar Hole', String(pickups[0]?.position)];
  return ['Pickups', pickups.map((p) => `${p.which === 'front' ? 'Front' : 'Rear'} ${p.position}`).join(', ')];
}

/**
 * The frame and pickup rows of a card, the same on the screen card, the print view, the PNG and the PDF. An array with one pickup
 * has one row, the frame and the position number as its bar hole, joined with a slash like its label. Otherwise the frame and the
 * pickups are separate rows.
 */
export function frameFacts(
  bumper: string | null,
  pickups: readonly { which: 'front' | 'rear'; position: number | string }[],
): [label: string, value: string][] {
  if (pickups.length === 1) {
    const hole = String(pickups[0]?.position);
    return [['Frame/Bar Hole', bumper === null ? hole : `${bumper} / ${hole}`]];
  }
  return [['Frame', bumper ?? NOT_STATED], pickupFact(pickups)];
}

export function cardContent(entry: SheetEntry, ctx: CardContext): CardContent {
  const c = entry.column;

  const facts: CardContent['facts'] = [['Total mass', kg(c.totalMass)]];
  if (c.motors !== null) {
    facts.push(['Front motor load', kg(c.frontMotorLoad)]);
    if (c.motors > 1 || c.rearMotorLoad !== null) facts.push(['Rear motor load', kg(c.rearMotorLoad)]);
  }
  // The ground offset row is only there when an offset is in use, or when the one typed cannot be read.
  if (entry.offset.value !== 0) facts.push(['Ground offset', entry.offset.value === null ? NOT_STATED : metres(entry.offset.value)]);
  facts.push(
    ['Top height', metres(c.topHeight)],
    ['Bottom height', metres(c.bottomHeight)],
    ['Top site', degrees(c.topSite)],
    ['Azimuth', degrees(c.azimuth)],
    ...frameFacts(c.bumper, c.pickups),
  );

  const hasAngles = c.rows.some((r) => r.angle !== null);
  const hasPanflex = c.rows.some((r) => r.panflexPrinted !== null);
  const hasColumns = c.rows.some((r) => r.column !== null);
  const hasStackRows = c.rows.some((r) => r.row !== null);
  // The feeder and the way come last. A blank patch is a blank cell, drawn as an empty box, never a dash, because a dash means the
  // report does not state the value. The per enclosure site angle is not on the card.
  const columns = [hasColumns ? 'Col #' : hasStackRows ? 'Row #' : '#', 'Type', ...(hasPanflex ? ['Panflex'] : []), ...(hasAngles ? ['Angle'] : []), ...PATCH_COLUMNS];
  const rows = c.rows.map((r, i) => [
    enclosureLabel(r),
    r.type,
    ...(hasPanflex ? [r.panflex ? `${r.panflex.text}${r.panflex.sideUnknown ? '?' : ''}` : (r.panflexPrinted ?? NOT_STATED)] : []),
    ...(hasAngles ? [num(r.angle)] : []),
    entry.patch[i]?.feeder ?? '',
    entry.patch[i]?.way ?? '',
  ]);

  const status = `${STATUS_LABELS[ctx.status]}${ctx.revision ? ` Rev ${ctx.revision}` : ''}`;
  return {
    title: c.name,
    subtitle: [c.group, c.configuration ?? 'configuration not stated'].filter(Boolean).join(' · '),
    context: [ctx.show.trim(), ctx.venue.trim(), showDateText(ctx.showDate ?? ''), status, ctx.zAxisZero.trim() ? `Z-axis zero: ${ctx.zAxisZero.trim()}` : ''].filter(Boolean).join(' · '),
    reportNameNote: entry.renamed ? `Soundvision name: ${entry.reportName}` : null,
    note: entry.note.trim() === '' ? null : entry.note.trim(),
    mirrorNote: entry.coversMirror ? `Also mirrored with: ${entry.coversMirror}` : entry.mirrorOf ? `Also mirrored with: ${entry.mirrorOf}` : null,
    facts,
    fixations: c.fixations.map((f) => [fixationName(f.name), String(f.at.x), String(f.at.y), String(f.at.z)]),
    warnings: c.warnings.map((w) => ({ ...w })),
    columns,
    rows,
    cartShade: c.rows.map((_, i) => entry.carts.shade[i] === true),
  };
}
