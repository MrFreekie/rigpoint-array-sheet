// The cable patch: a Feeder and a Way dropdown for every enclosure row of every array.
// These run on every browser project, including the 375 px phone.

import { expect, test, type Locator } from '@playwright/test';
import { changedPdf, openJson, openPdf, samplePdf, save, start } from './helpers';

const card = (page: import('@playwright/test').Page, name: string) => page.locator('.card', { has: page.getByRole('heading', { name, exact: true }) });
const feeder = (c: Locator, n: number) => c.getByLabel(new RegExp(`^Feeder, enclosure ${n} of `));
const way = (c: Locator, n: number) => c.getByLabel(new RegExp(`^Way, enclosure ${n} of `));

test('a feeder and a way are picked for each enclosure, saved, and come back on reopening', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const c = card(page, 'KARA II L Out');
  await expect(c.getByRole('columnheader', { name: 'Feeder' })).toBeVisible();
  await expect(c.getByRole('columnheader', { name: 'Way' })).toBeVisible();
  await expect(feeder(c, 1)).toHaveValue('');
  const options = await feeder(c, 1).locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(options).toEqual(['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);

  await feeder(c, 1).selectOption('1');
  await way(c, 1).selectOption('4');
  await way(c, 2).selectOption('0');
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
  // The digit sits on its colour chip.
  expect(await feeder(c, 1).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(63, 29, 8)');
  expect(await way(c, 2).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(0, 0, 0)');

  const saved = await save(page);
  const json = saved.json as { patch: { feeder: string; way: string }[][]; report: { sources: { name: string; cabinets: unknown[] }[] } };
  const at = json.report.sources.findIndex((s) => s.name === 'KARA II L Out');
  expect(json.patch[at]).toHaveLength(json.report.sources[at]?.cabinets.length ?? -1);
  expect(json.patch[at]?.[0]).toEqual({ feeder: '1', way: '4' });
  expect(json.patch[at]?.[1]).toEqual({ feeder: '', way: '0' });

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await openJson(page, 'x.arraysheet.json', saved.text);
  const again = card(page, 'KARA II L Out');
  await expect(feeder(again, 1)).toHaveValue('1');
  await expect(way(again, 1)).toHaveValue('4');
  await expect(way(again, 2)).toHaveValue('0');
  await expect(page.getByText('● Unsaved changes')).toHaveCount(0);
});

test('the dropdowns are switched off on a read-only file, and the patch is kept', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const c = card(page, 'KARA II L Out');
  await way(c, 3).selectOption('7');
  await page.getByLabel('Status').selectOption('approved');
  const approved = await save(page);
  await expect(page.locator('.tag-check', { hasText: 'READ-ONLY' })).toBeVisible();
  await expect(feeder(c, 1)).toBeDisabled();
  await expect(way(c, 3)).toBeDisabled();
  await expect(way(c, 3)).toHaveValue('7');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await openJson(page, 'x.arraysheet.json', approved.text);
  await expect(way(card(page, 'KARA II L Out'), 3)).toHaveValue('7');
  await expect(way(card(page, 'KARA II L Out'), 3)).toBeDisabled();
});

test('a collapsed mirror pair shows the shown array patch and says when the partner differs; the checkbox shows each own patch', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const left = card(page, 'KARA II L Main');
  await expect(page.getByTestId('patch-differs')).toHaveCount(0);
  await feeder(left, 1).selectOption('1');
  await expect(page.getByTestId('patch-differs')).toHaveCount(1);

  await page.getByRole('button', { name: 'Show them' }).click();
  const right = card(page, 'KARA II R Main');
  await expect(feeder(right, 1)).toHaveValue('');
  await feeder(right, 1).selectOption('2');
  await page.getByRole('button', { name: 'Hide them' }).click();
  await expect(card(page, 'KARA II R Main')).toHaveCount(0);
  await expect(feeder(card(page, 'KARA II L Main'), 1)).toHaveValue('1');
  await expect(page.getByTestId('patch-differs')).toHaveText(
    'The cable patch of KARA II R Main is not the same as KARA II L Main, whose card stands for both. Choose Show them to see and print it.',
  );
  await page.getByRole('button', { name: 'Show them' }).click();
  await expect(feeder(card(page, 'KARA II R Main'), 1)).toHaveValue('2');
  await expect(feeder(card(page, 'KARA II L Main'), 1)).toHaveValue('1');
});

test('the patch survives delete and restore, and Update from PDF keeps it by array name and row', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await feeder(card(page, 'KARA II L Out'), 2).selectOption('3');
  await page.getByRole('button', { name: 'Delete KARA II L Out' }).click();
  await expect(card(page, 'KARA II L Out')).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore KARA II L Out' }).click();
  await expect(feeder(card(page, 'KARA II L Out'), 2)).toHaveValue('3');

  await page.getByTestId('update-file').setInputFiles({
    name: 'newer.pdf',
    mimeType: 'application/pdf',
    buffer: changedPdf((sources) => sources.map((s) => (s.name === 'KARA II R Main' ? { ...s, site: (s.site ?? 0) + 1 } : s))),
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The new PDF is different', { timeout: 20_000 });
  await expect(dialog).not.toContainText('Cable patch');
  await dialog.getByRole('button', { name: 'Update from new PDF' }).click();
  await expect(feeder(card(page, 'KARA II L Out'), 2)).toHaveValue('3');
});

test('Update from PDF clears the patch of an array whose enclosure count changed, and lists it', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await feeder(card(page, 'KARA II L Out'), 1).selectOption('3');
  await feeder(card(page, 'KARA II L Main'), 1).selectOption('5');
  await page.getByTestId('update-file').setInputFiles({
    name: 'newer.pdf',
    mimeType: 'application/pdf',
    buffer: changedPdf((sources) => sources.map((s) => (s.name === 'KARA II L Out' ? { ...s, cabinets: s.cabinets.slice(0, -1) } : s))),
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('The new PDF is different', { timeout: 20_000 });
  await expect(dialog).toContainText('KARA II L Out');
  await expect(dialog).toContainText('Cable patch');
  await expect(dialog).toContainText('cleared, because the new PDF has');
  await expect(dialog).not.toContainText('KARA II L Main: Cable patch');
  await dialog.getByRole('button', { name: 'Update from new PDF' }).click();
  await expect(feeder(card(page, 'KARA II L Out'), 1)).toHaveValue('');
  await expect(feeder(card(page, 'KARA II L Main'), 1)).toHaveValue('5');
});
