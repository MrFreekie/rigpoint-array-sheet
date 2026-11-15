// Lays out the parts of the PDF as drawing steps in points (pure, so it can be tested without a
// browser): one pocket card, and the rigging summary page. pdf-export.ts draws them with pdf-lib.
// Sizes match the print stylesheet, so the downloaded PDF and the printed sheet look alike.

import { EXTRA_TABLE_COLUMNS, EXTRA_TABLE_LEFT_COLUMNS, EXTRA_TABLE_TITLE, EXTRA_TABLE_WIDTHS_MM, extraTableRows, extrasUsed, weightTableColumns, weightTableRows, weightTableWidthsMm, type FixationRow, type RiggingRow, type RiggingWeight } from '../engine/sheet';
import { CLOUD_LINK_HEADING, CLOUD_LINK_LABEL } from '../files/cloud-url';
import { showDateText } from '../files/show-date';
import { NOT_STATED } from '../ui/format';
import { clipMiddle, clipToWidth, noteLines, wrap, wrapAfterLead, type DrawOp, type Measure } from './array-image';
import { CART_SHADE } from '../engine/carts';
import { isPatchColumn } from '../engine/patch';
import { CARD_TABLE_WIDTHS_MM, FIXATION_COLUMNS, FIXATION_NUMBER_MM, isLeftColumn, PATCH_CHIP, patchChip, warningText, type CardContent } from './card-content';
import { CARD_W_MM, PX_PER_MM } from './layout';
import { SMALL_PRINT } from './small-print';

export const PT_PER_MM = 72 / 25.4;
const mm = (n: number) => n * PT_PER_MM;
/** Points to the CSS pixels the page planner works in. */
export const ptToPx = (pt: number) => (pt / PT_PER_MM) * PX_PER_MM;

/** A clickable area of a page, in the same points as the ops, that opens an address. */
export interface LinkArea {
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
}

export interface Laid {
  width: number;
  height: number;
  ops: DrawOp[];
  /** The areas that are links, in the PDF. The print view draws its own anchors. */
  links?: LinkArea[];
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
  if (content.reportNameNote) {
    paragraph(content.reportNameNote, FONT_SIZES.note, 1.2);
    y += mm(1);
  }
  // The crew's note: a plain paragraph, "Note:" in bold running into the first line, the person's line breaks kept.
  if (content.note) {
    const size = FONT_SIZES.note;
    const lead = measure('Note: ', size, true);
    for (const line of noteLines(content.note, size, W, measure)) {
      if (line.lead) ops.push(textOp(0, y, 'Note:', size, { bold: true }));
      if (line.text) ops.push(textOp(line.lead ? lead : 0, y, line.text, size));
      y += size * 1.2;
    }
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

  // Tables. Fixed columns, and one column that takes whatever they leave. The print stylesheet's table rows come out
  // 14.0625 CSS pixels (10.546875 pt) high in Chromium, which an e2e test measures, so the same height is used
  // here and the two agree on where a card stops fitting.
  const tableRowH = ROW_PT;
  /**
   * `left` is the index of the column that is set left and takes whatever the others leave; every other cell is centred.
   * A cell of a patch column that holds a digit is a colour chip with the digit on it.
   */
  const table = (columns: string[], rows: string[][], left: number, widthsMm: Readonly<Record<string, number>>, shade: readonly boolean[] = []) => {
    const widths = columns.map((c) => mm(widthsMm[c] ?? 0));
    widths[left] = W - widths.reduce((a, b) => a + b, 0);
    const xs = widths.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? 0) + w], [0]);
    // A shaded cart fills its rows from the left edge to the first patch column, so the chips and the pencil boxes stay on white.
    const firstPatch = columns.findIndex(isPatchColumn);
    const shadeTo = firstPatch === -1 ? W : (xs[firstPatch] ?? W);
    const cell = (cells: string[], header: boolean, shaded = false) => {
      if (header) ops.push({ op: 'rect', x: 0, y, w: W, h: tableRowH, fill: '#e4e4e4', stroke: null, lineWidth: 0 });
      else if (shaded) ops.push({ op: 'rect', x: 0, y: y + 0.2, w: shadeTo, h: tableRowH - 0.2, fill: CART_SHADE, stroke: null, lineWidth: 0 });
      cells.forEach((text, i) => {
        const isLeft = i === left;
        const bold = header || i === 0;
        const x0 = xs[i] ?? 0;
        const x1 = xs[i + 1] ?? W;
        const chip = header ? null : patchChip(columns[i] ?? '', text);
        if (chip) {
          const cw = mm(PATCH_CHIP.widthMm);
          const cx = (x0 + x1) / 2;
          const top = y + (tableRowH - PATCH_CHIP.heightPt) / 2;
          ops.push({ op: 'rect', x: cx - cw / 2, y: top, w: cw, h: PATCH_CHIP.heightPt, fill: chip.fill, stroke: chip.outline, lineWidth: chip.outline ? mm(PATCH_CHIP.outlineMm) : 0 });
          if (text !== '') ops.push(textOp(cx, y + 1.3, text, FONT_SIZES.body, { bold: true, align: 'center', color: chip.text }));
          return;
        }
        // Type is cut with an ellipsis so it stays on one line in its column and the row keeps its height.
        const shown = isLeft ? clipToWidth(text, FONT_SIZES.body, bold, x1 - x0 - 4, measure) : text;
        ops.push(textOp(isLeft ? x0 + 2 : (x0 + x1) / 2, y + 0.5, shown, FONT_SIZES.body, { bold, align: isLeft ? 'left' : 'center' }));
      });
      ops.push({ op: 'line', x1: 0, y1: y + tableRowH, x2: W, y2: y + tableRowH, width: 0.4, color: '#777777' });
      xs.forEach((x) => ops.push({ op: 'line', x1: x, y1: y, x2: x, y2: y + tableRowH, width: 0.4, color: '#777777' }));
      y += tableRowH;
    };
    ops.push({ op: 'line', x1: 0, y1: y, x2: W, y2: y, width: 0.4, color: '#777777' });
    y += TABLE_EDGE_PT;
    cell(columns, true);
    rows.forEach((row, i) => cell(row, false, shade[i] === true));
  };
  // Fixations sit under the facts, with the same 1 mm gap below as the facts have (.pc-fix in print.css).
  if (content.fixations.length > 0) {
    table(FIXATION_COLUMNS, content.fixations, 0, { 'X (m)': FIXATION_NUMBER_MM, 'Y (m)': FIXATION_NUMBER_MM, 'Z (m)': FIXATION_NUMBER_MM });
    y += mm(1);
  }
  table(content.columns, content.rows, content.columns.findIndex(isLeftColumn), CARD_TABLE_WIDTHS_MM, content.cartShade);

  return { width: W, height: y, ops };
}

export const RIGGING_PICKUP_COLUMNS = ['Point', 'Array', 'Pickup', 'Position no.', 'X (m)', 'Y (m)', 'Z (m)', 'Load (kg)'];
export const RIGGING_FIXATION_COLUMNS = ['Array', 'Fixation', 'X (m)', 'Y (m)', 'Z (m)'];
/** Column widths on the 192 mm rigging page; the print stylesheet's tables use the same shares. */
export const RIGGING_PICKUP_WIDTHS_MM = [14, 60, 18, 26, 16, 16, 16, 26];
/** The columns of the Soundvision Array Pickup Points table that are left aligned: Array and Pickup. Every other column is centred. */
export const RIGGING_PICKUP_LEFT_COLUMNS = [1, 2];
/** Where the Array column sits in the Rigging Points table. */
export const RIGGING_PICKUP_ARRAY_COLUMN = 1;
export const RIGGING_FIXATION_WIDTHS_MM = [80, 40, 24, 24, 24];
/** What a cell keeps free of text: its padding on both sides and the border (1.2 mm each side, as the stylesheet pads). */
export const RIGGING_CELL_PAD_PT = mm(2.4) + 2;

/** A table cell's text, cut in the middle with an ellipsis to fit a column of this width (in mm, on the 192 mm page). The print preview and the PDF both use it. */
export function clipRiggingCell(text: string, columnMm: number, bold: boolean, measure: Measure, size = 8): string {
  return clipMiddle(text, size, bold, mm(columnMm) - RIGGING_CELL_PAD_PT, measure);
}

/** The line under the rigging heading: show, venue, show date and Z-axis zero. The print preview and the PDF both use it. */
export function riggingSubtitle(job: { show: string; venue: string; zAxisZero: string; showDate?: string }): string {
  return [job.show.trim(), job.venue.trim(), showDateText(job.showDate ?? ''), job.zAxisZero.trim() ? `Z-axis zero: ${job.zAxisZero.trim()}` : ''].filter(Boolean).join(' · ');
}

/** The notes for the whole show as printed on the rigging summary: line breaks kept, nothing when there are none. The print preview and the PDF both use it. */
export function riggingNotes(job: { notes: string }): string {
  return job.notes.trim() === '' ? '' : job.notes.replace(/\s+$/, '');
}

/** The lines of the show notes: each line break the person typed starts a new line, a blank line stays blank, long lines wrap. */
export function showNoteLines(notes: string, size: number, max: number, measure: Measure): string[] {
  return notes.split(/\r?\n/).flatMap((segment) => (segment.trim() === '' ? [''] : wrap(segment, size, false, max, measure)));
}

export interface RiggingInput {
  rows: readonly RiggingRow[];
  /** The weights of each array with a pickup: the report's total and, when typed, the additional weight. */
  weights?: readonly RiggingWeight[];
  fixations: readonly FixationRow[];
  /** Show and venue line under the heading. */
  subtitle: string;
  /** Notes for the whole show, or blank. Printed at the end of the page content, above the small print. */
  notes: string;
  /** Dark squares of the QR code, and the address it holds. */
  qr: boolean[][];
  qrUrl: string;
  /** The cloud link under the notes: the address and its QR code. Left out when the show has none. */
  cloud?: { url: string; qr: boolean[][] };
}

/** The dark squares of a QR code as rectangles, in a square of this size (points) with its quiet zone, top left at x, y. */
function pushQr(ops: DrawOp[], qr: boolean[][], x: number, y: number, size: number) {
  const quiet = 4;
  const unit = size / (qr.length + 2 * quiet);
  qr.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      let end = c;
      while (end < row.length && row[end]) end++;
      ops.push({ op: 'rect', x: x + (c + quiet) * unit, y: y + (r + quiet) * unit, w: (end - c) * unit, h: unit, fill: '#000000', stroke: null, lineWidth: 0 });
      c = end;
    }
  });
}

/** The rigging summary page, with the small print and, at the bottom, the QR code. Width is the page less the margins. */
export function layoutRiggingPage(input: RiggingInput, measure: Measure, widthMm = 192): Laid {
  const W = mm(widthMm);
  const ops: DrawOp[] = [];
  let y = 0;

  ops.push(textOp(0, y, 'Rigging summary', 14, { bold: true }));
  y += 14 * 1.3;
  if (input.subtitle) {
    ops.push(textOp(0, y, input.subtitle, 8));
  }

  y += 8 * 1.5 + mm(3);

  /** A table whose first columns are text (left) and the rest numbers (centred in their column). Text that does not fit its column is cut with an ellipsis. */
  const table = (heads: string[], widthsMm: number[], body: string[][], compact = false, leftCols: number | readonly number[] = 2) => {
    const isLeft = (i: number) => (typeof leftCols === 'number' ? i < leftCols : leftCols.includes(i));
    const xs = widthsMm.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? 0) + mm((w * widthMm) / 192)], [0]);
    // The fixation table uses a pocket card's rows (7 pt text, 10.5 pt high) so the long list costs the page little scale.
    const size = compact ? FONT_SIZES.body : 8;
    const rowH = compact ? ROW_PT : 8 * 1.2 + mm(1.2);
    const row = (cells: string[], header: boolean) => {
      if (header) ops.push({ op: 'rect', x: 0, y, w: W, h: rowH, fill: '#e4e4e4', stroke: null, lineWidth: 0 });
      cells.forEach((text, i) => {
        const left = isLeft(i);
        const shown = clipRiggingCell(text, ((xs[i + 1] ?? W) - (xs[i] ?? 0)) / PT_PER_MM, header, measure, size);
        ops.push(textOp(left ? (xs[i] ?? 0) + 3 : ((xs[i] ?? 0) + (xs[i + 1] ?? W)) / 2, y + (compact ? 0.5 : 2), shown, size, { bold: header, align: left ? 'left' : 'center' }));
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
    ops.push(textOp(0, y, 'Soundvision Array Pickup Points', 7, { bold: true }));
    y += 7 * 1.4;
    table(
      RIGGING_PICKUP_COLUMNS,
      RIGGING_PICKUP_WIDTHS_MM,
      input.rows.map((r) => [r.point, r.source, r.location, String(r.pickupPosition), String(r.x), String(r.y), String(r.z), r.load === null ? NOT_STATED : String(r.load)]),
      true,
      RIGGING_PICKUP_LEFT_COLUMNS,
    );
  }
  const heading = (text: string) => {
    y += mm(6);
    ops.push(textOp(0, y, text, 7, { bold: true }));
    y += 7 * 1.4;
  };
  const used = extrasUsed(input.rows);
  if (used) {
    heading(EXTRA_TABLE_TITLE);
    table(EXTRA_TABLE_COLUMNS, EXTRA_TABLE_WIDTHS_MM, extraTableRows(input.rows, NOT_STATED), true, EXTRA_TABLE_LEFT_COLUMNS);
  }
  const weights = input.weights ?? [];
  if (weights.length > 0) {
    heading('Array weights');
    table(weightTableColumns(used), weightTableWidthsMm(used), weightTableRows(weights, used, NOT_STATED), true, 1);
  }
  if (input.fixations.length > 0) {
    y += mm(6);
    table(
      RIGGING_FIXATION_COLUMNS,
      RIGGING_FIXATION_WIDTHS_MM,
      input.fixations.map((f) => [f.source, f.name, String(f.x), String(f.y), String(f.z)]),
      true,
    );
  }
  // The show notes, last of the content: a small heading, then the text with the person's line breaks kept.
  if (input.notes) {
    y += mm(3);
    ops.push(textOp(0, y, 'Notes', 7, { bold: true }));
    y += 7 * 1.4;
    for (const line of showNoteLines(input.notes, 8, W, measure)) {
      if (line) ops.push(textOp(0, y, line, 8));
      y += 8 * 1.3;
    }
  }

  // The cloud link, under the notes: its QR code on the left, the invitation and the address on the right.
  const links: LinkArea[] = [];
  if (input.cloud) {
    // Set apart from the summary: a space, a rule across the page, then the block.
    y += mm(7);
    ops.push({ op: 'line', x1: 0, y1: y, x2: W, y2: y, width: 0.4, color: '#777777' });
    y += mm(4);
    ops.push(textOp(0, y, CLOUD_LINK_HEADING, 7, { bold: true }));
    y += 7 * 1.4;
    const box = mm(22);
    pushQr(ops, input.cloud.qr, 0, y, box);
    links.push({ x: 0, y, w: box, h: box, url: input.cloud.url });
    const tx = box + mm(3);
    let ty = y + mm(3);
    for (const line of wrap(CLOUD_LINK_LABEL, 8, true, W - tx, measure)) {
      ops.push(textOp(tx, ty, line, 8, { bold: true }));
      ty += 8 * 1.3;
    }
    ty += 2;
    const w = measure(input.cloud.url, 7, false);
    ops.push(textOp(tx, ty, input.cloud.url, 7));
    ops.push({ op: 'line', x1: tx, y1: ty + 7 * 1.1, x2: tx + w, y2: ty + 7 * 1.1, width: 0.4, color: '#000000' });
    links.push({ x: tx, y: ty, w, h: 7 * 1.2, url: input.cloud.url });
    y += box;
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


  // The QR code at the bottom of the page, in the middle, 30 mm square with its quiet zone, and the address under it.
  y += mm(4);
  const qrSize = mm(30);
  const qx = (W - qrSize) / 2;
  const qy = y;
  pushQr(ops, input.qr, qx, qy, qrSize);
  let cy = qy + qrSize + 2;
  ops.push(textOp(qx + qrSize / 2, cy, 'RigPoint Array Sheet', 5.5, { align: 'center' }));
  cy += 5.5 * 1.2;
  for (const line of wrap(input.qrUrl, 5.5, false, qrSize, measure)) {
    ops.push(textOp(qx + qrSize / 2, cy, line, 5.5, { align: 'center' }));
    cy += 5.5 * 1.2;
  }
  y = cy;

  return { width: W, height: y, ops, links };
}
