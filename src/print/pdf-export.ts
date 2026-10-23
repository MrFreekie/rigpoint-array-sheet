// One-click PDF: the same sheet as the print view, made on this device with pdf-lib and downloaded.
// Long pages first (one or two tall arrays, folded once), then four pocket cards to an A4 page (fold it
// twice for A6 panels), then the rigging plot (a landscape drawing turned onto the sheet), then the rigging summary page.
// Text uses the PDF's built-in Helvetica, so nothing is fetched and no font is embedded.

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { APP_URL } from '../app-info';
import { riggingFixations, riggingRows } from '../engine/sheet';
import type { Doc } from '../files/doc';
import type { SheetModel } from '../ui/sheet-model';
import type { DrawOp, Measure } from './array-image';
import { cardContent } from './card-content';
import { CREDIT_TEXT, pageFooterText } from './footer';
import {
  CELL_PAD_MM,
  CELL_PAD_Y_MM,
  FOOTER_MM,
  fitScale,
  FULL_H_MM,
  MIN_FULL_SCALE,
  PAGE_H_MM,
  PAGE_W_MM,
  PANEL_FOOTER_MM,
  PANEL_HEADER_MM,
  planPages,
} from './layout';
import { panelHeader, type PanelHeader } from './panel-header';
import { PT_PER_MM, layoutPocketCard, layoutRiggingPage, ptToPx, riggingSubtitle, type Laid } from './pdf-layout';
import { plotContent } from './plot-input';
import { drawPlotOps } from './plot-pdf';
import { layoutPlotPages, plotPageCount, PRINT_PALETTE } from './plot-layout';
import { qrMatrix } from './qr';
import { wrap } from './array-image';

const MARGIN_MM = 6;
const A4 = { w: 595.28, h: 841.89 };
const mm = (n: number) => n * PT_PER_MM;

export interface PdfInput {
  doc: Doc;
  model: SheetModel;
  /** Footer text without the page number, e.g. from printFooter. */
  footer: string;
  /** Number of items to check against the source PDF, added to each footer when above zero. */
  checks: number;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface PanelContext {
  fonts: Fonts;
  safe: (t: string) => string;
  measure: Measure;
  header: PanelHeader;
  draft: boolean;
}

function hex(color: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return rgb(0, 0, 0);
  const n = parseInt(m[1] as string, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Helvetica holds the Western European characters. Anything else would stop the file being made, so it becomes "?". */
function encodable(font: PDFFont): (text: string) => string {
  const known = new Set(font.getCharacterSet());
  return (text) =>
    Array.from(text)
      .map((ch) => (known.has(ch.codePointAt(0) ?? -1) ? ch : '?'))
      .join('');
}

/**
 * Draws laid-out steps on a page. `left` and `top` are the card's top left corner in points from the top
 * left of the page; `scale` shrinks the whole card.
 */
function drawOps(page: PDFPage, fonts: Fonts, safe: (t: string) => string, ops: readonly DrawOp[], left: number, top: number, scale: number) {
  const X = (x: number) => left + x * scale;
  const Y = (y: number) => A4.h - (top + y * scale);
  for (const o of ops) {
    if (o.op === 'rect') {
      page.drawRectangle({
        x: X(o.x),
        y: Y(o.y + o.h),
        width: o.w * scale,
        height: o.h * scale,
        ...(o.fill ? { color: hex(o.fill) } : {}),
        ...(o.stroke ? { borderColor: hex(o.stroke), borderWidth: o.lineWidth * scale } : {}),
      });
    } else if (o.op === 'line') {
      page.drawLine({ start: { x: X(o.x1), y: Y(o.y1) }, end: { x: X(o.x2), y: Y(o.y2) }, thickness: o.width * scale, color: hex(o.color) });
    } else {
      const font = o.bold ? fonts.bold : fonts.regular;
      const text = safe(o.text);
      const size = o.size * scale;
      const w = font.widthOfTextAtSize(text, size);
      const x = o.align === 'left' ? X(o.x) : o.align === 'right' ? X(o.x) - w : X(o.x) - w / 2;
      // Text is placed by its top edge; PDF places it by its baseline.
      page.drawText(text, { x, y: Y(o.y) - size * 0.8, size, font, color: hex(o.color) });
    }
  }
}

/** A light word set at an angle across a box. Marks a draft. */
function drawWatermark(page: PDFPage, font: PDFFont, left: number, top: number, w: number, h: number, size: number) {
  const text = 'DRAFT';
  const angle = (35 * Math.PI) / 180;
  const tw = font.widthOfTextAtSize(text, size);
  // Rotating about the start point, so place that point where the centred, rotated word will land.
  const cx = left + w / 2;
  const cy = A4.h - (top + h / 2);
  const hx = tw / 2;
  const hy = size * 0.35;
  page.drawText(text, {
    x: cx - (hx * Math.cos(angle) - hy * Math.sin(angle)),
    y: cy - (hx * Math.sin(angle) + hy * Math.cos(angle)),
    size,
    font,
    color: rgb(0.92, 0.92, 0.92),
    rotate: degrees(35),
  });
}

function drawPanelHead(page: PDFPage, fonts: Fonts, safe: (t: string) => string, header: PanelHeader, left: number, top: number, width: number) {
  const status = header.status.toUpperCase();
  const statusW = fonts.bold.widthOfTextAtSize(safe(status), 6);
  const ops: DrawOp[] = [
    { op: 'text', x: width, y: 2, text: status, size: 6, bold: true, align: 'right', color: '#000000' },
    { op: 'text', x: 0, y: 0, text: clip(header.title, fonts.bold, safe, 8.5, width - statusW - 6), size: 8.5, bold: true, align: 'left', color: '#000000' },
  ];
  if (header.details) ops.push({ op: 'text', x: 0, y: 11.5, text: clip(header.details, fonts.regular, safe, 6, width), size: 6, bold: false, align: 'left', color: '#000000' });
  ops.push({ op: 'line', x1: 0, y1: mm(PANEL_HEADER_MM) - 1, x2: width, y2: mm(PANEL_HEADER_MM) - 1, width: 0.85, color: '#000000' });
  drawOps(page, fonts, safe, ops, left, top, 1);
}

/** One line only: cut with an ellipsis if it is too wide. */
function clip(text: string, font: PDFFont, safe: (t: string) => string, size: number, max: number): string {
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(safe(t), size) > max) t = `${t.slice(0, -2).trimEnd()}…`;
  return t;
}

function drawPanelFooter(page: PDFPage, fonts: Fonts, safe: (t: string) => string, measure: Measure, text: string, left: number, top: number, width: number) {
  const ops: DrawOp[] = [{ op: 'line', x1: 0, y1: 0, x2: width, y2: 0, width: 0.55, color: '#777777' }];
  const lines = wrap(text, 5, false, width, measure).slice(0, 2);
  lines.forEach((line, i) => ops.push({ op: 'text', x: width / 2, y: 2 + i * 6, text: line, size: 5, bold: false, align: 'center', color: '#000000' }));
  ops.push({ op: 'text', x: width / 2, y: 4 + lines.length * 6, text: CREDIT_TEXT, size: 5, bold: false, align: 'center', color: '#000000' });
  drawOps(page, fonts, safe, ops, left, top, 1);
}

const FOLD_STYLE = { thickness: 0.7, color: rgb(0.47, 0.47, 0.47), dashArray: [4, 3] };

/** One dashed line down the centre of the printable area, where a long page folds. */
function dashedCentre(page: PDFPage) {
  const x = mm(MARGIN_MM) + mm(PAGE_W_MM) / 2;
  const top = A4.h - mm(MARGIN_MM);
  page.drawLine({ start: { x, y: top }, end: { x, y: top - mm(PAGE_H_MM) }, ...FOLD_STYLE });
}

function dashedCross(page: PDFPage) {
  const style = FOLD_STYLE;
  const left = mm(MARGIN_MM);
  const top = mm(MARGIN_MM);
  const w = mm(PAGE_W_MM);
  const h = mm(PAGE_H_MM);
  page.drawLine({ start: { x: left + w / 2, y: A4.h - top }, end: { x: left + w / 2, y: A4.h - top - h }, ...style });
  page.drawLine({ start: { x: left, y: A4.h - top - h / 2 }, end: { x: left + w, y: A4.h - top - h / 2 }, ...style });
}

/** One panel, pocket or long: DRAFT mark, header, card and footer, inside a box of `w` by `h` points. */
function drawPanel(page: PDFPage, ctx: PanelContext, left: number, top: number, w: number, h: number, item: Laid, scale: number, footer: string) {
  const pad = mm(CELL_PAD_MM);
  const padY = mm(CELL_PAD_Y_MM);
  if (ctx.draft) drawWatermark(page, ctx.fonts.bold, left, top, w, h, 44);
  drawPanelHead(page, ctx.fonts, ctx.safe, ctx.header, left + pad, top + padY, w - 2 * pad);
  drawOps(page, ctx.fonts, ctx.safe, item.ops, left + pad, top + padY + mm(PANEL_HEADER_MM) + 1, scale);
  drawPanelFooter(page, ctx.fonts, ctx.safe, ctx.measure, footer, left + pad, top + h - padY - mm(PANEL_FOOTER_MM), w - 2 * pad);
}

export async function renderPdf(input: PdfInput): Promise<Uint8Array> {
  const { doc, model, footer, checks } = input;
  const pdf = await PDFDocument.create();
  pdf.setTitle(panelHeader(doc).title);
  pdf.setCreator('RigPoint Array');
  pdf.setProducer('RigPoint Array');
  pdf.setSubject('Soundvision array sheet');
  const fonts: Fonts = { regular: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const safe = encodable(fonts.regular);
  const measure: Measure = (t, size, bold) => (bold ? fonts.bold : fonts.regular).widthOfTextAtSize(safe(t), size);

  const header = panelHeader(doc);
  const ctx = { show: doc.job.show, venue: doc.job.venue, status: doc.status, revision: doc.revision, zAxisZero: doc.job.zAxisZero };
  const cards = model.entries
    .filter((e) => e.print)
    .map((e) => ({ item: layoutPocketCard(cardContent(e, ctx), measure) }))
    .map((c) => ({ item: c.item, heightPx: ptToPx(c.item.height) }));
  const plan = planPages(cards);
  const plotData = plotContent(doc, model);
  const plotCount = plotData ? plotPageCount(plotData.points.length) : 0;
  const total = plan.length + plotCount + 1;
  const draft = doc.status === 'draft';
  const footerFor = (n: number) => pageFooterText(footer, checks, n, total);

  const margin = mm(MARGIN_MM);
  const pageW = mm(PAGE_W_MM);
  const cellW = pageW / 2;
  const cellH = mm(PAGE_H_MM) / 2;
  const pad = mm(CELL_PAD_MM);
  const panelCtx: PanelContext = { fonts, safe, measure, header, draft };

  plan.forEach((p, n) => {
    const page = pdf.addPage([A4.w, A4.h]);
    if (p.kind === 'grid') {
      dashedCross(page);
      p.cards.forEach((c, i) => {
        drawPanel(page, panelCtx, margin + (i % 2) * cellW, margin + Math.floor(i / 2) * cellH, cellW, cellH, c.item as Laid, c.scale, footerFor(n + 1));
      });
    } else {
      dashedCentre(page);
      p.cards.forEach((c, i) => {
        drawPanel(page, panelCtx, margin + i * cellW, margin, cellW, mm(PAGE_H_MM), c.item as Laid, c.scale, footerFor(n + 1));
      });
    }
  });

  // The rigging plot, turned onto the portrait sheet, before the rigging summary.
  if (plotData) {
    const pages = layoutPlotPages({ ...plotData, footer: (i) => footerFor(plan.length + i + 1) }, measure);
    for (const plotPage of pages) {
      const page = pdf.addPage([A4.w, A4.h]);
      if (draft) drawWatermark(page, fonts.bold, margin, margin, pageW, mm(PAGE_H_MM), 90);
      drawPlotOps(page, fonts, safe, plotPage.ops, PRINT_PALETTE);
    }
  }

  // The rigging summary page, last.
  const rigging = layoutRiggingPage(
    {
      rows: riggingRows(doc.result.report.sources, model.printedSources),
      fixations: riggingFixations(doc.result.report.sources, model.printedSources),
      subtitle: riggingSubtitle(doc.job),
      qr: qrMatrix(APP_URL),
      qrUrl: APP_URL,
    },
    measure,
  );
  const last = pdf.addPage([A4.w, A4.h]);
  if (draft) drawWatermark(last, fonts.bold, margin, margin, pageW, mm(PAGE_H_MM), 90);
  const fit = fitScale(ptToPx(rigging.height), FULL_H_MM, MIN_FULL_SCALE);
  drawOps(last, fonts, safe, rigging.ops, margin + pad, margin + pad, fit.scale);
  drawPageFooter(last, fonts, safe, footerFor(total));

  return pdf.save();
}

/** The footer along the foot of the rigging page, centred, on one line. */
function drawPageFooter(page: PDFPage, f: Fonts, s: (t: string) => string, text: string) {
  const size = 6;
  const width = mm(PAGE_W_MM);
  const clipped = s(clip(text, f.regular, s, size, width));
  const w = f.regular.widthOfTextAtSize(clipped, size);
  // A few points above the bottom edge of the printable area, inside the strip kept for it.
  page.drawText(clipped, { x: mm(MARGIN_MM) + (width - w) / 2, y: A4.h - mm(MARGIN_MM) - mm(PAGE_H_MM) + mm(FOOTER_MM) / 2 - size / 2 + 2, size, font: f.regular, color: rgb(0, 0, 0) });
}
