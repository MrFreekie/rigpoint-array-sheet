import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadItems } from '../testing/fixtures';
import { makePdf } from '../testing/make-pdf';
import { importPdf } from './import-pdf';
import { MAX_PDF_BYTES } from './limits';
import { PdfReadError, readPdfItems } from './pdf-items';

describe('readPdfItems', () => {
  it('returns text with its page and position', async () => {
    const pdf = makePdf([[{ x: 72, y: 700, text: 'Total weight: 93 kg' }], [{ x: 100, y: 500, text: 'Second page' }]]);
    const items = await readPdfItems(pdf);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ page: 1, x: 72, y: 700, text: 'Total weight: 93 kg' });
    expect(items[1]).toMatchObject({ page: 2, x: 100, y: 500, text: 'Second page' });
  });

  it('reads brackets in text', async () => {
    const items = await readPdfItems(makePdf([[{ x: 72, y: 700, text: 'Angles (deg)' }]]));
    expect(items[0]?.text).toBe('Angles (deg)');
  });

  it('refuses an empty file', async () => {
    await expect(readPdfItems(new Uint8Array())).rejects.toThrow(PdfReadError);
  });

  it('refuses a file that is not a PDF, in plain English', async () => {
    await expect(readPdfItems(new TextEncoder().encode('hello, this is not a pdf'))).rejects.toThrow(
      /not a valid PDF|could not be read/,
    );
  });

  it('refuses a file over the size limit', async () => {
    await expect(readPdfItems(new Uint8Array(MAX_PDF_BYTES + 1))).rejects.toThrow(/larger than/);
  });
});

describe('importPdf', () => {
  it('reports a PDF with no text, such as a scan', async () => {
    const result = await importPdf(makePdf([[]]));
    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toMatch(/No text could be read/);
  });

  it('reports a PDF that is not a Soundvision report', async () => {
    const result = await importPdf(makePdf([[{ x: 72, y: 700, text: 'Invoice' }]]));
    expect(result.ok).toBe(false);
    expect(result.problems.map((p) => p.message).join(' ')).toMatch(/does not look like a Soundvision report/);
  });
});

const SAMPLES = ['A', 'B', 'C'].map((n) => `reference/soundvision_report_${n}.pdf`);
const hasSamples = SAMPLES.every((p) => existsSync(p));

// The sample PDFs hold real names, so they are not in the repository. When they are on this
// machine, check the reader still gives exactly the committed (anonymised) fixtures.
describe.skipIf(!hasSamples)('sample PDFs on this machine', () => {
  const blank = (items: { text: string }[]) =>
    items.map((i) => (i.text.startsWith('Author:') || i.text.startsWith('File name:') ? { ...i, text: '' } : i));

  it.each([
    ['a', 'reference/soundvision_report_A.pdf'],
    ['b', 'reference/soundvision_report_B.pdf'],
    ['c', 'reference/soundvision_report_C.pdf'],
  ] as const)('report %s gives the committed fixture', async (name, path) => {
    const items = await readPdfItems(new Uint8Array(readFileSync(path)));
    expect(blank(items)).toEqual(blank(loadItems(name)));
  });

  it('imports both without a problem', async () => {
    for (const path of SAMPLES) {
      const result = await importPdf(new Uint8Array(readFileSync(path)));
      expect(result.problems).toEqual([]);
    }
  });
});
