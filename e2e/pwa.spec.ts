// Installable, offline, save in place, recent files and Android share.
// Service workers and the File System Access API are tested in Chromium.

import { expect, test, type Page } from '@playwright/test';
import { openPdf, samplePdf, start } from './helpers';

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Chromium desktop features');

/** Wait until the service worker is installed and controls the page. */
async function controlledByServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

test('the web manifest makes the app installable and registers file and share handlers', async ({ page, request, baseURL }) => {
  await start(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(new URL(href!, baseURL).href)).json();
  expect(manifest).toMatchObject({
    name: 'RigPoint Array Sheet',
    short_name: 'Array Sheet',
    display: 'standalone',
    start_url: './',
    scope: './',
    file_handlers: [{ action: './', accept: { 'application/json': ['.json'] } }],
    share_target: { action: './share-target', method: 'POST', enctype: 'multipart/form-data' },
  });
  expect(manifest.share_target.params.files[0]).toMatchObject({ name: 'file' });
  // The app must not offer itself as the handler for every PDF on the computer.
  expect(JSON.stringify(manifest.file_handlers)).not.toContain('pdf');
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]),
  );
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(new URL(icon.src, new URL(href!, baseURL)).href);
    expect(res.ok(), icon.src).toBe(true);
    expect(res.headers()['content-type']).toBe('image/png');
  }
});

test('works with no network once loaded, including opening a PDF', async ({ page, context }) => {
  await start(page);
  await controlledByServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Open a Soundvision report' })).toBeVisible();
  // The PDF reader and its worker come from the cache.
  await openPdf(page, samplePdf('a'));
  await expect(page.locator('.card')).toHaveCount(9);
  await expect(page.getByText('READ OK')).toBeVisible();
  await context.setOffline(false);
});

// --- Save in place. Native file pickers cannot be driven by Playwright, so the pickers are
// replaced with ones that return real file handles from the browser's origin-private file
// system. Everything after the picker (permission, writing, recent files) is the real code.

async function withFakePickers(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const calls: { kind: string; suggestedName?: string | undefined }[] = [];
    w['__pickerCalls'] = calls;
    w['__nextOpen'] = '';
    w['showSaveFilePicker'] = async (opts?: { suggestedName?: string }) => {
      calls.push({ kind: 'save', suggestedName: opts?.suggestedName });
      const dir = await navigator.storage.getDirectory();
      return dir.getFileHandle(opts?.suggestedName ?? 'untitled.arraysheet.json', { create: true });
    };
    w['showOpenFilePicker'] = async () => {
      calls.push({ kind: 'open' });
      const dir = await navigator.storage.getDirectory();
      return [await dir.getFileHandle(String(w['__nextOpen']))];
    };
  });
}

const readOpfs = (page: Page, name: string) =>
  page.evaluate(async (n) => {
    const dir = await navigator.storage.getDirectory();
    return (await (await dir.getFileHandle(n)).getFile()).text();
  }, name);

const pickerCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pickerCalls: { kind: string; suggestedName?: string }[] }).__pickerCalls);

const setNextOpen = (page: Page, name: string) => page.evaluate((n) => ((window as unknown as Record<string, unknown>)['__nextOpen'] = n), name);

test('Save writes back to the file; Save As picks a new one; recent files reopen', async ({ page }) => {
  await withFakePickers(page);
  await start(page, { fsAccess: true });
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Show', { exact: true }).fill('Main stage');
  let downloads = 0;
  page.on('download', () => downloads++);

  // First Save asks where; the picker is given a suggested name.
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const name = 'Main stage.arraysheet.json';
  await expect(page.getByText(`Saved to ${name}.`)).toBeVisible();
  expect(await pickerCalls(page)).toEqual([{ kind: 'save', suggestedName: name }]);
  await expect.poll(async () => JSON.parse(await readOpfs(page, name)).job.show).toBe('Main stage');

  // Edit and Save again: the same file is updated in place, with no picker and no download.
  await page.getByLabel('Company').fill('Acme Audio');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved · Main stage.arraysheet.json')).toBeVisible();
  await expect.poll(async () => JSON.parse(await readOpfs(page, name)).job.company).toBe('Acme Audio');
  expect((await pickerCalls(page)).filter((c) => c.kind === 'save')).toHaveLength(1);
  expect(downloads).toBe(0);

  // Recent files survive a reload and reopen the file without browsing for it.
  await page.reload();
  // Saved, so there is no unsaved copy to restore, and the file is listed under Recent.
  await expect(page.getByRole('heading', { name: /Restore unsaved changes/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Recent' }).click();
  await page.getByRole('button', { name: `Open ${name}` }).click();
  await expect(page.getByLabel('Company')).toHaveValue('Acme Audio');
  await page.getByLabel('Company').fill('Other Audio');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => JSON.parse(await readOpfs(page, name)).job.company).toBe('Other Audio');
  // The picker log starts afresh after the reload: reopening from Recent and saving needed no picker at all.
  expect(await pickerCalls(page)).toEqual([]);

  // Save As always asks where.
  await page.getByRole('button', { name: 'Save As' }).click();
  expect(await pickerCalls(page)).toEqual([{ kind: 'save', suggestedName: name }]);
});

test('Open uses the picker, and Save then writes back to what was opened', async ({ page }) => {
  await withFakePickers(page);
  await start(page, { fsAccess: true });
  await openPdf(page, samplePdf('b'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const name = 'Example Theatre - Example Show.arraysheet.json';
  await expect(page.getByText(/^Saved to /)).toBeVisible();
  await page.getByRole('button', { name: 'New' }).click();

  await setNextOpen(page, name);
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  await expect(page.getByText(`Saved · ${name}`)).toBeVisible();
  await page.getByLabel('Show', { exact: true }).fill('Second show');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => JSON.parse(await readOpfs(page, name)).job.show).toBe('Second show');
});

test('a new revision of an approved file never overwrites the original', async ({ page }) => {
  await withFakePickers(page);
  await start(page, { fsAccess: true });
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Show', { exact: true }).fill('Main stage');
  await page.getByLabel('Status').selectOption('approved');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const original = 'Main stage.arraysheet.json';
  await expect(page.getByText('Read-only · Main stage.arraysheet.json')).toBeVisible();
  const before = await readOpfs(page, original);

  await page.getByRole('button', { name: 'Create new revision' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved to Main stage - Rev A.arraysheet.json.')).toBeVisible();

  // Save asked where to put the revision, suggesting a new name, and the original is untouched.
  expect((await pickerCalls(page)).at(-1)).toEqual({ kind: 'save', suggestedName: 'Main stage - Rev A.arraysheet.json' });
  expect(await readOpfs(page, original)).toBe(before);
  await expect.poll(async () => JSON.parse(await readOpfs(page, 'Main stage - Rev A.arraysheet.json'))).toMatchObject({ status: 'draft', revision: 'A' });
});

test('a saved file shared from another app opens (Android share target)', async ({ page }) => {
  await start(page);
  await openPdf(page, samplePdf('a'));
  await page.getByLabel('Show', { exact: true }).fill('Shared show');
  const saved = await (async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
    return (await import('node:fs')).readFileSync(await download.path(), 'utf8');
  })();
  await page.getByRole('button', { name: 'New' }).click();
  await controlledByServiceWorker(page);

  // Do what Android does: POST the file to the share target as multipart form data. (A form in the
  // page cannot do it: the app's Content Security Policy forbids form submissions.)
  const redirectedTo = await page.evaluate(async (json) => {
    const body = new FormData();
    body.append('file', new File([json], 'Shared.arraysheet.json', { type: 'application/json' }));
    const res = await fetch('share-target', { method: 'POST', body });
    return res.redirected ? res.url : `no redirect (${res.status})`;
  }, saved);
  expect(new URL(redirectedTo).search).toBe('?shared=1');
  await page.goto(redirectedTo);
  await expect(page.getByLabel('Show', { exact: true })).toHaveValue('Shared show');
  expect(new URL(page.url()).search).toBe('');
});

test('a Soundvision PDF shared from another app opens too', async ({ page }) => {
  await start(page);
  await controlledByServiceWorker(page);
  const bytes = [...samplePdf('b')];
  const redirectedTo = await page.evaluate(async (data) => {
    const body = new FormData();
    body.append('file', new File([new Uint8Array(data)], 'Shared report.pdf', { type: 'application/pdf' }));
    const res = await fetch('share-target', { method: 'POST', body });
    return res.redirected ? res.url : `no redirect (${res.status})`;
  }, bytes);
  await page.goto(redirectedTo);
  await expect(page.locator('.card')).toHaveCount(8);
  await expect(page.getByRole('heading', { name: 'Rigging summary' })).toBeVisible();
  await expect(page.getByText('● Unsaved changes')).toBeVisible();
});

test('a share with no file says so', async ({ page }) => {
  await start(page);
  await controlledByServiceWorker(page);
  const redirectedTo = await page.evaluate(async () => {
    const res = await fetch('share-target', { method: 'POST', body: new FormData() });
    return res.redirected ? res.url : `no redirect (${res.status})`;
  });
  await page.goto(redirectedTo);
  await expect(page.getByRole('alert')).toContainText('Nothing was shared');
});
