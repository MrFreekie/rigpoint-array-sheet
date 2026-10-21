// Gets a report from a chosen PDF. pdf.js is loaded only when a PDF is opened.

import type { ParseResult } from '../engine/types';
import { MAX_PDF_BYTES } from '../files/limits';

export async function reportFromFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(`That file is larger than ${MAX_PDF_BYTES / 1024 / 1024} MB, which is too big for a Soundvision report.`);
  }
  const [{ GlobalWorkerOptions }, { default: workerUrl }, { importPdf }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    import('../files/import-pdf'),
  ]);
  GlobalWorkerOptions.workerSrc = workerUrl;
  return importPdf(new Uint8Array(await file.arrayBuffer()));
}
