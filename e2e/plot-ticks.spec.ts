// What is on the rigging plot and whether it prints: a tick on each array card, and Print rigging plot beside the preview.
// The screen tests run on every browser project, including the 375 px phone. The print view and Download PDF checks are Chromium only.

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { readPdfItems } from '../src/files/pdf-items';
import { openPdf, plotControls, samplePdf, save, start } from './helpers';

const card = (page: Page, name: string) => page.locator('.card', { has: page.getByRole('heading', { name, exact: true }) });
const onPlot = (page: Page, name: string) => card(page, name).getByLabel('Include on rigging plot');
const preview = (page: Page) => page.getByTestId('plot-preview');
const printPlot = (page: Page) => preview(page).getByLabel(/Print rigging plot/);
const OUT = 'KARA II L Out';

async function downloadedText(page: Page): Promise<string[]> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
  return (await readPdfItems(new Uint8Array(readFileSync(await download.path())))).map((i) => i.text);
}

test('every array starts on the plot, and unticking one takes it off the preview and the table', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect(onPlot(page, OUT)).toBeChecked();
  await expect(preview(page)).toContainText(OUT);
  await onPlot(page, OUT).uncheck();
  await expect(preview(page)).not.toContainText(OUT);
  await expect(preview(page)).toContainText('KARA II L Main');
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
  await onPlot(page, OUT).check();
  await expect(preview(page)).toContainText(OUT);
});

test('the plot does not follow Print this array', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await card(page, OUT).getByLabel('Print this array').uncheck();
  await expect(preview(page)).toContainText(OUT);
  await expect(onPlot(page, OUT)).toBeChecked();
});

test('with no array on the plot the preview says so, and Print rigging plot is switched off and cannot be ticked', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect(printPlot(page)).toBeChecked();
  const boxes = page.locator('.card').getByLabel('Include on rigging plot');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) await boxes.nth(i).uncheck();
  await expect(preview(page)).toContainText('No array is on the plot');
  await expect(preview(page).getByTestId('plot-svg')).toHaveCount(0);
  await expect(printPlot(page)).not.toBeChecked();
  await expect(printPlot(page)).toBeDisabled();
  await boxes.first().check();
  await expect(printPlot(page)).toBeEnabled();
  await expect(printPlot(page)).toBeChecked();
});

test('the choices are saved with the file and come back', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await onPlot(page, OUT).uncheck();
  await printPlot(page).uncheck();
  const saved = await save(page);
  expect(saved.json['format']).toBe('arraysheet/14');
  expect((saved.json['plot'] as boolean[]).filter((p) => !p)).toHaveLength(1);
  expect(saved.json['print_plot']).toBe(false);
});

test('the row under the plot keeps the origin, the ground offset, Print rigging plot and Download DXF together, inside the page, with the plot still in its white frame', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const row = plotControls(page);
  await expect(row.getByLabel('Origin (P0)')).toBeVisible();
  await expect(row.getByLabel('Ground offset for every array (m)')).toBeVisible();
  await expect(row.getByLabel(/Print rigging plot/)).toBeVisible();
  await expect(row.getByRole('button', { name: 'Download DXF' })).toBeVisible();
  const box = await row.boundingBox();
  const width = page.viewportSize()!.width;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 0.5);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(wide).toBeLessThanOrEqual(0);
  const frame = preview(page).locator('.plot-frame').first();
  await expect(frame).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(frame).toHaveCSS('padding-top', '14px');
});

test('the origin and the ground offset are switched off on a read-only file, and the row still has Print rigging plot', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Status').selectOption('approved');
  await save(page);
  const row = plotControls(page);
  await expect(row.getByLabel('Origin (P0)')).toBeDisabled();
  await expect(row.getByLabel('Ground offset for every array (m)')).toBeDisabled();
  await expect(row.getByLabel(/Print rigging plot/)).toBeEnabled();
});

test.describe('printing', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'PDF printing is Chromium-only in Playwright');

  test('an array off the plot is missing from the print view and from Download PDF, and the plot page is still there', async ({ page }) => {
    await start(page);
    await openPdf(page, samplePdf('a'));
    await onPlot(page, OUT).uncheck();
    const text = await downloadedText(page);
    expect(text).toContain('Rigging plot');
    expect(text.some((t) => t.includes(OUT))).toBe(true); // its card still prints
    await page.emulateMedia({ media: 'print' });
    const plotPage = page.getByTestId('print-page').filter({ hasText: 'Rigging plot' });
    await expect(plotPage).toHaveCount(1);
    await expect(plotPage).not.toContainText(OUT);
  });

  test('Print rigging plot off removes the page from the print view and from Download PDF, keeps the preview, and the page numbers run on', async ({ page }) => {
    await start(page);
    await openPdf(page, samplePdf('a'));
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('print-page').filter({ hasText: 'Rigging plot' })).toHaveCount(1);
    const before = await page.getByTestId('print-page').count();
    await page.emulateMedia({ media: 'screen' });
    await printPlot(page).uncheck();
    await expect(preview(page).getByTestId('plot-svg')).toBeVisible();
    const text = await downloadedText(page);
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('print-page')).toHaveCount(before - 1);
    await expect(page.getByTestId('print-page').filter({ hasText: 'Rigging plot' })).toHaveCount(0);
    expect(text).not.toContain('Rigging plot');
    const last = `Page ${before - 1} of ${before - 1}`;
    expect(text.some((t) => t.includes(last))).toBe(true);
    // The DXF still downloads.
    await page.emulateMedia({ media: 'screen' });
    const [dxf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download DXF' }).click()]);
    expect(dxf.suggestedFilename()).toMatch(/\.dxf$/);
  });

  test('on a read-only file the choices still work for this session, and are not saved', async ({ page }) => {
    await start(page);
    await openPdf(page, samplePdf('a'));
    await page.getByLabel('Status').selectOption('approved');
    const approved = await save(page);
    await expect(page.locator('.tag-check', { hasText: 'READ-ONLY' })).toBeVisible();
    await expect(onPlot(page, OUT)).toBeEnabled();
    await onPlot(page, OUT).uncheck();
    await expect(preview(page)).not.toContainText(OUT);
    await printPlot(page).uncheck();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('print-page').filter({ hasText: 'Rigging plot' })).toHaveCount(0);
    await expect(page.getByTestId('print-page').first()).toBeVisible();
    // Nothing was written to the file: it opens again with everything on the plot.
    expect((approved.json['plot'] as boolean[]).every(Boolean)).toBe(true);
    expect(approved.json['print_plot']).toBe(true);
  });
});
