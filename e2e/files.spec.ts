// Opening, saving, reopening, the approval lock, autosave, update from a newer PDF and image export.
// These run on every browser project, including the 375 px phone.

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { readPdfItems } from '../src/files/pdf-items';
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

test('report E: the rigging summary on screen lists the fixations and the line that covers both', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('e'));
  await expect(page.locator('.card')).not.toHaveCount(0);
  const summary = page.locator('section[aria-labelledby=rigging-heading]');
  await expect(summary).toContainText('Every pickup and fixation is listed, including those of mirrored arrays, because their positions differ.');
  const table = summary.getByTestId('rigging-fixations');
  await expect(table.locator('thead th')).toHaveText(['Array', 'Fixation', 'X (m)', 'Y (m)', 'Z (m)']);
  await expect(table.locator('tbody tr')).toHaveCount(8 * 4);
  await expect(table.locator('tbody tr').filter({ has: page.locator('th', { hasText: /^KARA II 2$/ }) }).first().locator('th, td')).toHaveText(['KARA II 2', 'Fr', '-2.84', '4.6', '1']);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
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
  await page.getByLabel('Origin (P0)').fill('Iron Line');
  await page.getByLabel('Ground offset for every array (m)').fill('0.3');
  const first = page.locator('.card').first();
  await expect(first.getByTestId('top-height')).toHaveText('9.1 m');

  const draft = await save(page);
  expect(savedName(draft.download)).toBe('Main stage.arraysheet.json');
  expect(draft.json).toMatchObject({ format: 'arraysheet/6', status: 'draft', revision: '' });
  expect(draft.json['job']).toMatchObject({ show: 'Main stage', default_offset: '0.3', origin: 'Iron Line' });
  await expect(page.getByText('Saved · Main stage.arraysheet.json')).toBeVisible();

  // Reopen what was saved, in a fresh page.
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.getByRole('heading', { name: 'Open a Soundvision report' })).toBeVisible();
  await openJson(page, 'Main stage.arraysheet.json', draft.text);
  await expect(page.getByLabel('Show', { exact: true })).toHaveValue('Main stage');
  await expect(page.getByLabel('Origin (P0)')).toHaveValue('Iron Line');
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
  await expect(page.getByRole('heading', { name: /Restore unsaved changes to/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Restore unsaved changes to/ })).toHaveCount(0);
});

test('opening another file while the restore offer shows removes the offer and keeps autosave working', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Company').fill('Acme Audio');
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Restore unsaved changes to/ })).toBeVisible();
  await openPdf(page, samplePdf('b'));
  await expect(page.getByRole('heading', { name: /Restore unsaved changes to/ })).toHaveCount(0);
  await page.getByLabel('Company').fill('Other Co');
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Restore unsaved changes to/ })).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByLabel('Company')).toHaveValue('Other Co');
});

test('update from a newer PDF: nothing to update, then a list of differences', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Show', { exact: true }).fill('Main stage');

  await page.getByTestId('update-file').setInputFiles({ name: 'same.pdf', mimeType: 'application/pdf', buffer: samplePdf('a') });
  await expect(page.getByText('same.pdf matches this file. There is nothing to update.')).toBeVisible();

  await page.getByTestId('update-file').setInputFiles({ name: 'newer.pdf', mimeType: 'application/pdf', buffer: samplePdf('b') });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The new PDF is different', { timeout: 20_000 });
  await expect(dialog).toContainText('Your show details and ground offsets are kept');
  await dialog.getByRole('button', { name: 'Keep as saved' }).click();
  await expect(page.locator('.card')).toHaveCount(9, { timeout: 20_000 });

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
  await page.getByRole('button', { name: 'Save selected as images' }).click();
  await expect.poll(() => names.length, { timeout: 15_000 }).toBe(9);
  expect(new Set(names).size).toBe(9);
  expect(names).toContain('Example Arena - Example Show - SB28 L Front.png');
  await expect(page.getByText('Saved 9 images')).toBeVisible();
});

test('images are not offered while an offset is not a number', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Ground offset for every array (m)').fill('x');
  await expect(page.getByRole('button', { name: 'Save selected as images' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /as an image$/ })).toHaveCount(0);
});

test('the choice of arrays to print is saved with the file, and a read-only file can still choose', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const cards = page.locator('.card');
  await cards.nth(2).getByLabel('Print this array').uncheck();
  await expect(page.getByTestId('print-count')).toContainText('8 of 9 arrays');
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
  const draft = await save(page);
  expect((draft.json['print'] as boolean[]).filter((p) => !p)).toHaveLength(1);
  expect((draft.json['print'] as boolean[])[4]).toBe(false); // array 4 is the third card: the first two stand for mirrors 1 and 3

  // It comes back after reopening.
  await page.getByRole('button', { name: 'New' }).click();
  await openJson(page, 'chosen.arraysheet.json', draft.text);
  await expect(page.getByTestId('print-count')).toContainText('8 of 9 arrays');
  await expect(cards.nth(2).getByLabel('Print this array')).not.toBeChecked();

  // An approved file is read-only, yet the choice can still be made. It is not saved and not a change.
  await page.getByLabel('Status').selectOption('approved');
  const approved = await save(page);
  await openJson(page, 'approved.arraysheet.json', approved.text);
  await expect(page.locator('.tag-check', { hasText: 'READ-ONLY' })).toBeVisible();
  await expect(cards.nth(2).getByLabel('Print this array')).toBeEnabled();
  await cards.nth(2).getByLabel('Print this array').check();
  await cards.nth(0).getByLabel('Print this array').uncheck();
  await expect(page.getByTestId('print-count')).toContainText('8 of 9 arrays');
  await expect(page.getByText('Read-only · approved.arraysheet.json')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

  // A new revision starts from the choices in force, and is a draft that can be saved.
  await page.getByRole('button', { name: 'Create new revision' }).click();
  await expect(page.getByTestId('print-count')).toContainText('8 of 9 arrays');
  const next = await save(page);
  expect((next.json['print'] as boolean[])[0]).toBe(false);
});

test('images follow the choice of arrays', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const cards = page.locator('.card');
  for (let i = 1; i < 9; i++) await cards.nth(i).getByLabel('Print this array').uncheck();
  const names: string[] = [];
  page.on('download', (d) => names.push(savedName(d)));
  await page.getByRole('button', { name: 'Save selected as images' }).click();
  await expect.poll(() => names.length).toBe(1);
  expect(names[0]).toBe('Example Arena - Example Show - KARA II L Main.png');
});

test('Download PDF makes the sheet in one click, with no print window', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Show', { exact: true }).fill('Main stage');
  await page.getByLabel('Venue').fill('Grand Hall');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
  expect(savedName(download)).toBe('Main stage.pdf');
  const bytes = readFileSync(await download.path());
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');

  // Read it back: four arrays to a page, the show and venue on every panel, the plot, the rigging page last.
  const items = await readPdfItems(new Uint8Array(bytes));
  expect(Math.max(...items.map((i) => i.page))).toBe(5);
  const text = (n: number) => items.filter((i) => i.page === n).map((i) => i.text).join(' ');
  expect(text(1)).toContain('KARA II L Main');
  expect(text(1).match(/Main stage · Grand Hall/g)).toHaveLength(4);
  expect(text(4)).toContain('Rigging plot');
  expect(text(5)).toContain('Rigging summary');
  await expect(page.getByText('Saved Main stage.pdf.')).toBeVisible();
});

test('Download PDF follows the choice of arrays and is off when none is chosen', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('b'));
  const cards = page.locator('.card');
  for (let i = 1; i < 8; i++) await cards.nth(i).getByLabel('Print this array').uncheck();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
  const items = await readPdfItems(new Uint8Array(readFileSync(await download.path())));
  expect(Math.max(...items.map((i) => i.page))).toBe(3); // one card, the plot, then the rigging page

  await cards.nth(0).getByLabel('Print this array').uncheck();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
});

test('Download DXF saves the plot in millimetres at full size, and says so beside the button', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Show', { exact: true }).fill('Main stage');
  await page.getByLabel('Origin (P0)').fill('DSE');
  const plot = page.getByTestId('plot-preview');
  await expect(plot.getByText('DXF units are millimetres at full size (1:1).')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), plot.getByRole('button', { name: 'Download DXF' }).click()]);
  expect(savedName(download)).toBe('Main stage.dxf');
  const text = readFileSync(await download.path(), 'ascii');
  const lines = text.split('\r\n');
  // Group code and value pairs from the first comment to the end of file.
  expect(lines[0]).toBe('999');
  expect(lines.slice(-3, -1)).toEqual(['0', 'EOF']);
  const at = lines.indexOf('$INSUNITS');
  expect(lines.slice(at, at + 3)).toEqual(['$INSUNITS', '70', '4']);
  expect(lines).toContain('Soundvision origin: DSE');
  expect(lines).toContain('ARRAYS');
});
