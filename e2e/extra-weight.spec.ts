// Additional weight: typed for a pickup on the card, added to the load and total on the rigging plot, and listed as its own
// item on the rigging summary. The screen tests run on every browser project; the print view and Download PDF are Chromium only.

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { readPdfItems } from '../src/files/pdf-items';
import { openPdf, samplePdf, save, start } from './helpers';

const card = (page: Page, name: string) => page.locator('.card', { has: page.getByRole('heading', { name, exact: true }) });
const field = (page: Page, name: string) => card(page, name).getByLabel('Additional weight (kg)');
const preview = (page: Page) => page.getByTestId('plot-preview');
const MAIN = 'KARA II L Main';
const OUT = 'KARA II L Out';

async function downloadedText(page: Page): Promise<string[]> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
  return (await readPdfItems(new Uint8Array(readFileSync(await download.path())))).map((i) => i.text);
}

test('a weight typed on a card is added on the plot and listed on its own on the rigging summary', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect(page.getByTestId('rigging-array-weights')).toContainText('Total array weight (kg)');
  await expect(page.getByTestId('rigging-extra-weights')).toHaveCount(0);
  await field(page, MAIN).fill('10');
  await field(page, OUT).fill('0.35');
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
  await expect(preview(page)).toContainText('Total 424.2 kg');
  await expect(preview(page)).toContainText('184.65 kg');
  await expect(preview(page)).toContainText(/Loads include any additional\s*weight typed in the app\./);
  const extra = page.getByTestId('rigging-extra-weights');
  await expect(extra).toContainText('Additional weight, typed in the app');
  await expect(extra.locator('tbody tr', { hasText: MAIN })).toContainText('424.2');
  const weights = page.getByTestId('rigging-array-weights');
  await expect(weights.locator('tbody tr', { hasText: OUT })).toContainText('184.3');
  await expect(weights.locator('tbody tr', { hasText: OUT })).toContainText('184.65');
  // The pickup table keeps the report's own load.
  await expect(page.getByTestId('rigging-pickups').locator('tbody tr', { hasText: MAIN })).toContainText('414.2');
});

test('only a weight can be typed: letters, signs and a third decimal are not accepted', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const box = field(page, MAIN);
  await box.pressSequentially('1a2-3.456');
  await expect(box).toHaveValue('123.45');
  await box.fill('');
  await expect(box).toHaveValue('');
});

test('the weights are saved with the file and come back, and a read-only file cannot change them', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await field(page, MAIN).fill('12.50');
  const saved = await save(page);
  expect(saved.json['format']).toBe('arraysheet/16');
  const typed = (saved.json['extra_weight'] as { front: string; rear: string }[]).filter((e) => e.front !== '' || e.rear !== '');
  expect(typed).toHaveLength(1);
  expect(Object.values(typed[0] ?? {}).sort()).toEqual(['', '12.5']);
  await page.getByLabel('Status').selectOption('approved');
  await save(page);
  await expect(field(page, MAIN)).toBeDisabled();
  await expect(field(page, MAIN)).toHaveValue('12.50');
});

test.describe('printing', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'PDF printing is Chromium-only in Playwright');

  test('the print view and Download PDF both carry the weights and the plot sentence', async ({ page }) => {
    await start(page);
    await openPdf(page, samplePdf('a'));
    await field(page, MAIN).fill('10');
    const text = await downloadedText(page);
    for (const t of ['Additional weight, typed in the app', 'Array weights', 'Report load (kg)', 'Pickup total (kg)', '424.2']) expect(text.some((x) => x.includes(t)), t).toBe(true);
    const sheet = page.getByTestId('print-page').last();
    await expect(sheet.getByTestId('print-extra-weights')).toContainText('424.2');
    await expect(sheet.getByTestId('print-array-weights')).toContainText('Total array weight (kg)');
    await expect(sheet.getByTestId('print-pickups')).toContainText('414.2');
    const plotPage = page.getByTestId('print-page').filter({ hasText: 'Rigging plot' });
    await expect(plotPage).toContainText(/Loads include any additional\s*weight typed in the app\./);
  });

  test('with no weight typed the summary has only the array weights table, and the plot has no sentence', async ({ page }) => {
    await start(page);
    await openPdf(page, samplePdf('a'));
    const text = await downloadedText(page);
    expect(text.some((x) => x.includes('Total array weight (kg)'))).toBe(true);
    expect(text.some((x) => x.includes('Additional weight, typed in the app'))).toBe(false);
    expect(text.some((x) => x.includes('Loads include any additional weight'))).toBe(false);
  });
});

test('the box fits the card at phone width', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(wide).toBeLessThanOrEqual(0);
  await expect(field(page, MAIN)).toBeVisible();
});
