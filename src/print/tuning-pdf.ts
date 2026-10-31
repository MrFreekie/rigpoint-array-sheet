// The tuning sheet as a PDF: a small table on landscape A4, made on this device with pdf-lib, the same way as the main PDF but
// a separate file. The main PDF, the print view and the cards never hold it. Text uses the built-in Helvetica.

import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { Doc } from '../files/doc';
import { tuningRows } from '../ui/tuning-rows';
import type { Measure } from './array-image';
import { pageFooterText } from './footer';
import { panelHeader } from './panel-header';
import { drawOps, drawWatermark, encodable, type Fonts } from './pdf-export';
import { layoutTuningPages, TUNING_TITLE } from './tuning-layout';

const PAGE = { w: 841.89, h: 595.28 };
const MARGIN = 28;
const FONT = 9;

export interface TuningPdfInput {
  doc: Doc;
  /** Footer text without the page number, e.g. from printFooter. */
  footer: string;
  /** Number of items to check against the source PDF, added to each footer when above zero. */
  checks: number;
}

export async function renderTuningPdf({ doc, footer, checks }: TuningPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const header = panelHeader(doc);
  pdf.setTitle(`${TUNING_TITLE}, ${header.title}`);
  pdf.setCreator('RigPoint Array Sheet');
  pdf.setProducer('RigPoint Array Sheet');
  pdf.setSubject('Soundvision tuning sheet');
  const fonts: Fonts = { regular: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const safe = encodable(fonts.regular);
  const measure: Measure = (t, size, bold) => (bold ? fonts.bold : fonts.regular).widthOfTextAtSize(safe(t), size);

  const pages = layoutTuningPages(
    { header, rows: tuningRows(doc), footer: (n, total) => pageFooterText(footer, checks, n, total) },
    measure,
    { width: PAGE.w, height: PAGE.h, font: FONT, margin: MARGIN },
  );
  for (const laid of pages) {
    const page = pdf.addPage([PAGE.w, PAGE.h]);
    if (doc.status === 'draft') drawWatermark(page, fonts.bold, 0, 0, PAGE.w, PAGE.h, 90, PAGE.h);
    drawOps(page, fonts, safe, laid.ops, 0, 0, 1, PAGE.h);
  }
  return pdf.save();
}
