// What one array's card says, as plain data. The printed pocket card and the PNG export both draw from
// this, so they show the same thing as each other and as the screen.

import { enclosureLabel } from '../engine/types';
import { STATUS_LABELS, type Status } from '../files/doc';
import { degrees, kg, metres, NOT_STATED, num } from '../ui/format';
import type { SheetEntry } from '../ui/sheet-model';

export interface CardContext {
  show: string;
  venue: string;
  status: Status;
  revision: string;
  zAxisZero: string;
}

export interface CardContent {
  title: string;
  /** Group and configuration. */
  subtitle: string;
  /** Show, status and Z-axis zero, so a card on its own is still traceable. */
  context: string;
  /** "Also mirrored with: " and the name of the other array, when this card stands for a mirror image or is one. */
  mirrorNote: string | null;
  facts: [label: string, value: string][];
  /** One row per fixation: name, X, Y, Z as the report prints them. Empty when the report states none. */
  fixations: string[][];
  warnings: { severity: string; title: string; message: string }[];
  columns: string[];
  rows: string[][];
}

/** Heading of the fixation block and its columns. Z is the report's own, with no ground offset taken off. */
export const FIXATION_COLUMNS = ['Fixations', 'X (m)', 'Y (m)', 'Z (m)'];

/** Longest fixation name drawn in full. The report's are two letters; a longer one is cut so it stays in its column and the row keeps its height. */
const FIXATION_NAME_MAX = 12;

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

export function cardContent(entry: SheetEntry, ctx: CardContext): CardContent {
  const c = entry.column;

  const facts: CardContent['facts'] = [['Total mass', kg(c.totalMass)]];
  if (c.motors !== null) {
    facts.push(['Front motor load', kg(c.frontMotorLoad)]);
    if (c.motors > 1 || c.rearMotorLoad !== null) facts.push(['Rear motor load', kg(c.rearMotorLoad)]);
  }
  facts.push(
    ['Ground offset', entry.offset.value === null ? NOT_STATED : metres(entry.offset.value)],
    ['Top height', metres(c.topHeight)],
    ['Bottom height', metres(c.bottomHeight)],
    ['Top site', degrees(c.topSite)],
    ['Bottom site', degrees(c.bottomSite)],
    ['Azimuth', degrees(c.azimuth)],
    ['Frame', c.bumper ?? NOT_STATED],
    pickupFact(c.pickups),
    ['Position X, Y, Z', c.position ? `${c.position.x}, ${c.position.y}, ${c.position.z} m` : NOT_STATED],
  );

  const hasAngles = c.rows.some((r) => r.angle !== null);
  const hasPanflex = c.rows.some((r) => r.panflexPrinted !== null);
  const hasColumns = c.rows.some((r) => r.column !== null);
  const columns = [hasColumns ? 'Col #' : '#', 'Type', ...(hasPanflex ? ['Panflex'] : []), ...(hasAngles ? ['Angle'] : []), 'Site'];
  const rows = c.rows.map((r) => [
    enclosureLabel(r),
    r.type,
    ...(hasPanflex ? [r.panflex ? `${r.panflex.text}${r.panflex.sideUnknown ? '?' : ''}` : (r.panflexPrinted ?? NOT_STATED)] : []),
    ...(hasAngles ? [num(r.angle)] : []),
    num(r.site),
  ]);

  const status = `${STATUS_LABELS[ctx.status]}${ctx.revision ? ` Rev ${ctx.revision}` : ''}`;
  return {
    title: c.name,
    subtitle: [c.group, c.configuration ?? 'configuration not stated'].filter(Boolean).join(' · '),
    context: [ctx.show.trim(), ctx.venue.trim(), status, ctx.zAxisZero.trim() ? `Z-axis zero: ${ctx.zAxisZero.trim()}` : ''].filter(Boolean).join(' · '),
    mirrorNote: entry.coversMirror ? `Also mirrored with: ${entry.coversMirror}` : entry.mirrorOf ? `Also mirrored with: ${entry.mirrorOf}` : null,
    facts,
    fixations: c.fixations.map((f) => [fixationName(f.name), String(f.at.x), String(f.at.y), String(f.at.z)]),
    warnings: c.warnings.map((w) => ({ ...w })),
    columns,
    rows,
  };
}
