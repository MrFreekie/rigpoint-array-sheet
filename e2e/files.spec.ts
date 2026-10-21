// Opening, saving, reopening, the approval lock, autosave, update from a newer PDF and image export.
// These run on every browser project, including the 375 px phone.

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openJson, openPdf, samplePdf, save, savedName, start } from './helpers';

test('opens a Soundvision PDF and shows one card per array without sideways scrolling', async ({ page }) => {
  await start(page);
  await expect(page.getByRole('heading', { name: 'Open a Soundvision report' })).toBeVisible();
  await openPdf(page, samplePdf('a'));
  await expect(page.locator('.card')).toHaveCount(9);
  await expect(page.getByText('READ OK')).toBeVisible();
  await expect(page.getByText('9 of 18 arrays shown')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('heading', { name: 'Rigging summary' })).toBeVisible();
});

test('report B opens with its two-motor array and ground stacks', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('b'));
  await expect(page.locator('.card')).toHaveCount(8);
  const card = page.locator('.card', { hasText: 'FL KARA II L' });
  await expect(card).toContainText('182.7 kg');
  await expect(card).toContainText('52.7 kg');
  await expect(card).toContainText('Front 16, Rear 0');
  await expect(page.locator('.card', { hasText: 'GS KARA II L' })).toContainText('CAUTION');
});

test('a file that is not a PDF or an app file is refused with a plain message', async ({ page }) => {
  await start(page);
  await page.getByTestId('open-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.getByRole('alert')).toContainText('That is not a PDF or a RigPoint Array file');
  await openPdf(page, Buffer.from('this is not a pdf'), 'broken.pdf');
  await expect(page.getByRole('alert')).toContainText(/not a valid PDF|could not be read/);
});

test('save, reopen, approve and lock', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect(page.getByText('● Unsaved changes')).toBeVisible();

  await page.getByLabel('Show', { exact: true }).fill('Main stage');
  await page.getByLabel('Ground offset for every array (m)').fill('0.3');
  const first = page.locator('.card').first();
  await expect(first.getByTestId('top-height')).toHaveText('9.1 m');

  const draft = await save(page);
  expect(savedName(draft.download)).toBe('Main stage.arraysheet.json');
  expect(draft.json).toMatchObject({ format: 'arraysheet/1', status: 'draft', revision: '' });
  expect(draft.json['job']).toMatchObject({ show: 'Main stage', default_offset: '0.3' });
  await expect(page.getByText('Saved · Main stage.arraysheet.json')).toBeVisible();

  // Reopen what was saved, in a fresh page.
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.getByRole('heading', { name: 'Open a Soundvision report' })).toBeVisible();
  await openJson(page, 'Main stage.arraysheet.json', draft.text);
  await expect(page.getByLabel('Show', { exact: true })).toHaveValue('Main stage');
  await expect(page.locator('.card').first().getByTestId('top-height')).toHaveText('9.1 m');

  // Approve it: still editable until saved, then read-only.
  await page.getByLabel('Status').selectOption('approved');
  await page.getByLabel('Revision').fill('b');
  await expect(page.getByLabel('Revision')).toHaveValue('B');
  const approved = await save(page);
  expect(savedName(approved.download)).toBe('Main stage - Rev B.arraysheet.json');
  expect(approved.json).toMatchObject({ status: 'approved', revision: 'B' });
  await expect(page.locator('.tag-check', { hasText: 'READ-ONLY' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Show', { exact: true })).toBeDisabled();
  await expect(page.locator('.card').first().getByLabel('Ground offset (m)')).toBeDisabled();

  // Opening the approved file locks it too; a new revision is editable and unsaved.
  await openJson(page, 'Main stage - Rev B.arraysheet.json', approved.text);
  await expect(page.getByText('Read-only · Main stage - Rev B.arraysheet.json')).toBeVisible();
  await page.getByRole('button', { name: 'Create new revision' }).click();
  await expect(page.getByText('Draft · Rev C')).toBeVisible();
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
  await expect(page.getByLabel('Show', { exact: true })).toBeEnabled();
  const next = await save(page);
  expect(savedName(next.download)).toBe('Main stage - Rev C.arraysheet.json');
  expect(next.json).toMatchObject({ status: 'draft', revision: 'C' });
});

test('a file with a missing section is refused and says which', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('b'));
  const { text } = await save(page);
  const bad = JSON.parse(text) as Record<string, unknown>;
  delete bad['job'];
  await openJson(page, 'bad.arraysheet.json', JSON.stringify(bad));
  await expect(page.getByRole('alert')).toContainText('Show details: is missing');
});

test('unsaved work is offered back after a reload, and a discarded copy is gone', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Company').fill('Acme Audio');
  await page.waitForTimeout(1500); // the safety-net copy is written about a second after the last edit
  await page.reload();
  await expect(page.getByRole('heading', { name: /Restore unsaved changes to/ })).toBeVisible();
  await expect(page.getByText('a safety net, not a save', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByLabel('Company')).toHaveValue('Acme Audio');
  await expect(page.getByText('● Unsaved changes')).toBeVisible();

  await page.getByLabel('Company').fill('Other');
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole('button', { name: 'Discard' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Restore unsaved changes to/ })).toHaveCount(0);
});

test('update from a newer PDF: nothing to update, then a list of differences', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Show', { exact: true }).fill('Main stage');

  await page.getByTestId('update-file').setInputFiles({ name: 'same.pdf', mimeType: 'application/pdf', buffer: samplePdf('a') });
  await expect(page.getByText('same.pdf matches this file. There is nothing to update.')).toBeVisible();

  await page.getByTestId('update-file').setInputFiles({ name: 'newer.pdf', mimeType: 'application/pdf', buffer: samplePdf('b') });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The new PDF is different');
  await expect(dialog).toContainText('Your show details and ground offsets are kept');
  await dialog.getByRole('button', { name: 'Keep as saved' }).click();
  await expect(page.locator('.card')).toHaveCount(9);

  await page.getByTestId('update-file').setInputFiles({ name: 'newer.pdf', mimeType: 'application/pdf', buffer: samplePdf('b') });
  await page.getByRole('dialog').getByRole('button', { name: 'Update from new PDF' }).click();
  await expect(page.locator('.card')).toHaveCount(8);
  await expect(page.getByLabel('Show', { exact: true })).toHaveValue('Main stage');
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
});

/** Width and height from a PNG's header. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('each array can be saved as an image, one at a time or all together', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));

  const [one] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save KARA II L Main as an image' }).click(),
  ]);
  expect(savedName(one)).toBe('Example Arena - Example Show - KARA II L Main.png');
  const { width, height } = pngSize(readFileSync(await one.path()));
  expect(width).toBe(1280);
  expect(height).toBeGreaterThan(900); // 15 enclosure rows at 2x

  const names: string[] = [];
  page.on('download', (d) => names.push(savedName(d)));
  await page.getByRole('button', { name: 'Save all as images' }).click();
  await expect.poll(() => names.length, { timeout: 15_000 }).toBe(9);
  expect(new Set(names).size).toBe(9);
  expect(names).toContain('Example Arena - Example Show - SB28 L Front.png');
  await expect(page.getByText('Saved 9 images')).toBeVisible();
});

test('images are not offered while an offset is not a number', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Ground offset for every array (m)').fill('x');
  await expect(page.getByRole('button', { name: 'Save all as images' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /as an image$/ })).toHaveCount(0);
});
