// Lays out the parts of the PDF as drawing steps in points (pure, so it can be tested without a
// browser): one pocket card, and the rigging summary page. pdf-export.ts draws them with pdf-lib.
// Sizes match the print stylesheet, so the downloaded PDF and the printed sheet look alike.

import { edgeText, riggingEdgeNote, riggingNote, type FixationRow, type RiggingRow } from '../engine/sheet';
import { NOT_STATED } from '../ui/format';
import { clipMiddle, wrap, type DrawOp, type Measure } from './array-image';
import { FIXATION_COLUMNS, warningText, type CardContent } from './card-content';
import { CARD_W_MM, PX_PER_MM } from './layout';
import { SMALL_PRINT } from './small-print';

export const PT_PER_MM = 72 / 25.4;
const mm = (n: number) => n * PT_PER_MM;
/** Points to the CSS pixels the page planner works in. */
export const ptToPx = (pt: number) => (pt / PT_PER_MM) * PX_PER_MM;

export interface Laid {
  width: number;
  height: number;
  ops: DrawOp[];
}

/** Height of a fact row and of a table row in the print stylesheet, as Chromium lays them out: 14.0625 CSS pixels. */
const ROW_PT = 10.546875;
/** A border of 0.25 or 0.4 mm is drawn one CSS pixel wide in Chromium, and takes that much height. */
const BORDER_PT = 0.75;
/** The table's top border, one CSS pixel. */
const TABLE_EDGE_PT = BORDER_PT;

/** The gap between a fact's label and its value (2 mm in the print stylesheet). */
const FACT_GAP_PT = mm(2);

const FONT_SIZES = { title: 11, subtitle: 7, note: 6.5, body: 7 };

function textOp(x: number, y: number, text: string, size: number, opts: { bold?: boolean; color?: string; align?: 'left' | 'right' | 'center' } = {}): DrawOp {
  return { op: 'text', x, y, text, size, bold: opts.bold ?? false, align: opts.align ?? 'left', color: opts.color ?? '#000' };
}

/** Wraps text that follows a lead on the first line: that line is `firstMax` wide, the rest `max`. The first line may be empty. */
function wrapAfterLead(text: string, size: number, bold: boolean, firstMax: number, max: number, measure: Measure): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  let first = '';
  let n = 0;
  for (; n < words.length; n++) {
    const trial = first ? `${first} ${words[n]}` : (words[n] as string);
    if (measure(trial, size, bold) > firstMax) break;
    first = trial;
  }
  const rest = words.slice(n).join(' ');
  return rest ? [first, ...wrap(rest, size, bold, max, measure)] : [first];
}

/** One array as a pocket card, at the width of an A6 panel less its padding. Height depends on the content. */
export function layoutPocketCard(content: CardContent, measure: Measure): Laid {
  const W = mm(CARD_W_MM);
  const ops: DrawOp[] = [];
  let y = 0;

  // Every number below is the print stylesheet's (.pc in print.css), so the card comes out the same height there.
  const paragraph = (text: string, size: number, lineHeight: number, opts: { bold?: boolean; color?: string } = {}) => {
    for (const line of wrap(text, size, opts.bold ?? false, W, measure)) {
      ops.push(textOp(0, y, line, size, opts));
      y += size * lineHeight;
    }
  };

  paragraph(content.title, FONT_SIZES.title, 1.15, { bold: true });
  paragraph(content.subtitle, FONT_SIZES.subtitle, 1.2);
  y += mm(0.5);

  const padX = mm(1);
  const padY = mm(0.6);
  /** A bordered box of text. `lead` is a bold word at the start of the first line. */
  const box = (lead: string | null, text: string, borderMm: number, boldAll: boolean) => {
    const size = FONT_SIZES.note;
    const border = BORDER_PT;
    const lead_ = lead ? `${lead} ` : '';
    const indent = lead_ ? measure(lead_, size, true) : 0;
    const inner = W - 2 * padX - 2 * border;
    // The sheet runs the bold word into the text, so only the first line is shorter by its width.
    const lines = lead_ ? wrapAfterLead(text, size, boldAll, inner - indent, inner, measure) : wrap(text, size, boldAll, inner, measure);
    const lineH = size * 1.2;
    const h = lines.length * lineH + 2 * padY + 2 * border;
    ops.push({ op: 'rect', x: 0, y, w: W, h, fill: null, stroke: '#000', lineWidth: mm(borderMm) });
    lines.forEach((line, i) => {
      if (i === 0 && lead_) ops.push(textOp(padX + border, y + border + padY, lead_.trim(), size, { bold: true }));
      if (line) ops.push(textOp(padX + border + (i === 0 ? indent : 0), y + border + padY + i * lineH, line, size, { bold: boldAll }));
    });
    y += h;
  };

  // A plain small line under the title, not a box, so it cannot be mistaken for a warning.
  if (content.mirrorNote) {
    paragraph(content.mirrorNote, FONT_SIZES.note, 1.2);
    y += mm(1);
  }
  for (const w of content.warnings) {
    box(w.severity, warningText(w), 0.4, false);
    y += mm(0.6);
  }
  // The last box's gap and the list's own margin collapse into one of 1 mm.
  if (content.warnings.length > 0) y += mm(0.4);

  // Facts: label on the left, value in bold on the right, a light line under each.
  // Chromium lays a fact row out at 14.0625 CSS pixels (10.546875 pt), the line, the padding and the hairline together.
  // A long value wraps in the space the label leaves (the sheet gives it overflow-wrap: anywhere) and each extra line
  // makes the row one line taller.
  const factLineH = FONT_SIZES.body * 1.2;
  for (const [label, value] of content.facts) {
    const room = W - measure(label, FONT_SIZES.body, false) - FACT_GAP_PT;
    const lines = wrap(value, FONT_SIZES.body, true, room, measure);
    const rowH = ROW_PT + (lines.length - 1) * factLineH;
    ops.push(textOp(0, y + 0.5, label, FONT_SIZES.body));
    lines.forEach((line, i) => ops.push(textOp(W, y + 0.5 + i * factLineH, line, FONT_SIZES.body, { bold: true, align: 'right' })));
    ops.push({ op: 'line', x1: 0, y1: y + rowH, x2: W, y2: y + rowH, width: 0.4, color: '#bbbbbb' });
    y += rowH;
  }
  y += mm(1);

  // Tables. The first column or Type takes whatever the fixed columns leave. The print stylesheet's table rows come out
  // 14.0625 CSS pixels (10.546875 pt) high in Chromium, which an e2e test measures, so the same height is used
  // here and the two agree on where a card stops fitting.
  const tableRowH = ROW_PT;
  const fixed: Record<string, number> = { '#': mm(6), 'Col #': mm(13), Panflex: mm(17), Angle: mm(13), Site: mm(15), 'X (m)': mm(14), 'Y (m)': mm(14), 'Z (m)': mm(14) };
  const table = (columns: string[], rows: string[][], leftAt: number) => {
    const widths = columns.map((c) => fixed[c] ?? 0);
    widths[leftAt] = W - widths.reduce((a, b) => a + b, 0);
    const xs = widths.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? 0) + w], [0]);
    const cell = (cells: string[], header: boolean) => {
      if (header) ops.push({ op: 'rect', x: 0, y, w: W, h: tableRowH, fill: '#e4e4e4', stroke: null, lineWidth: 0 });
      cells.forEach((text, i) => {
        const left = i === leftAt;
        ops.push(
          textOp(left ? (xs[i] ?? 0) + 2 : (xs[i + 1] ?? W) - 2, y + 0.5, text, FONT_SIZES.body, {
            bold: header || i === 0,
            align: left ? 'left' : 'right',
          }),
        );
      });
      ops.push({ op: 'line', x1: 0, y1: y + tableRowH, x2: W, y2: y + tableRowH, width: 0.4, color: '#777777' });
      xs.forEach((x) => ops.push({ op: 'line', x1: x, y1: y, x2: x, y2: y + tableRowH, width: 0.4, color: '#777777' }));
      y += tableRowH;
    };
    ops.push({ op: 'line', x1: 0, y1: y, x2: W, y2: y, width: 0.4, color: '#777777' });
    y += TABLE_EDGE_PT;
    cell(columns, true);
    for (const row of rows) cell(row, false);
  };
  // Fixations sit under the facts, with the same 1 mm gap below as the facts have (.pc-fix in print.css).
  if (content.fixations.length > 0) {
    table(FIXATION_COLUMNS, content.fixations, 0);
    y += mm(1);
  }
  table(content.columns, content.rows, content.columns.indexOf('Type'));

  return { width: W, height: y, ops };
}

export const RIGGING_PICKUP_COLUMNS = ['Array', 'Pickup', 'Position no.', 'X (m)', 'Y (m)', 'Z (m)', 'Load (kg)', 'To front (m)', 'To rear (m)'];
export const RIGGING_FIXATION_COLUMNS = ['Array', 'Fixation', 'X (m)', 'Y (m)', 'Z (m)'];
/** Column widths on the 192 mm rigging page; the print stylesheet's tables use the same shares. */
export const RIGGING_PICKUP_WIDTHS_MM = [52, 14, 21, 15, 15, 15, 18, 21, 21];
export const RIGGING_FIXATION_WIDTHS_MM = [80, 40, 24, 24, 24];
/** What a cell keeps free of text: its padding on both sides and the border (1.2 mm each side, as the stylesheet pads). */
export const RIGGING_CELL_PAD_PT = mm(2.4) + 2;

/** A table cell's text, cut in the middle with an ellipsis to fit a column of this width (in mm, on the 192 mm page). The print preview and the PDF both use it. */
export function clipRiggingCell(text: string, columnMm: number, bold: boolean, measure: Measure, size = 8): string {
  return clipMiddle(text, size, bold, mm(columnMm) - RIGGING_CELL_PAD_PT, measure);
}

/** The line under the rigging heading: show, venue and Z-axis zero. The print preview and the PDF both use it. */
export function riggingSubtitle(job: { show: string; venue: string; zAxisZero: string }): string {
  return [job.show.trim(), job.venue.trim(), job.zAxisZero.trim() ? `Z-axis zero: ${job.zAxisZero.trim()}` : ''].filter(Boolean).join(' · ');
}

export interface RiggingInput {
  rows: readonly RiggingRow[];
  fixations: readonly FixationRow[];
  /** Show and venue line under the heading. */
  subtitle: string;
  /** Dark squares of the QR code, and the address it holds. */
  qr: boolean[][];
  qrUrl: string;
}

/** The rigging summary page, with the QR code and the small print. Width is the page less the margins. */
export function layoutRiggingPage(input: RiggingInput, measure: Measure, widthMm = 192): Laid {
  const W = mm(widthMm);
  const ops: DrawOp[] = [];
  let y = 0;

  ops.push(textOp(0, y, 'Rigging summary', 14, { bold: true }));
  y += 14 * 1.3;
  if (input.subtitle) {
    ops.push(textOp(0, y, input.subtitle, 8));
  }

  // QR code at the top right, 30 mm square with its quiet zone, and the address under it.
  const quiet = 4;
  const modules = input.qr.length + 2 * quiet;
  const qrSize = mm(30);
  const unit = qrSize / modules;
  const qx = W - qrSize;
  input.qr.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      let end = c;
      while (end < row.length && row[end]) end++;
      ops.push({ op: 'rect', x: qx + (c + quiet) * unit, y: (r + quiet) * unit, w: (end - c) * unit, h: unit, fill: '#000000', stroke: null, lineWidth: 0 });
      c = end;
    }
  });
  let cy = qrSize + 2;
  ops.push(textOp(qx + qrSize / 2, cy, 'RigPoint Array', 5.5, { align: 'center' }));
  cy += 5.5 * 1.2;
  for (const line of wrap(input.qrUrl, 5.5, false, qrSize, measure)) {
    ops.push(textOp(qx + qrSize / 2, cy, line, 5.5, { align: 'center' }));
    cy += 5.5 * 1.2;
  }

  y = Math.max(y + 8 * 1.5, cy) + mm(3);

  /** A table whose first two columns are text and the rest numbers. Text that does not fit its column is cut with an ellipsis. */
  const table = (heads: string[], widthsMm: number[], body: string[][], compact = false) => {
    const xs = widthsMm.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? 0) + mm((w * widthMm) / 192)], [0]);
    // The fixation table uses a pocket card's rows (7 pt text, 10.5 pt high) so the long list costs the page little scale.
    const size = compact ? FONT_SIZES.body : 8;
    const rowH = compact ? ROW_PT : 8 * 1.2 + mm(1.2);
    const row = (cells: string[], header: boolean) => {
      if (header) ops.push({ op: 'rect', x: 0, y, w: W, h: rowH, fill: '#e4e4e4', stroke: null, lineWidth: 0 });
      cells.forEach((text, i) => {
        const left = i < 2;
        const shown = clipRiggingCell(text, ((xs[i + 1] ?? W) - (xs[i] ?? 0)) / PT_PER_MM, header, measure, size);
        ops.push(textOp(left ? (xs[i] ?? 0) + 3 : (xs[i + 1] ?? W) - 3, y + (compact ? 0.5 : 2), shown, size, { bold: header, align: left ? 'left' : 'right' }));
      });
      ops.push({ op: 'line', x1: 0, y1: y + rowH, x2: W, y2: y + rowH, width: 0.4, color: '#777777' });
      xs.forEach((x) => ops.push({ op: 'line', x1: x, y1: y, x2: x, y2: y + rowH, width: 0.4, color: '#777777' }));
      y += rowH;
    };
    ops.push({ op: 'line', x1: 0, y1: y, x2: W, y2: y, width: 0.4, color: '#777777' });
    if (compact) y += TABLE_EDGE_PT;
    row(heads, true);
    for (const r of body) row(r, false);
  };

  if (input.rows.length === 0) {
    ops.push(textOp(0, y, 'No flown array in this report has a pickup position.', 7));
    y += 7 * 1.5;
  } else {
    table(
      RIGGING_PICKUP_COLUMNS,
      RIGGING_PICKUP_WIDTHS_MM,
      input.rows.map((r) => [r.source, r.location, String(r.pickupPosition), String(r.x), String(r.y), String(r.z), r.load === null ? NOT_STATED : String(r.load), edgeText(r, 'toFront', NOT_STATED), edgeText(r, 'toRear', NOT_STATED)]),
    );
  }
  if (input.fixations.length > 0) {
    y += mm(3);
    table(
      RIGGING_FIXATION_COLUMNS,
      RIGGING_FIXATION_WIDTHS_MM,
      input.fixations.map((f) => [f.source, f.name, String(f.x), String(f.y), String(f.z)]),
      true,
    );
  }
  const note = riggingNote(input.rows.length > 0, input.fixations.length > 0);
  if (note) {
    y += 4;
    ops.push(textOp(0, y, note, 7));
    y += 7 * 1.3;
  }
  const edgeNote = riggingEdgeNote(input.rows.length > 0);
  if (edgeNote) {
    y += 2;
    for (const line of wrap(edgeNote, 7, false, W, measure)) {
      ops.push(textOp(0, y, line, 7));
      y += 7 * 1.3;
    }
  }

  // The approved disclaimer, word for word.
  y += mm(6);
  ops.push({ op: 'line', x1: 0, y1: y, x2: W, y2: y, width: 0.7, color: '#000000' });
  y += mm(2);
  for (const p of SMALL_PRINT) {
    const size = 6.5;
    const lead = p.label ? `${p.label} ` : '';
    const indent = lead ? measure(lead, size, true) : 0;
    const lines = wrap(p.text, size, false, W - indent, measure);
    lines.forEach((line, i) => {
      if (i === 0 && lead) ops.push(textOp(0, y, p.label ?? '', size, { bold: true }));
      ops.push(textOp(i === 0 ? indent : 0, y, line, size));
      y += size * 1.25;
    });
    y += mm(1);
  }

  return { width: W, height: y, ops };
}
