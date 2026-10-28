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
  expect(saved.json['format']).toBe('arraysheet/16');
  expect((saved.json['plot'] as boolean[]).filter((p) => !p)).toHaveLength(1);
  expect(saved.json['print_plot']).toBe(false);
});

const showPosition = (page: Page) => plotControls(page).getByLabel(/Show position/);
const showOutlines = (page: Page) => plotControls(page).getByLabel(/Show outlines/);
const keyEntry = (page: Page, text: string | RegExp) => preview(page).getByTestId('plot-svg').locator('text', { hasText: text });
const POSITION_KEY = /^Position$/;
const BOX_KEY = 'Array with pickups: width and depth from the report';

test('Show position and Show outlines take the dots, the boxes and their key entries off the preview, and are saved with the file', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect(showPosition(page)).toBeChecked();
  await expect(showOutlines(page)).toBeChecked();
  await expect(keyEntry(page, POSITION_KEY)).toHaveCount(1);
  await expect(keyEntry(page, BOX_KEY)).toHaveCount(1);
  const dots = () => preview(page).getByTestId('plot-svg').locator('circle[fill]:not([fill="none"])').count();
  const before = await dots();
  expect(before).toBeGreaterThan(1);
  await showPosition(page).uncheck();
  await expect(keyEntry(page, POSITION_KEY)).toHaveCount(0);
  await expect(keyEntry(page, BOX_KEY)).toHaveCount(1);
  expect(await dots()).toBeLessThan(before);
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
  await showOutlines(page).uncheck();
  await expect(keyEntry(page, BOX_KEY)).toHaveCount(0);
  await expect(preview(page)).toContainText(OUT);
  const saved = await save(page);
  expect(saved.json['show_position']).toBe(false);
  expect(saved.json['show_outlines']).toBe(false);
  await showPosition(page).check();
  await showOutlines(page).check();
  await expect(keyEntry(page, POSITION_KEY)).toHaveCount(1);
  await expect(keyEntry(page, BOX_KEY)).toHaveCount(1);
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

  test('Show position and Show outlines are followed by the print view and by Download PDF', async ({ page }) => {
    await start(page);
    await openPdf(page, samplePdf('a'));
    expect(await downloadedText(page)).toContain('Position');
    await showPosition(page).uncheck();
    await showOutlines(page).uncheck();
    const text = await downloadedText(page);
    expect(text).not.toContain('Position');
    expect(text.some((t) => t.startsWith('Array with pickups'))).toBe(false);
    expect(text.some((t) => t.includes(OUT))).toBe(true);
    await page.emulateMedia({ media: 'print' });
    const plotPage = page.getByTestId('print-page').filter({ hasText: 'Rigging plot' });
    await expect(plotPage).toHaveCount(1);
    await expect(plotPage).not.toContainText('Array with pickups');
  });

  test('on a read-only file Show position and Show outlines work for this session, and are not saved', async ({ page }) => {
    await start(page);
    await openPdf(page, samplePdf('a'));
    await page.getByLabel('Status').selectOption('approved');
    const approved = await save(page);
    await expect(showPosition(page)).toBeEnabled();
    await expect(showOutlines(page)).toBeEnabled();
    await showOutlines(page).uncheck();
    await expect(keyEntry(page, BOX_KEY)).toHaveCount(0);
    expect(approved.json['show_position']).toBe(true);
    expect(approved.json['show_outlines']).toBe(true);
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
