import { readFileSync } from 'node:fs';
import { expect, type Download, type Locator, type Page } from '@playwright/test';
import { parseSoundvision } from '../src/engine/parse';
import type { ArraySource, TextItem } from '../src/engine/types';
import { makePdf } from '../src/testing/make-pdf';
import { renderReport, type RenderedSource } from '../src/testing/render-report';

const items = (name: 'a' | 'b' | 'c' | 'e'): TextItem[] =>
  JSON.parse(readFileSync(new URL(`../fixtures/soundvision-${name}.items.json`, import.meta.url), 'utf8')) as TextItem[];

function pdfFromItems(all: readonly TextItem[]): Buffer {
  const pages: { x: number; y: number; text: string }[][] = [];
  for (const i of all) (pages[i.page - 1] ??= []).push({ x: i.x, y: i.y, text: i.text });
  return Buffer.from(makePdf(pages.map((p) => p ?? [])));
}

/** A real PDF made from the committed, anonymised text of a sample report. */
export const samplePdf = (name: 'a' | 'b' | 'c' | 'e'): Buffer => pdfFromItems(items(name));

/** A PDF of the report A arrays (or another sample's), changed by `change` before it is drawn. */
export function changedPdf(change: (sources: ArraySource[]) => ArraySource[], from: 'a' | 'b' | 'c' | 'e' = 'a'): Buffer {
  const { report } = parseSoundvision(items(from));
  return pdfFromItems(renderReport(report.document, change(structuredClone(report.sources)) as RenderedSource[]));
}

/**
 * Open the app with a clean slate. Confirmations and leave-page prompts are accepted.
 * By default the File System Access API is hidden, so Chromium uses layer 1 (file input and
 * download) like every other browser; pass fsAccess to keep it.
 */
export async function start(page: Page, opts: { fsAccess?: boolean } = {}) {
  page.on('dialog', (d) => void d.accept());
  if (!opts.fsAccess) {
    await page.addInitScript(() => {
      // Operations on the global object are own properties of window, not of Window.prototype.
      for (const o of [window, Window.prototype] as unknown as Record<string, unknown>[]) {
        delete o['showOpenFilePicker'];
        delete o['showSaveFilePicker'];
      }
    });
  }
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Open', exact: true }).first()).toBeVisible();
}

/** Open the Settings dialog and return it. */
export async function openSettings(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Close the Settings dialog with its Close button. */
export async function closeSettings(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
}

/** Open Settings, run `fn` with the dialog, close it again. */
export async function inSettings<T>(page: Page, fn: (dialog: Locator) => Promise<T>): Promise<T> {
  const dialog = await openSettings(page);
  const result = await fn(dialog);
  await closeSettings(page);
  return result;
}

export async function openPdf(page: Page, pdf: Buffer, name = 'report.pdf') {
  await page.getByTestId('open-file').setInputFiles({ name, mimeType: 'application/pdf', buffer: pdf });
}

export async function openJson(page: Page, name: string, text: string) {
  await page.getByTestId('open-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
}

export async function save(page: Page): Promise<{ download: Download; text: string; json: Record<string, unknown> }> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save', exact: true }).click()]);
  const text = readFileSync(await download.path(), 'utf8');
  return { download, text, json: JSON.parse(text) as Record<string, unknown> };
}

/** The file name the browser saves under. WebKit on Linux replaces spaces with underscores in download names. */
export const savedName = (download: Download) => download.suggestedFilename().replace(/_/g, ' ');
