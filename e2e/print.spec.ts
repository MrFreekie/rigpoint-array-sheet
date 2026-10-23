// The printed sheet: long pages first (tall arrays, two to a page), then pages of four pocket cards
// (an A4 page folded in half twice gives A6 panels), then a rigging summary page with the QR code. PDF output is a Chromium feature in Playwright,
// so these run in Chromium only.

import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { readPdfItems } from '../src/files/pdf-items';
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
      const pageFooter = p.querySelector('.as-footer')?.getBoundingClientRect();
      if (pageFooter && pageFooter.bottom > pr.bottom + 0.5) out.push(`page ${n + 1}: footer outside the page`);
      for (const panel of p.querySelectorAll<HTMLElement>('.as-cell, .as-full')) {
        const r = panel.getBoundingClientRect();
        const fit = panel.querySelector('.as-fit')!.getBoundingClientRect();
        // A pocket panel keeps its content between its own header and footer.
        const body = panel.querySelector('.as-cell-body')?.getBoundingClientRect();
        const limit = body ? body.bottom : r.bottom;
        if (fit.bottom > limit + 0.5) out.push(`page ${n + 1}: content runs below its panel by ${(fit.bottom - limit).toFixed(1)}px`);
        if (fit.right > r.right + 0.5) out.push(`page ${n + 1}: content runs past its panel`);
        if (pageFooter && fit.bottom > pageFooter.top + 0.5) out.push(`page ${n + 1}: content overlaps the footer`);
        const panelFooter = panel.querySelector('.as-panel-footer')?.getBoundingClientRect();
        if (panelFooter && panelFooter.bottom > r.bottom + 0.5) out.push(`page ${n + 1}: a panel footer runs out of its panel`);
        if (panelFooter && fit.bottom > panelFooter.top + 0.5) out.push(`page ${n + 1}: content overlaps a panel footer`);
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
  await expect(first).toContainText('MIRRORED: KARA II R Main');
  await expect(first).toContainText('90 On');
  // Soundvision's warnings are printed with their words.
  await expect(first).toContainText('WARNING');
  await expect(first).toContainText('Tipping hazard');

  // A draft is marked on every pocket panel (nine of them), so each folded card carries it, and once
  // on the rigging page. The grid pages themselves carry no page-wide word that the folds would cut.
  await expect(page.locator('.as-cell .as-watermark')).toHaveCount(9);
  await expect(page.locator('.as-watermark')).toHaveCount(10);
  await expect(page.locator('[data-testid=print-page] > .as-watermark')).toHaveCount(1);
  await expect(pages(page).nth(2).locator('.as-panel-footer')).toHaveText(
    /^RigPoint Array \d+\.\d+\.\d+ · Soundvision 2026\.3\.1 · .+\.arraysheet\.json \(not saved\) · Printed \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} · Page 3 of 4$/,
  );
  // Every pocket panel says whose it is and which file it came from, so a folded card still has an identity.
  await expect(page.locator('.as-cell .as-panel-head')).toHaveCount(9);
  await expect(page.locator('.as-cell .as-panel-footer')).toHaveCount(9);
  await expect(first.locator('.as-panel-head').first()).toContainText('RigPoint Array');
  await expect(first.locator('.as-panel-head').first()).toContainText('Draft');
  await expect(first.locator('.as-panel-head').first()).toContainText('Example Arena - Example Show');

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
  await page.getByLabel('Venue').fill('Grand Hall');
  await page.getByLabel('Z-axis zero').fill('Arena floor');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.as-watermark')).toHaveCount(0);
  const first = pages(page).first();
  // The identity now sits in each panel's header.
  const head = first.locator('.as-panel-head').first();
  await expect(head).toContainText('Approved');
  await expect(head).toContainText('Main stage · Grand Hall');
  await expect(head).toContainText('Z-axis zero: Arena floor');
  await expect(first).toContainText('Ground offset0.4 m');
  await expect(first).toContainText('Top height9 m'); // 9.4 - 0.4
  await expect(first).toContainText('Bottom height5.35 m'); // 5.75 - 0.4
  expect(pdfPages(await printToPdf(page, 'approved.pdf'))).toBe(4);
});

/** The kind of each printed page, in order. */
const pageKinds = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid=print-page]')].map((p) => (p.querySelector('.as-grid') ? 'grid' : p.querySelector('.as-long') ? 'long' : 'rigging')),
  );

test('an array too tall for a pocket card goes in a long column, on a page before the grid pages', async ({ page }) => {
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
  // The cards are measured just after the page loads, so wait for the plan to settle.
  await expect.poll(() => pageKinds(page)).toEqual(['long', 'grid', 'rigging']);
  const kinds = await pageKinds(page);
  const pdfFile = await printToPdf(page, 'tall.pdf');
  expect(pdfPages(pdfFile)).toBe(kinds.length);
  await expectNothingClipped(page);
});

test('two tall arrays share one long page: two columns, fold ticks, no dashed line, a mark and footer on each', async ({ page }) => {
  await start(page);
  // Two different tall arrays (the second at another angle, so it is not a mirror of the first).
  const pdf = changedPdf((sources) => {
    const base = sources[0]!.cabinets[0]!;
    [0, 1].forEach((k) => {
      sources[k]!.cabinets = Array.from({ length: 24 }, (_, i) => ({ ...base, number: i + 1, angle: k, site: 3.8, topZ: 9.4 - i * 0.25, bottomZ: 9.15 - i * 0.25 }));
    });
    return sources.slice(0, 5);
  });
  await openPdf(page, pdf);
  await expect(page.locator('.card')).not.toHaveCount(0);
  await page.emulateMedia({ media: 'print' });
  await expect.poll(() => pageKinds(page)).toEqual(['long', 'grid', 'rigging']);

  const long = pages(page).first();
  await expect(long.locator('.as-cell')).toHaveCount(2);
  await expect(long.locator('.as-fold-tick')).toHaveCount(2);
  await expect(long.locator('.as-cell .as-watermark')).toHaveCount(2);
  await expect(long.locator('.as-cell .as-panel-head')).toHaveCount(2);
  await expect(long.locator('.as-cell .as-panel-footer')).toHaveCount(2);
  await expect(long.locator('.as-panel-footer').first()).toContainText('Page 1 of 3');
  const borders = await long.locator('.as-cell').evaluateAll((cells) =>
    cells.map((c) => {
      const st = getComputedStyle(c);
      return [st.borderRightStyle, st.borderBottomStyle, st.borderLeftStyle, st.borderTopStyle];
    }),
  );
  expect(borders).toEqual([
    ['none', 'none', 'none', 'none'],
    ['none', 'none', 'none', 'none'],
  ]);

  expect(pdfPages(await printToPdf(page, 'two-long.pdf'))).toBe(3);
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

/** A report A array with this many enclosure rows, first in the report. */
const withRows = (rows: number) =>
  changedPdf((sources) => {
    const first = sources[0]!;
    const base = first.cabinets[0]!;
    first.cabinets = Array.from({ length: rows }, (_, i) => ({ ...base, number: i + 1, angle: 0, site: 3.8, topZ: 9.4 - i * 0.25, bottomZ: 9.15 - i * 0.25 }));
    return sources.slice(0, 5);
  });

/** Both mains of report A with this many rows, so the pair is still mirrored and the card keeps its MIRRORED note and motor fact. */
const withMirroredRows = (rows: number) =>
  changedPdf((sources) => {
    for (const s of sources.filter((x) => x.name === 'KARA II L Main' || x.name === 'KARA II R Main')) {
      const base = s.cabinets[0]!;
      s.cabinets = Array.from({ length: rows }, (_, i) => ({ ...base, number: i + 1, angle: 0, site: 3.8, topZ: 9.4 - i * 0.25, bottomZ: 9.15 - i * 0.25 }));
    }
    return sources.slice(0, 5);
  });

/** The scale a card was printed at (1 when it was not shrunk), and whether it sits in a pocket panel. */
const firstCard = (page: Page) =>
  page.evaluate(() => {
    const p = document.querySelector('[data-testid=print-page]');
    const fit = p?.querySelector('.as-fit') as HTMLElement | null | undefined;
    if (!p || !fit) return { panel: false, scale: -1 }; // not on the page yet
    const m = /scale\(([\d.]+)\)/.exec(fit.style.transform);
    return { panel: p.querySelector('.as-grid') !== null, scale: m ? Number(m[1]) : 1 };
  });

for (const rows of [12, 16]) {
  test(`a ${rows}-row array prints at full size in its pocket panel`, async ({ page }) => {
    await start(page);
    await openPdf(page, withMirroredRows(rows));
    await expect.poll(() => firstCard(page)).toEqual({ panel: true, scale: 1 });
    await page.emulateMedia({ media: 'print' });
    await expectNothingClipped(page);
  });
}

test('a 24-row array prints at full size in a long column', async ({ page }) => {
  await start(page);
  await openPdf(page, withRows(24));
  await expect.poll(() => firstCard(page)).toEqual({ panel: false, scale: 1 });
  await page.emulateMedia({ media: 'print' });
  await expect.poll(() => pageKinds(page)).toEqual(['long', 'grid', 'rigging']);
  await expectNothingClipped(page);
  expect(pdfPages(await printToPdf(page, 'rows-24.pdf'))).toBe(3); // the long page, one page of cards, then the rigging page
});

// Near the 119.5 mm line (CELL_H_MM) the print view and the downloaded PDF must put the array on the same page.
for (const rows of [16, 17, 18, 24]) {
  test(`${rows} rows: the print view and Download PDF agree on the page count and the page of the array`, async ({ page }) => {
    await start(page);
    await openPdf(page, withMirroredRows(rows));
    await expect(page.locator('.card')).not.toHaveCount(0);

    // The page of the array in the downloaded PDF.
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
    const items = await readPdfItems(new Uint8Array(readFileSync(await download.path())));
    const count = Math.max(...items.map((i) => i.page));
    const arrayPage = items.filter((i) => i.page < count && i.text === 'KARA II L Main').map((i) => i.page)[0];

    // The print view plans from the same calculated height, so it settles on the same answer.
    const preview = () =>
      page.evaluate(() => {
        const all = [...document.querySelectorAll<HTMLElement>('[data-testid=print-page]')];
        const has = (p: HTMLElement) => [...p.querySelectorAll<HTMLElement>('.as-cell .pc-title')].some((t) => t.textContent === 'KARA II L Main');
        const at = all.findIndex(has);
        return { count: all.length, page: at + 1 };
      });
    await expect.poll(preview).toEqual({ count, page: arrayPage });
    const long = await page.evaluate(() => document.querySelector('.as-long .pc-title')?.textContent === 'KARA II L Main');
    // A pocket panel holds 16 rows of this array, with its mirror note and motor fact; anything taller is in a long column, and long pages come first.
    expect(long).toBe(rows >= 17);
    const note = await page.evaluate(() => [...document.querySelectorAll('.as-cell')].find((c) => c.querySelector('.pc-title')?.textContent === 'KARA II L Main')?.querySelector('.pc-mirror')?.textContent);
    expect(note).toBe('MIRRORED: KARA II R Main');
    if (long) expect(arrayPage).toBe(1);
  });
}

test('an array of about 140 rows is too tall even for a long column, and the banner says so', async ({ page }) => {
  await start(page);
  await openPdf(page, withRows(140));
  await expect(page.getByRole('status').filter({ hasText: 'even in a long column' })).toBeVisible();
});

// The PDF layout assumes a table row is 14.0625 CSS pixels, and that a card is as tall as layoutPocketCard says.
// Both are facts about the browser's layout, so they are checked in the browser.
test('a card table row is 14.0625 px high, and a rendered card is as tall as the height the page was planned from', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect(page.locator('.card')).not.toHaveCount(0);
  await expect.poll(() => page.locator('.as-fit[data-planned-height]').count()).toBeGreaterThan(0);
  const measured = await page.evaluate(() => ({
    rows: [...document.querySelectorAll<HTMLElement>('.as-fit[data-planned-height] .pc-table tr')].map((tr) => tr.getBoundingClientRect().height),
    cards: [...document.querySelectorAll<HTMLElement>('.as-fit[data-planned-height]')].map((fit) => ({
      title: fit.querySelector('.pc-title')?.textContent ?? '',
      rendered: (fit.querySelector('.pc') as HTMLElement).offsetHeight,
      planned: Number(fit.dataset['plannedHeight']),
    })),
  }));
  expect(measured.rows.length).toBeGreaterThan(20);
  for (const h of measured.rows) expect(h).toBeCloseTo(14.0625, 2);
  expect(measured.cards.length).toBeGreaterThan(5);
  // 0.5 mm is 1.89 CSS pixels.
  for (const c of measured.cards) expect(Math.abs(c.rendered - c.planned), c.title).toBeLessThan(0.5 * (96 / 25.4));
});

// A long fact value wraps in the sheet, so the plan has to count the extra lines or the card would be taller than planned.
test('a long Frame value wraps, and the rendered card is as tall as the plan says', async ({ page }) => {
  await start(page);
  const longFrame = 'M-BUMP+MBAR hole A with the extension bar and a second bumper on the rear truss';
  await openPdf(
    page,
    changedPdf((sources) => {
      sources[0]!.bumper = longFrame;
      return sources.slice(0, 5);
    }),
  );
  await expect(page.locator('.card')).not.toHaveCount(0);
  await expect.poll(() => page.locator('.as-fit[data-planned-height]').count()).toBeGreaterThan(0);
  const card = await page.evaluate((frame) => {
    const fit = [...document.querySelectorAll<HTMLElement>('.as-fit[data-planned-height]')].find((f) => [...f.querySelectorAll('dd')].some((d) => d.textContent === frame));
    const dd = [...(fit?.querySelectorAll<HTMLElement>('dd') ?? [])].find((d) => d.textContent === frame);
    return fit && dd
      ? { rendered: (fit.querySelector('.pc') as HTMLElement).offsetHeight, planned: Number(fit.dataset['plannedHeight']), lineHeight: parseFloat(getComputedStyle(dd).lineHeight), valueHeight: dd.offsetHeight }
      : null;
  }, longFrame);
  expect(card).not.toBeNull();
  expect(card!.valueHeight).toBeGreaterThan(card!.lineHeight * 1.5); // it did wrap
  expect(Math.abs(card!.rendered - card!.planned)).toBeLessThan(0.5 * (96 / 25.4));
});
