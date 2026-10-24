// The cable patch plan: for each enclosure row of an array, a feeder and a way, each one digit. It is notes only. Nothing here
// counts feeders or ways, checks them against anything or works out a load or a length. The colours are the resistor code,
// so a digit can also be read from a colour chip across a stage.

import { matchByName } from './compare';
import type { Report } from './types';

/** The ten values a feeder or a way can take, in the order the dropdown lists them. Blank is also allowed. */
export const PATCH_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;
export type PatchDigit = (typeof PATCH_DIGITS)[number];
/** A feeder or a way as stored: one digit, or blank for nothing chosen. */
export type PatchValue = PatchDigit | '';

/** The feeder and the way of one enclosure row. */
export interface PatchRow {
  feeder: PatchValue;
  way: PatchValue;
}

export type PatchField = keyof PatchRow;

export const EMPTY_PATCH_ROW: PatchRow = { feeder: '', way: '' };

export const emptyPatchRow = (): PatchRow => ({ ...EMPTY_PATCH_ROW });

export const isPatchValue = (v: unknown): v is PatchValue => v === '' || (typeof v === 'string' && (PATCH_DIGITS as readonly string[]).includes(v));

/** True when a row has a feeder or a way. */
export const patchRowUsed = (r: PatchRow): boolean => r.feeder !== '' || r.way !== '';

/** True when any row of a patch has a feeder or a way. */
export const patchUsed = (rows: readonly PatchRow[]): boolean => rows.some(patchRowUsed);

/** The colour of a digit: the chip behind it, the text on the chip, and an outline for a chip that would vanish on white paper. */
export interface PatchColour {
  name: string;
  fill: string;
  text: string;
  outline: string | null;
}

/**
 * The resistor colour code. The shades are chosen so that, ordered from dark to light by printer luma, the ten chips rise in
 * steps of at least 20 out of 255, which keeps them apart in a black and white print, and so that the digit on every chip is
 * easy to read. docs/development.md has the figures and a test holds them.
 */
export const PATCH_COLOURS: Record<PatchDigit, PatchColour> = {
  '1': { name: 'brown', fill: '#3f1d08', text: '#ffffff', outline: null },
  '2': { name: 'red', fill: '#ec4444', text: '#000000', outline: null },
  '3': { name: 'orange', fill: '#ffa640', text: '#000000', outline: null },
  '4': { name: 'yellow', fill: '#fff040', text: '#000000', outline: null },
  '5': { name: 'green', fill: '#40c050', text: '#000000', outline: null },
  '6': { name: 'blue', fill: '#1840c0', text: '#ffffff', outline: null },
  '7': { name: 'violet', fill: '#8438c8', text: '#ffffff', outline: null },
  '8': { name: 'grey', fill: '#cccccc', text: '#000000', outline: null },
  '9': { name: 'white', fill: '#ffffff', text: '#000000', outline: '#000000' },
  '0': { name: 'black', fill: '#000000', text: '#ffffff', outline: null },
};

/** The luma a black and white printer is taken to give a colour, 0 to 255: 0.299 R + 0.587 G + 0.114 B. */
export function printerLuma(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

/** The digits ordered from the darkest chip to the lightest. */
export const PATCH_LUMA_ORDER: readonly PatchDigit[] = ['0', '1', '6', '7', '2', '5', '3', '8', '4', '9'];

/** The patch of an array that has nothing set: one empty row per enclosure. */
export const blankPatch = (rows: number): PatchRow[] => Array.from({ length: rows }, emptyPatchRow);

/** A saved patch fitted to `rows` enclosures: short lists are padded with blanks, long ones cut. Used only for display. */
export function fitPatch(patch: readonly PatchRow[] | undefined, rows: number): PatchRow[] {
  return Array.from({ length: rows }, (_, i) => ({ ...(patch?.[i] ?? EMPTY_PATCH_ROW) }));
}

/** The column titles of the two patch columns, on the screen card, the print view, the PDF and the PNG. */
export const PATCH_COLUMNS = ['Feeder', 'Way'] as const;
export const isPatchColumn = (title: string): boolean => (PATCH_COLUMNS as readonly string[]).includes(title);

/** What follows from Update from PDF: the patches that carry over, by position in the new report, and the ones that cannot. */
export interface TrackedPatches {
  kept: Record<number, PatchRow[]>;
  reset: { array: string; rows: number; wasRows: number; nowRows: number }[];
}

/**
 * Update from PDF keeps an array's patch, row for row, when the array of the same name still has the same number of
 * enclosures. When the count differs the rows cannot be matched with any confidence, so that array's patch is cleared and
 * listed. An array that has no patch set, or that the new PDF no longer has, is not listed.
 */
export function trackPatches(saved: Report, next: Report, patches: Readonly<Record<number, readonly PatchRow[]>>): TrackedPatches {
  const map = matchByName(saved, next);
  const kept: Record<number, PatchRow[]> = {};
  const reset: TrackedPatches['reset'] = [];
  for (const [key, rows] of Object.entries(patches)) {
    const i = Number(key);
    const j = map.get(i);
    if (j === undefined || !patchUsed(rows)) continue;
    const was = saved.sources[i]?.cabinets.length ?? 0;
    const now = next.sources[j]?.cabinets.length ?? 0;
    if (was === now) kept[j] = fitPatch(rows, now);
    else reset.push({ array: saved.sources[i]?.name ?? '', rows: rows.filter(patchRowUsed).length, wasRows: was, nowRows: now });
  }
  return { kept, reset };
}
