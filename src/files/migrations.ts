// Each saved-file version has a step that upgrades it to the next. A file from a newer version of
// the app is refused, because it may hold things this version would silently lose.

import { FORMAT_NAME, FORMAT_VERSION } from '../schema/array-file';

export class FileError extends Error {}

export type Migration = (file: Record<string, unknown>) => Record<string, unknown>;

/** Key is the version a step upgrades from. Version 1 is the first, so there are none yet. */
export const MIGRATIONS: Record<number, Migration> = {};

export function migrate(
  raw: unknown,
  current = FORMAT_VERSION,
  steps: Record<number, Migration> = MIGRATIONS,
): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new FileError('This is not a RigPoint Array file.');
  }
  let file = raw as Record<string, unknown>;
  const m = /^arraysheet\/(\d+)$/.exec(typeof file['format'] === 'string' ? file['format'] : '');
  if (!m) throw new FileError(`This is not a RigPoint Array file. It does not say its format is "${FORMAT_NAME}/${current}".`);
  let version = Number(m[1]);
  if (version > current) {
    throw new FileError('This file was saved by a newer version of RigPoint Array. Reload the app to update it, then open the file again.');
  }
  while (version < current) {
    const step = steps[version];
    if (!step) throw new FileError(`This file is version ${version} and cannot be upgraded.`);
    file = step(file);
    version++;
    file['format'] = `${FORMAT_NAME}/${version}`;
  }
  return file;
}
