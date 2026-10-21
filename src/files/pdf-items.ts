// Reads the text of a PDF, with the position of each piece, using pdf.js.
// The PDF is opened on this device only: nothing is fetched and nothing is evaluated.
// Imports from ../engine are type-only so that scripts/extract-fixtures.mjs can run this file as it is.

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from '../engine/types';
import { MAX_PDF_BYTES, MAX_PDF_PAGES } from './limits.ts';

export class PdfReadError extends Error {}

function reason(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'PasswordException') return 'This PDF is password protected. Remove the password and try again.';
  if (name === 'InvalidPDFException') return 'This file is not a valid PDF.';
  return 'This PDF could not be read.';
}

export async function readPdfItems(data: Uint8Array): Promise<TextItem[]> {
  if (data.byteLength === 0) throw new PdfReadError('This file is empty.');
  if (data.byteLength > MAX_PDF_BYTES) {
    throw new PdfReadError(`This file is larger than ${MAX_PDF_BYTES / 1024 / 1024} MB, which is too big for a Soundvision report.`);
  }
  const task = getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  let pdf;
  try {
    pdf = await task.promise;
  } catch (error) {
    await task.destroy();
    throw new PdfReadError(reason(error));
  }
  try {
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new PdfReadError(`This PDF has ${pdf.numPages} pages, which is too many for a Soundvision report.`);
    }
    const items: TextItem[] = [];
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      for (const item of content.items) {
        if (!('str' in item) || item.str.trim() === '') continue;
        const [, , , , x, y] = item.transform as number[];
        if (x === undefined || y === undefined) continue;
        items.push({ page, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, text: item.str });
      }
    }
    return items;
  } catch (error) {
    if (error instanceof PdfReadError) throw error;
    throw new PdfReadError(reason(error));
  } finally {
    await task.destroy();
  }
}
