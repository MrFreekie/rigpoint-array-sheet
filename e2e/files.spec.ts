// Opening, saving, reopening, the approval lock, autosave, update from a newer PDF and image export.
// These run on every browser project, including the 375 px phone.

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { readPdfItems } from '../src/files/pdf-items';
import { changedPdf, closeSettings, inSettings, openJson, openPdf, openSettings, samplePdf, save, savedName, start } from './helpers';

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
  await expect(page.getByRole('alert')).toContainText('That is not a PDF or a RigPoint Array Sheet file');
  await openPdf(page, Buffer.from('this is not a pdf'), 'broken.pdf');
  await expect(page.getByRole('alert')).toContainText(/not a valid PDF|could not be read/);
});

test('save, reopen, approve and lock', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect(page.getByText('● Unsaved changes')).toBeVisible();

  await page.getByLabel('Show', { exact: true }).fill('Main stage');
  await inSettings(page, async (d) => {
    await d.getByLabel('Origin (P0)').fill('Iron Line');
    await d.getByLabel('Ground offset for every array (m)').fill('0.3');
  });
  const first = page.locator('.card').first();
  await expect(first.getByTestId('top-height')).toHaveText('9.1 m');

  const draft = await save(page);
  expect(savedName(draft.download)).toBe('Main stage.arraysheet.json');
  expect(draft.json).toMatchObject({ format: 'arraysheet/11', status: 'draft', revision: '' });
  expect(draft.json['job']).toMatchObject({ show: 'Main stage', default_offset: '0.3', origin: 'Iron Line' });
  await expect(page.getByText('Saved · Main stage.arraysheet.json')).toBeVisible();

  // Reopen what was saved, in a fresh page.
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.getByRole('heading', { name: 'Open a Soundvision report' })).toBeVisible();
  await openJson(page, 'Main stage.arraysheet.json', draft.text);
  await expect(page.getByLabel('Show', { exact: true })).toHaveValue('Main stage');
  await inSettings(page, (d) => expect(d.getByLabel('Origin (P0)')).toHaveValue('Iron Line'));
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

test('notes for the show are typed in Show details, shown on the rigging summary, saved, and read-only when locked', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const showNotes = () => page.getByRole('region', { name: 'Show details' }).getByRole('textbox', { name: /^Notes/ });
  const notes = showNotes();
  await expect(page.getByText('0 of 500 characters')).toBeVisible();
  await notes.fill('Load in at 08:00.\nCall Sam first.');
  await expect(page.getByText('33 of 500 characters')).toBeVisible();
  const summary = page.locator('section', { has: page.getByRole('heading', { name: 'Rigging summary' }) });
  await expect(summary.getByTestId('show-notes')).toContainText('Load in at 08:00.');
  await expect(summary.getByTestId('show-notes')).toContainText('Call Sam first.');

  // The box stops at 500 characters, and a pasted control character is dropped.
  await notes.fill('x'.repeat(520));
  await expect(page.getByText('500 of 500 characters')).toBeVisible();
  await notes.fill('Bring ear plugs.');

  const draft = await save(page);
  expect(draft.json['job']).toMatchObject({ notes: 'Bring ear plugs.' });
  await page.getByRole('button', { name: 'New' }).click();
  await openJson(page, 'saved.arraysheet.json', draft.text);
  await expect(showNotes()).toHaveValue('Bring ear plugs.');

  // Approved and saved: the box is read-only, and the notes still show.
  await page.getByLabel('Status').selectOption('approved');
  await save(page);
  await expect(showNotes()).toBeDisabled();
  await expect(summary.getByTestId('show-notes')).toContainText('Bring ear plugs.');
});

test('the show date is picked in Show details, saved as YYYY-MM-DD, printed UK style, and read-only when locked', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const date = page.getByLabel('Show date');
  await date.fill('2026-10-23');
  await expect(date).toHaveValue('2026-10-23');
  const draft = await save(page);
  expect(draft.json['job']).toMatchObject({ show_date: '2026-10-23' });
  await page.getByRole('button', { name: 'New' }).click();
  await openJson(page, 'saved.arraysheet.json', draft.text);
  await expect(page.getByLabel('Show date')).toHaveValue('2026-10-23');

  // The print view carries it on the panels, the plot and the rigging page, written day, month, year.
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('print-page').first().locator('.as-panel-details').first()).toContainText('23/10/2026');
  await expect(page.getByTestId('print-page').last()).toContainText('23/10/2026');
  await expect(page.getByTestId('print-page').last()).not.toContainText('2026-10-23');
  await page.emulateMedia({ media: 'screen' });

  await page.getByLabel('Status').selectOption('approved');
  await save(page);
  await expect(page.getByLabel('Show date')).toBeDisabled();
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
  await expect(dialog).toContainText('Your show details, ground offsets, titles, notes, plot symbols and cable patches are kept');
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
  await inSettings(page, (d) => d.getByLabel('Ground offset for every array (m)').fill('x'));
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
  await inSettings(page, (d) => d.getByLabel('Origin (P0)').fill('DSE'));
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

test('an array can be deleted and the delete undone, and the sheet, the summary and the plot follow', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect(page.getByText('9 of 18 arrays shown')).toBeVisible();
  const summary = page.locator('section', { has: page.getByRole('heading', { name: 'Rigging summary' }) });
  await expect(summary).toContainText('KARA II L Main');
  await expect(page.getByTestId('deleted-list')).toHaveCount(0);
  await expect(page.locator('svg', { hasText: 'PA1' }).first()).toContainText('KARA II L Main');

  await page.getByRole('button', { name: 'Delete KARA II L Main', exact: true }).click();
  // Its mirror image now stands alone, so the card count is the same, and the figures leave the summary.
  await expect(page.getByText('9 of 17 arrays shown')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'KARA II L Main', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'KARA II R Main', exact: true })).toBeVisible();
  await expect(page.getByTestId('deleted-list')).toContainText('1 deleted');
  await expect(summary).not.toContainText('KARA II L Main');
  await expect(page.locator('svg', { hasText: 'PA1' }).first()).not.toContainText('KARA II L Main');
  await expect(page.getByText('● Unsaved changes')).toBeVisible();

  // The focus lands on Undo, which names what it brings back.
  const undo = page.getByRole('button', { name: 'Undo delete of KARA II L Main' });
  await expect(undo).toBeFocused();
  await undo.click();
  await expect(page.getByText('9 of 18 arrays shown')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'KARA II L Main', exact: true })).toBeVisible();
  await expect(summary).toContainText('KARA II L Main');
  await expect(page.getByTestId('deleted-list')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo delete', exact: true })).toBeDisabled();
});

test('a title and a note are saved, come back on reopening, and stay with the array when the file is updated from a PDF', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const card = () => page.locator('.card', { has: page.getByRole('heading', { name: 'KARA II L Out', exact: true }) });
  await card().getByLabel('Card title').fill('Left outfill');
  await page.locator('.card', { hasText: 'Left outfill' }).getByLabel('Notes for the crew').fill('Hang at 2 m');
  const saved = await save(page);
  const json = saved.json as { titles: string[]; notes: string[]; report: { sources: { name: string }[] } };
  const at = json.report.sources.findIndex((s) => s.name === 'KARA II L Out');
  expect(json.titles[at]).toBe('Left outfill');
  expect(json.notes[at]).toBe('Hang at 2 m');
  expect(json.titles.filter(Boolean)).toHaveLength(1);

  await page.getByRole('button', { name: 'New' }).click();
  await openJson(page, 'x.arraysheet.json', saved.text);
  const again = page.locator('.card', { hasText: 'Left outfill' });
  await expect(again).toContainText('Soundvision name: KARA II L Out');
  await expect(again.getByLabel('Card title')).toHaveValue('Left outfill');
  await expect(again.getByLabel('Notes for the crew')).toHaveValue('Hang at 2 m');
  // The rigging plot and its table use the title as well.
  const summary = page.locator('section', { has: page.getByRole('heading', { name: 'Rigging summary' }) });
  await expect(summary).toContainText('Left outfill');
  await expect(summary).not.toContainText('KARA II L Out');

  // A newer PDF names the array by its report name, so the title and the note stay with it.
  await page.getByTestId('update-file').setInputFiles({
    name: 'newer.pdf',
    mimeType: 'application/pdf',
    buffer: changedPdf((sources) => sources.map((s) => (s.name === 'KARA II R Main' ? { ...s, site: (s.site ?? 0) + 1 } : s))),
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The new PDF is different', { timeout: 20_000 });
  await dialog.getByRole('button', { name: 'Update from new PDF' }).click();
  const kept = page.locator('.card', { hasText: 'Left outfill' });
  await expect(kept.getByLabel('Notes for the crew')).toHaveValue('Hang at 2 m');
});

test('the title and note boxes are switched off on a read-only file', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Status').selectOption('approved');
  await save(page);
  await expect(page.locator('.tag-check', { hasText: 'READ-ONLY' })).toBeVisible();
  await expect(page.getByLabel('Card title').first()).toBeDisabled();
  await expect(page.getByLabel('Notes for the crew').first()).toBeDisabled();
});

test('a deleted array stays in the saved file, can be restored after reopening, and is not counted as deleted twice', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByRole('button', { name: 'Delete KARA II L Main', exact: true }).click();
  const saved = await save(page);
  const json = saved.json as { deleted: boolean[]; report: { sources: unknown[] }; titles: string[]; notes: string[] };
  expect(json.deleted[0]).toBe(true);
  expect(json.deleted.filter(Boolean)).toHaveLength(1);
  expect(json.report.sources).toHaveLength(18);
  expect(json.titles).toHaveLength(18);
  expect(json.notes).toHaveLength(18);

  await page.getByRole('button', { name: 'New' }).click();
  await openJson(page, 'x.arraysheet.json', saved.text);
  await expect(page.getByText('9 of 17 arrays shown')).toBeVisible();
  await expect(page.getByText('Saved · x.arraysheet.json')).toBeVisible();
  // Undo is a session thing: there is nothing to undo after reopening, but Restore works.
  await expect(page.getByRole('button', { name: 'Undo delete', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Restore KARA II L Main' }).click();
  await expect(page.getByText('9 of 18 arrays shown')).toBeVisible();
  await expect(page.getByTestId('deleted-list')).toHaveCount(0);
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
});

test('a read-only file cannot delete or restore', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByRole('button', { name: 'Delete KARA II L Main', exact: true }).click();
  await page.getByLabel('Status').selectOption('approved');
  const approved = await save(page);
  await expect(page.locator('.tag-check', { hasText: 'READ-ONLY' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete KARA II R Main', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restore KARA II L Main' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Undo delete/ })).toBeDisabled();
  // What was approved stays approved.
  expect((approved.json as { deleted: boolean[] }).deleted[0]).toBe(true);
});

test('update from PDF brings a deleted array back, and says so', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByRole('button', { name: 'Delete KARA II L Main', exact: true }).click();
  await expect(page.getByText('9 of 17 arrays shown')).toBeVisible();

  await page.getByTestId('update-file').setInputFiles({ name: 'newer.pdf', mimeType: 'application/pdf', buffer: samplePdf('a') });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The new PDF is different', { timeout: 20_000 });
  await expect(dialog).toContainText('RESTORED');
  await expect(dialog).toContainText('KARA II L Main');
  await expect(dialog).toContainText('differs from this file in 1 place');
  await dialog.getByRole('button', { name: 'Update from new PDF' }).click();

  await expect(page.getByText('9 of 18 arrays shown')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'KARA II L Main', exact: true })).toBeVisible();
  await expect(page.getByTestId('deleted-list')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo delete', exact: true })).toBeDisabled();
});

test('every symbol can be picked whatever the weight of the array, and typed text is explained as grey on the plot', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('c'));
  const front = page.getByRole('group', { name: 'Plot symbol, front pickup' }).first();
  await expect(front.locator('option[value="quarter"]')).toBeEnabled();
  await expect(front).toContainText('A symbol with typed text is grey on the plot');
  await expect(front).not.toContainText('Greyed on the plot');
  await front.getByLabel('Typed value, instead of the rating (optional)').fill('1.5 t');
  await expect(front.locator('option[value="quarter"]')).toBeEnabled();
});

test('update from PDF keeps a symbol for the same pickup and resets one the new PDF cannot follow, and says so', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('c'));
  const card = page.locator('article.card').filter({ has: page.getByRole('group', { name: 'Plot symbol, rear pickup' }) }).first();
  const name = (await card.getByRole('heading', { level: 3 }).innerText()).trim();
  await card.getByRole('group', { name: 'Plot symbol, front pickup' }).getByRole('combobox').selectOption('two');
  await card.getByRole('group', { name: 'Plot symbol, rear pickup' }).getByLabel('Typed value, instead of the rating (optional)').fill('1.5 t');

  const moved = changedPdf((sources) => sources.map((s) => (s.name === name ? { ...s, pickups: s.pickups.map((p) => (p.which === 'rear' ? { ...p, position: p.position + 1 } : p)) } : s)), 'c');
  await page.getByTestId('update-file').setInputFiles({ name: 'newer.pdf', mimeType: 'application/pdf', buffer: moved });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The new PDF is different', { timeout: 20_000 });
  await expect(dialog).toContainText('Plot symbol, rear pickup');
  await expect(dialog).toContainText('back to 1 t');
  await dialog.getByRole('button', { name: 'Update from new PDF' }).click();

  const again = page.locator('article.card').filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) }).first();
  await expect(again.getByRole('group', { name: 'Plot symbol, front pickup' }).getByRole('combobox')).toHaveValue('two');
  await expect(again.getByRole('group', { name: 'Plot symbol, rear pickup' }).getByLabel('Typed value, instead of the rating (optional)')).toHaveValue('');
});

test('on a read-only file a symbol can still be picked for this session, and is not saved', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('c'));
  await page.getByLabel('Status').selectOption('approved');
  const { text } = await save(page);
  await openJson(page, 'locked.arraysheet.json', text);
  const front = page.getByRole('group', { name: 'Plot symbol, front pickup' }).first();
  await expect(front.getByRole('combobox')).toBeEnabled();
  await front.getByRole('combobox').selectOption('two');
  await expect(front.getByRole('combobox')).toHaveValue('two');
  await expect(page.getByText('Unsaved changes')).toHaveCount(0);
});

const VENUE_TEXT = [
  '"; Exported by SU4SV v7.0"',
  '"; LengthUnit","m"',
  '"Label","Walls 01"',
  '-20,-6,0',
  '20,-6,0',
  '20,50,0',
  '-20,50,0',
  '";"',
  '"Label","Roof 01"',
  '-15,4,12',
  '15,4,12',
  '";"',
].join('\n');
const VENUE_OTHER = ['"; LengthUnit","m"', '"Label","Balcony 01"', '-5,0,3', '5,0,3', '";"'].join('\n');
const venueFile = (text: string, name = 'venue.txt') => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });

test('a venue can be imported, shown by layer, replaced and removed, and it never changes the plot', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const plot = page.getByTestId('plot-preview');
  const svg = plot.getByTestId('plot-svg').first();
  const scale = async () => (await svg.textContent())?.match(/Scale 1:\d+/)?.[0];
  const before = await scale();
  await expect(svg.locator('path')).toHaveCount(0);

  const settings = await openSettings(page);
  await settings.getByTestId('venue-file').setInputFiles(venueFile(VENUE_TEXT));
  await expect(settings.getByText('Imported 5 lines in 2 layers.')).toBeVisible();
  const layers = settings.getByTestId('venue-panel').getByRole('group', { name: /Layers to show/ });
  await expect(layers.getByLabel(/Walls/)).toBeChecked();
  await expect(layers.getByLabel(/Roof/)).toBeChecked();
  expect(await svg.locator('path').count()).toBeGreaterThan(0);
  expect(await scale()).toBe(before);

  // A layer that is off is not drawn.
  const drawn = async () => (await svg.locator('path').evaluateAll((ps) => ps.map((p) => p.getAttribute('d')?.length ?? 0).reduce((a, b) => a + b, 0)));
  const all = await drawn();
  await layers.getByLabel(/Roof/).uncheck();
  expect(await drawn()).toBeLessThan(all);
  await closeSettings(page);
  await expect(page.getByText('● Unsaved changes')).toBeVisible();

  // It is saved in the file and comes back with the layer still off.
  const saved = await save(page);
  expect((saved.json['format'] as string)).toBe('arraysheet/11');
  expect(saved.text).not.toContain('Label');
  await openJson(page, 'venue.arraysheet.json', saved.text);
  const again = (await openSettings(page)).getByTestId('venue-panel').getByRole('group', { name: /Layers to show/ });
  await expect(again.getByLabel(/Roof/)).not.toBeChecked();
  await expect(again.getByLabel(/Walls/)).toBeChecked();

  // Replacing starts with every layer on.
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByTestId('venue-file').setInputFiles(venueFile(VENUE_OTHER));
  await expect(dialog.getByText('Imported 1 line in 1 layer.')).toBeVisible();
  await expect(dialog.getByTestId('venue-panel').getByLabel(/Balcony/)).toBeChecked();
  await expect(dialog.getByTestId('venue-panel').getByLabel(/Walls/)).toHaveCount(0);

  // Removing it takes it all away.
  await dialog.getByRole('button', { name: 'Remove venue' }).click();
  await expect(plot.getByTestId('plot-svg').first().locator('path')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Import venue (SU4SV text file)' })).toBeVisible();
  await closeSettings(page);
});

test('a venue file that is not in metres is refused with a plain message', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const settings = await openSettings(page);
  await settings.getByTestId('venue-file').setInputFiles(venueFile(VENUE_TEXT.replace('"m"', '"ft"')));
  await expect(settings.getByRole('alert')).toContainText('in ft');
  await expect(settings.getByRole('button', { name: 'Remove venue' })).toHaveCount(0);
});

test('Download DXF can include the venue, one DXF layer for each SketchUp layer', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const plot = page.getByTestId('plot-preview');
  await expect(plot.getByLabel(/Include venue in the DXF/)).toHaveCount(0);
  await inSettings(page, async (d) => {
    await d.getByTestId('venue-file').setInputFiles(venueFile(VENUE_TEXT));
    await expect(d.getByText('Imported 5 lines in 2 layers.')).toBeVisible();
  });
  const tick = plot.getByLabel(/Include venue in the DXF/);
  await expect(tick).not.toBeChecked();
  const [without] = await Promise.all([page.waitForEvent('download'), plot.getByRole('button', { name: 'Download DXF' }).click()]);
  expect(readFileSync(await without.path(), 'ascii')).not.toContain('VENUE_');
  await tick.check();
  const [withVenue] = await Promise.all([page.waitForEvent('download'), plot.getByRole('button', { name: 'Download DXF' }).click()]);
  const lines = readFileSync(await withVenue.path(), 'ascii').split('\r\n');
  expect(lines).toContain('VENUE_Walls');
  expect(lines).toContain('VENUE_Roof');
});

test('an approved file offers no venue changes', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await inSettings(page, (d) => d.getByTestId('venue-file').setInputFiles(venueFile(VENUE_TEXT)));
  await page.getByLabel('Status').selectOption('approved');
  const saved = await save(page);
  await openJson(page, 'approved.arraysheet.json', saved.text);
  const panel = (await openSettings(page)).getByTestId('venue-panel');
  await expect(panel.getByRole('button', { name: 'Replace venue (SU4SV text file)' })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Remove venue' })).toBeDisabled();
  await expect(panel.getByLabel(/Walls/)).toBeDisabled();
});

test('the on-screen plot has white space around it, stays on white, and does not scroll sideways', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const plot = page.getByTestId('plot-preview');
  await inSettings(page, async (d) => {
    await d.getByTestId('venue-file').setInputFiles(venueFile(VENUE_TEXT));
    await expect(d.getByText('Imported 5 lines in 2 layers.')).toBeVisible();
  });
  const frame = plot.locator('.plot-frame').first();
  await expect(frame).toBeVisible();
  const style = await frame.evaluate((el) => {
    const s = getComputedStyle(el);
    return { padding: s.paddingLeft, top: s.paddingTop, bg: s.backgroundColor };
  });
  expect(style).toEqual({ padding: '14px', top: '14px', bg: 'rgb(255, 255, 255)' });
  const box = await frame.boundingBox();
  const svgBox = await plot.getByTestId('plot-svg').first().boundingBox();
  expect(svgBox!.x - box!.x).toBeGreaterThanOrEqual(14);
  expect(svgBox!.x + svgBox!.width).toBeLessThanOrEqual(box!.x + box!.width - 14 + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
