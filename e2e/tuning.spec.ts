// The tuning sheet: an extra pop-out from the header with what the report states for each array. View only, and its PDF and
// image are separate files: the main PDF never holds it. The screen tests run on every browser project, the PDF is Chromium only.

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { readPdfItems } from '../src/files/pdf-items';
import { openMenu, openPdf, samplePdf, savedName, start } from './helpers';

async function openTuning(page: Page) {
  await page.getByRole('button', { name: 'Tuning', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tuning sheet' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('the Tuning button opens a table with the delay and the group line of an array, and Escape closes it', async ({ page }) => {
  await start(page);
  await expect(page.getByRole('button', { name: 'Tuning', exact: true })).toBeDisabled();
  await openPdf(page, samplePdf('a'));
  const dialog = await openTuning(page);

  await expect(dialog.getByRole('columnheader')).toHaveText(['Array', 'Delay', 'Gain', 'Autofilter', 'LF Contour', 'Zoom']);
  const rear = dialog.getByRole('row', { name: /SB28 L Rear/ });
  await expect(rear).toContainText('4.17 ms');
  await expect(rear).toContainText('SUBS: 4 ms');
  await expect(rear).toContainText('SUBS: -2 dB');
  const main = dialog.getByRole('row', { name: /KARA II L Main/ });
  await expect(main).toContainText('180 Hz, 2 dB');
  await expect(main).toContainText('1.1');
  await expect(main).toContainText('Default');
  // Mirror images that the cards hide are still listed.
  await expect(dialog.getByRole('row', { name: /SB28 R Rear/ })).toContainText('4.17 ms');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('on a phone the table scrolls sideways and the first column stays in view', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-se', 'the phone project');
  await start(page);
  await openPdf(page, samplePdf('a'));
  const dialog = await openTuning(page);
  const wrap = dialog.getByTestId('tuning-table');
  const scrolls = await wrap.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(scrolls).toBe(true);
  await wrap.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  const first = dialog.getByRole('rowheader', { name: /KARA II L Main/ });
  const box = await first.boundingBox();
  const frame = await wrap.boundingBox();
  expect(box && frame && box.x >= frame.x - 1 && box.x <= frame.x + 40).toBe(true);
  expect(await wrap.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});

test('the tuning sheet saves as an image of its own', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const dialog = await openTuning(page);
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Save image' }).click()]);
  expect(savedName(download)).toBe('Example Arena - Example Show - Tuning sheet.png');
  const bytes = readFileSync(await download.path());
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.readUInt32BE(16)).toBe(2000);
  expect(bytes.readUInt32BE(20)).toBeGreaterThan(400);
});

test.describe('the PDF', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'PDF downloads are Chromium-only in Playwright');

  test('the tuning sheet is a PDF of its own, and the main PDF does not hold the table', async ({ page }) => {
    await start(page);
    await openPdf(page, samplePdf('a'));
    const dialog = await openTuning(page);
    const [tuning] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download PDF' }).click()]);
    expect(savedName(tuning)).toBe('Example Arena - Example Show - Tuning sheet.pdf');
    const sheet = (await readPdfItems(new Uint8Array(readFileSync(await tuning.path())))).map((i) => i.text);
    expect(sheet).toContain('Tuning sheet');
    expect(sheet).toContain('KARA II L Main');
    expect(sheet).toContain('180 Hz, 2 dB');
    expect(sheet).toContain('SUBS: 4 ms');

    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
    await openMenu(page);
    const [main] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
    const text = (await readPdfItems(new Uint8Array(readFileSync(await main.path())))).map((i) => i.text).join(' ');
    expect(text).toContain('Rigging summary');
    expect(text).not.toContain('Tuning sheet');
    expect(text).not.toContain('LF Contour');
    expect(text).not.toContain('SUBS: 4 ms');
  });
});
