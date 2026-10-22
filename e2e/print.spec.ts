// The printed sheet: pages of four pocket cards (an A4 page folded in half twice gives A6 panels),
// then a rigging summary page with the QR code. PDF output is a Chromium feature in Playwright,
// so these run in Chromium only.

import { writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { changedPdf, openPdf, samplePdf, start } from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'PDF printing is Chromium-only in Playwright');

/** Count pages in a PDF by its page objects. */
const pdfPages = (pdf: Buffer): number => (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

async function printToPdf(page: Page, name: string): Promise<Buffer> {
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  writeFileSync(test.info().outputPath(name), pdf); // kept in test-results/ for a visual check
  await test.info().attach(name, { body: pdf, contentType: 'application/pdf' });
  return pdf;
}

/**
 * The page box clips anything taller than A4, so a page count alone does not prove that nothing was cut
 * off. Check every card is inside its panel, every footer is inside its page, and the rigging
 * table is clear of the footer.
 */
async function expectNothingClipped(page: Page) {
  await page.emulateMedia({ media: 'print' });
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const pages = [...document.querySelectorAll<HTMLElement>('[data-testid=print-page]')];
    pages.forEach((p, n) => {
      const pr = p.getBoundingClientRect();
      const footer = p.querySelector('.as-footer')!.getBoundingClientRect();
      if (footer.bottom > pr.bottom + 0.5) out.push(`page ${n + 1}: footer outside the page`);
      for (const panel of p.querySelectorAll<HTMLElement>('.as-cell, .as-full')) {
        const r = panel.getBoundingClientRect();
        const fit = panel.querySelector('.as-fit')!.getBoundingClientRect();
        if (fit.bottom > r.bottom + 0.5) out.push(`page ${n + 1}: content runs below its panel by ${(fit.bottom - r.bottom).toFixed(1)}px`);
        if (fit.right > r.right + 0.5) out.push(`page ${n + 1}: content runs past its panel`);
        if (fit.bottom > footer.top + 0.5) out.push(`page ${n + 1}: content overlaps the footer`);
      }
    });
    return out;
  });
  expect(problems).toEqual([]);
}

const pages = (page: Page) => page.getByTestId('print-page');
const cardsOnPaper = (page: Page) => page.getByTestId('print-card');

test('page counting works (sanity check for the tests below)', async ({ page }) => {
  await page.setContent('<style>@page{size:A4;margin:10mm} div{break-after:page}</style><div>1</div><div>2</div><p>3</p>');
  expect(pdfPages(await page.pdf({ preferCSSPageSize: true }))).toBe(3);
});

test('report A: nine arrays print four to a page, then the rigging page', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect(page.locator('.card')).toHaveCount(9);

  const pdf = await printToPdf(page, 'report-a.pdf');
  // 9 arrays = 4 + 4 + 1, then the rigging summary.
  expect(pdfPages(pdf)).toBe(4);
  await expect(pages(page)).toHaveCount(4);
  await expect(cardsOnPaper(page)).toHaveCount(9);
  await expectNothingClipped(page);

  // Only the sheet prints, not the editing screen.
  await expect(page.locator('.app')).toBeHidden();

  const first = pages(page).first();
  await expect(first.getByTestId('print-card')).toHaveCount(4);
  await expect(first).toContainText('KARA II L Main');
  await expect(first).toContainText('414.2 kg');
  await expect(first).toContainText('Also KARA II R Main: an exact left-right mirror of this array.');
  await expect(first).toContainText('90 On');
  // Soundvision's warnings are printed with their words.
  await expect(first).toContainText('WARNING');
  await expect(first).toContainText('Tipping hazard');

  // A draft is marked on every pocket panel (nine of them), so each folded card carries it, and once
  // on the rigging page. The grid pages themselves carry no page-wide word that the folds would cut.
  await expect(page.locator('.as-cell .as-watermark')).toHaveCount(9);
  await expect(page.locator('.as-watermark')).toHaveCount(10);
  await expect(page.locator('[data-testid=print-page] > .as-watermark')).toHaveCount(1);
  await expect(pages(page).nth(2).locator('.as-footer')).toHaveText(
    /^RigPoint Array \d+\.\d+\.\d+ · Soundvision 2026\.3\.1 · .+\.arraysheet\.json \(not saved\) · Printed \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} · Page 3 of 4$/,
  );

  // The last page: the rigging summary and the QR code.
  const last = pages(page).last();
  await expect(last).toContainText('Rigging summary');
  await expect(last).toContainText('KARA II R Out');
  await expect(last.getByTestId('print-qr').locator('svg path')).toHaveAttribute('d', /^M\d+ \d+h\d+v1h-\d+z/);
  await expect(last.getByTestId('print-qr')).toContainText('https://mrfreekie.github.io/rigpoint-array-sheet/');
  await expect(last.getByTestId('print-small-print')).toContainText('provided as it is, without warranty');
  await expect(last.getByTestId('print-small-print')).toContainText('Soundvision and L-Acoustics are trademarks of their owners.');
});

test('report B: eight arrays make two pages of cards and the rigging page', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('b'));
  await expect(page.locator('.card')).toHaveCount(8);
  expect(pdfPages(await printToPdf(page, 'report-b.pdf'))).toBe(3);
  await expect(cardsOnPaper(page)).toHaveCount(8);
  await expectNothingClipped(page);
  await expect(pages(page).last()).toContainText('Front');
  await expect(pages(page).last()).toContainText('Rear');
  await expect(pages(page).last()).toContainText('52.7');
});

test('showing the mirrored arrays prints them too', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByRole('checkbox', { name: /Show the 9 mirrored arrays/ }).check();
  await expect(page.locator('.card')).toHaveCount(18);
  // 18 = 4 + 4 + 4 + 4 + 2, then the rigging page.
  expect(pdfPages(await printToPdf(page, 'report-a-all.pdf'))).toBe(6);
  await expectNothingClipped(page);
});

test('approved: no watermark; ground offsets show in the printed heights', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Ground offset for every array (m)').fill('0.4');
  await page.getByLabel('Status').selectOption('approved');
  await page.getByLabel('Show', { exact: true }).fill('Main stage');
  await page.getByLabel('Z-axis zero').fill('Arena floor');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.as-watermark')).toHaveCount(0);
  const first = pages(page).first();
  await expect(first).toContainText('Main stage · Approved · Z-axis zero: Arena floor');
  await expect(first).toContainText('Ground offset0.4 m');
  await expect(first).toContainText('Top height9 m'); // 9.4 - 0.4
  await expect(first).toContainText('Bottom height5.35 m'); // 5.75 - 0.4
  expect(pdfPages(await printToPdf(page, 'approved.pdf'))).toBe(4);
});

test('an array too tall for a pocket card gets a page of its own', async ({ page }) => {
  await start(page);
  const pdf = changedPdf((sources) => {
    const first = sources[0]!;
    const base = first.cabinets[0]!;
    first.cabinets = Array.from({ length: 48 }, (_, i) => ({ ...base, number: i + 1, angle: 0, site: 3.8, topZ: 9.4 - i * 0.25, bottomZ: 9.15 - i * 0.25 }));
    return sources.slice(0, 5);
  });
  await openPdf(page, pdf);
  await expect(page.locator('.card')).not.toHaveCount(0);
  await page.emulateMedia({ media: 'print' });
  const pageKinds = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid=print-page]')].map((p) => (p.querySelector('.as-grid') ? 'grid' : p.querySelector('.as-rigging-page') ? 'rigging' : 'full')),
    );
  // The cards are measured just after the page loads, so wait for the plan to settle.
  await expect.poll(pageKinds).toEqual(['full', 'grid', 'rigging']);
  const kinds = await pageKinds();
  const pdfFile = await printToPdf(page, 'tall.pdf');
  expect(pdfPages(pdfFile)).toBe(kinds.length);
  await expectNothingClipped(page);
});

test('the sheet is not printable while the report has an error', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Ground offset for every array (m)').fill('x');
  await expect(page.getByRole('button', { name: 'Print / PDF' })).toBeDisabled();
});

test('only the arrays that are chosen print, and only their pickups are listed', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect(page.locator('.card')).toHaveCount(9);
  await expect(page.getByTestId('print-count')).toHaveText('All 9 arrays shown are chosen for printing and as images.');

  // Leave out the left main (and so the right main it stands for) and four of the small fills.
  const cards = page.locator('.card');
  for (const i of [0, 4, 5, 6, 7]) await cards.nth(i).getByLabel('Print this array').uncheck();
  await expect(page.getByTestId('print-count')).toHaveText('4 of 9 arrays shown are chosen for printing and as images.');

  await page.emulateMedia({ media: 'print' });
  await expect(cards.nth(0).getByLabel('Print this array')).not.toBeChecked();
  await expect(cards).toHaveCount(9); // the screen still shows every array
  expect(pdfPages(await printToPdf(page, 'chosen.pdf'))).toBe(2); // one page of four cards, then the rigging page
  await expect(cardsOnPaper(page)).toHaveCount(4);
  await expectNothingClipped(page);
  const printed = await page.getByTestId('print-card').allInnerTexts();
  expect(printed.join(' ')).not.toContain('KARA II L Main');
  expect(printed.join(' ')).toContain('KARA II L Out');

  const last = pages(page).last();
  await expect(last).toContainText('KARA II L Out');
  await expect(last).not.toContainText('KARA II L Main');
  await expect(last).not.toContainText('KARA II R Main');
});

test('with no array chosen there is nothing to print', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('b'));
  const cards = page.locator('.card');
  for (let i = 0; i < 8; i++) await cards.nth(i).getByLabel('Print this array').uncheck();
  await expect(page.getByRole('button', { name: 'Print / PDF' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Print / PDF' })).toHaveAttribute('title', 'Choose at least one array to print');
  await expect(page.getByRole('button', { name: 'Save selected as images' })).toBeDisabled();
  await cards.nth(0).getByLabel('Print this array').check();
  await expect(page.getByRole('button', { name: 'Print / PDF' })).toBeEnabled();
});
