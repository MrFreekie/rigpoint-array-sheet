// Soundvision PDF in, validated report out. The one entry point the interface will use.

import { parseSoundvision } from '../engine/parse';
import type { ParseResult } from '../engine/types';
import { formatIssues } from '../schema/errors';
import { ParseResultSchema } from '../schema/report';
import { readPdfItems } from './pdf-items';

export class ImportError extends Error {}

export async function importPdf(data: Uint8Array): Promise<ParseResult> {
  const items = await readPdfItems(data);
  const result = parseSoundvision(items);
  const checked = ParseResultSchema.safeParse(result);
  if (!checked.success) {
    throw new ImportError(`The report was read but the result was not valid. ${formatIssues(checked.error).join(' ')}`);
  }
  return result;
}
