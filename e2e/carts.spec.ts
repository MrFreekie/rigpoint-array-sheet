// Carts: the groups of enclosures an array is built from, cut from a size for each type or by hand, shaded on the printed card.
// These run on every browser project, including the 375 px phone.

import { expect, test, type Page } from '@playwright/test';
import { inSettings, openJson, openPdf, openSettings, samplePdf, save, start } from './helpers';

const card = (page: Page, name: string) => page.locator('.card', { has: page.getByRole('heading', { name, exact: true }) });
const summary = (page: Page, name: string) => card(page, name).getByTestId('carts-summary');
const MAIN = 'KARA II L Main';
// A hand cut: the break between enclosures 3 and 4 is taken away, which leaves the carts set by hand.
const HAND_CUT = 'Carts: 6 + 3 + 3 + 3, set by hand';
const handCut = (page: Page) => card(page, MAIN).getByRole('button', { name: 'Cart break between enclosures 3 and 4' }).click();

test('a new file cuts KARA II three to a cart, and the card says so', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect(summary(page, MAIN)).toHaveText('Carts: 3 + 3 + 3 + 3 + 3, automatic');
  // One enclosure of another type is one block.
  await expect(summary(page, 'SB28 L Front')).toHaveText('Carts: 1, one block, automatic');
  await expect(card(page, MAIN).getByRole('button', { name: 'Back to automatic' })).toHaveCount(0);
});

test('a hand cut shows Back to automatic, and it returns the array to the sizes in Settings', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const c = card(page, MAIN);
  await expect(c.getByRole('button', { name: /into carts of/ })).toHaveCount(0);
  await handCut(page);
  await expect(summary(page, MAIN)).toHaveText(HAND_CUT);
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
  await c.getByRole('button', { name: 'Back to automatic' }).click();
  await expect(summary(page, MAIN)).toHaveText('Carts: 3 + 3 + 3 + 3 + 3, automatic');
  await expect(c.getByRole('button', { name: 'Back to automatic' })).toHaveCount(0);
});

test('a break between two rows is added and taken away from the keyboard', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const strip = card(page, MAIN).getByRole('button', { name: 'Cart break between enclosures 4 and 5' });
  await expect(strip).toHaveAttribute('aria-pressed', 'false');
  await strip.focus();
  await page.keyboard.press('Enter');
  await expect(strip).toHaveAttribute('aria-pressed', 'true');
  await expect(summary(page, MAIN)).toHaveText('Carts: 3 + 1 + 2 + 3 + 3 + 3, set by hand');
  await page.keyboard.press('Space');
  await expect(strip).toHaveAttribute('aria-pressed', 'false');
  await expect(summary(page, MAIN)).toHaveText('Carts: 3 + 3 + 3 + 3 + 3, set by hand');
  // A break that is already there can be taken out too.
  await card(page, MAIN).getByRole('button', { name: 'Cart break between enclosures 3 and 4' }).click();
  await expect(summary(page, MAIN)).toHaveText('Carts: 6 + 3 + 3 + 3, set by hand');
});

test('a break is not offered where the type changes, because a new cart always starts there', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('b'));
  const c = card(page, 'GS KARA II L');
  await expect(c.getByText('A new cart starts here, because the type changes')).toHaveCount(1);
  // Six rows of KARA II and SB18, one change of type: one forced break and four break buttons.
  await expect(c.getByRole('button', { name: /^Cart break between enclosures/ })).toHaveCount(4);
});

test('hand cut carts and the sizes are saved, and come back on reopening', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await handCut(page);
  await inSettings(page, (d) => d.getByLabel('KARA II', { exact: true }).fill('5'));
  const saved = await save(page);
  const json = saved.json as { format: string; cart_sizes: { type: string; size: number }[]; carts: { manual: boolean; breaks: number[] }[] };
  expect(json.format).toBe('arraysheet/15');
  expect(json.cart_sizes).toContainEqual({ type: 'KARA II', size: 5 });
  expect(json.carts[0]).toEqual({ manual: true, breaks: [6, 9, 12] });
  expect(json.carts.filter((x) => x.manual)).toHaveLength(1);

  await page.getByRole('button', { name: 'New' }).click();
  await openJson(page, 'carts.arraysheet.json', saved.text);
  await expect(summary(page, MAIN)).toHaveText(HAND_CUT);
  // The other array of the same type follows the saved size.
  await expect(summary(page, 'KARA II L Out')).toHaveText('Carts: 5 + 1, automatic');
});

test('the sizes in Settings cut every automatic array, a blank keeps a type as one block, and Reset brings the usual sizes back', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const dialog = await openSettings(page);
  const group = dialog.getByRole('group', { name: 'Boxes per cart, for each type of enclosure' });
  await expect(group.getByLabel('KARA II', { exact: true })).toHaveValue('3');
  await group.getByLabel('KARA II', { exact: true }).fill('5');
  await expect(summary(page, MAIN)).toHaveText('Carts: 5 + 5 + 5, automatic');
  await group.getByLabel('KARA II', { exact: true }).fill('');
  await expect(summary(page, MAIN)).toHaveText('Carts: 15, one block, automatic');
  await group.getByLabel('KARA II', { exact: true }).fill('0');
  await expect(dialog.getByText('Enter a whole number from 1 to 24, or leave it blank.')).toBeVisible();
  await expect(summary(page, MAIN)).toHaveText('Carts: 15, one block, automatic');
  await dialog.getByRole('button', { name: 'Reset to the usual sizes' }).click();
  await expect(group.getByLabel('KARA II', { exact: true })).toHaveValue('3');
  await expect(summary(page, MAIN)).toHaveText('Carts: 3 + 3 + 3 + 3 + 3, automatic');
});

test('Settings opens from the toolbar, closes with Escape, and keeps the Tab key inside it', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  const dialog = await openSettings(page);
  for (const heading of ['Cards', 'Rigging plot', 'Display']) await expect(dialog.getByRole('heading', { name: heading })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Defaults' })).toHaveCount(0);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Settings holds the show mirrors tick, and the fly sheet line has a button that does the same', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect(page.getByTestId('mirrors-line')).toContainText('9 exact mirror images are hidden');
  const dialog = await openSettings(page);
  const tick = dialog.getByLabel(/Show the 9 mirrored arrays too/);
  await expect(tick).not.toBeChecked();
  await tick.check();
  await expect(page.locator('.card')).toHaveCount(18);
  await tick.uncheck();
  await expect(page.locator('.card')).toHaveCount(9);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Show them' }).click();
  await expect(page.locator('.card')).toHaveCount(18);
  await expect(page.getByRole('button', { name: 'Hide them' })).toHaveAttribute('aria-pressed', 'true');
});

test('a hand cut on the shown card of a collapsed pair does not split the pair, and showing both gives each its own carts', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await handCut(page);
  await expect(page.getByTestId('patch-differs')).toHaveCount(0);
  await expect(card(page, 'KARA II R Main')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show them' }).click();
  await expect(summary(page, 'KARA II R Main')).toHaveText('Carts: 3 + 3 + 3 + 3 + 3, automatic');
  await expect(summary(page, MAIN)).toHaveText(HAND_CUT);
});

test('an approved file shows the carts but offers no way to change them, in the card or in Settings', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await handCut(page);
  await page.getByLabel('Status').selectOption('approved');
  const saved = await save(page);
  await openJson(page, 'approved.arraysheet.json', saved.text);
  const c = card(page, MAIN);
  await expect(summary(page, MAIN)).toHaveText(HAND_CUT);
  await expect(c.getByRole('button', { name: 'Back to automatic' })).toHaveCount(0);
  await expect(c.getByRole('button', { name: /^Cart break between enclosures/ })).toHaveCount(0);
  const dialog = await openSettings(page);
  await expect(dialog.getByLabel('KARA II', { exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Reset to the usual sizes' })).toBeDisabled();
});

test('Update from PDF keeps a hand cut array with the same rows', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await handCut(page);
  await page.getByTestId('update-file').setInputFiles({ name: 'again.pdf', mimeType: 'application/pdf', buffer: samplePdf('a') });
  // The same report: nothing differs, so nothing changes and the carts stay.
  await expect(summary(page, MAIN)).toHaveText(HAND_CUT);
});

test('a printed card shades every other cart, but never the Feeder and Way cells, and is as tall as planned', async ({ page, browserName }) => {
  // Printing is only measured in Chromium, which the PDF layout is matched to.
  test.skip(browserName !== 'chromium', 'the print layout is measured in Chromium');
  await start(page);
  await openPdf(page, samplePdf('a'));
  await expect.poll(() => page.locator('.as-fit[data-planned-height]').count()).toBeGreaterThan(0);
  await page.emulateMedia({ media: 'print' });
  const measured = await page.evaluate(() => {
    const fit = [...document.querySelectorAll<HTMLElement>('.as-fit[data-planned-height]')].find((f) => f.querySelector('.pc-title')?.textContent === 'KARA II L Main')!;
    const heads = [...fit.querySelectorAll('.pc-table thead th')].map((th) => th.textContent);
    const rows = [...fit.querySelectorAll<HTMLElement>('.pc-table tbody tr')];
    const feeder = heads.indexOf('Feeder');
    const bg = (el: Element) => getComputedStyle(el).backgroundColor;
    return {
      type: rows.map((tr) => bg(tr.querySelectorAll('td')[1]!)),
      feeder: rows.map((tr) => bg(tr.querySelectorAll('td')[feeder]!)),
      way: rows.map((tr) => bg(tr.querySelectorAll('td')[feeder + 1]!)),
      chip: rows.map((tr) => bg(tr.querySelectorAll('td')[feeder]!.querySelector('.pc-chip')!)),
      heights: rows.map((tr) => tr.getBoundingClientRect().height),
      rendered: (fit.querySelector('.pc') as HTMLElement).offsetHeight,
      planned: Number(fit.dataset['plannedHeight']),
    };
  });
  const plain = 'rgba(0, 0, 0, 0)';
  const band = 'rgb(235, 235, 235)';
  expect(measured.type).toEqual([...Array(3).fill(plain), ...Array(3).fill(band), ...Array(3).fill(plain), ...Array(3).fill(band), ...Array(3).fill(plain)]);
  expect(measured.feeder.every((b) => b === plain)).toBe(true);
  expect(measured.way.every((b) => b === plain)).toBe(true);
  expect(measured.chip.every((b) => b === 'rgb(255, 255, 255)')).toBe(true);
  for (const h of measured.heights) expect(h).toBeCloseTo(14.0625, 2);
  expect(Math.abs(measured.rendered - measured.planned)).toBeLessThan(0.5 * (96 / 25.4));
});

test('the cards and Settings do not scroll sideways', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('c'));
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(await fits()).toBe(true);
  const dialog = await openSettings(page);
  expect(await dialog.evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await fits()).toBe(true);
});
