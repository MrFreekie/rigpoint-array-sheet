// What Save, and Save As, actually do. Kept apart from the screen so every path can be tested with
// stand-ins for the browser: save in place, ask where, refuse politely, or fall back to a download.

import { downloadText } from './download';
import { ensurePermission, fsAccessSupported, pickSaveLocation, writeToHandle } from './fs-access';

export interface Access {
  supported(): boolean;
  pickSave(suggestedName: string): Promise<FileSystemFileHandle | null>;
  ensurePermission(handle: FileSystemFileHandle, mode: 'read' | 'readwrite'): Promise<boolean>;
  write(handle: FileSystemFileHandle, text: string): Promise<void>;
  download(name: string, text: string): void;
}

export const browserAccess: Access = {
  supported: fsAccessSupported,
  pickSave: pickSaveLocation,
  ensurePermission,
  write: writeToHandle,
  download: downloadText,
};

export type SaveOutcome =
  | { kind: 'cancelled' }
  /** The browser would not let the app write to the file. Nothing was written. */
  | { kind: 'denied'; name: string }
  | { kind: 'handle'; handle: FileSystemFileHandle; name: string }
  | { kind: 'download'; name: string };

export interface SaveRequest {
  text: string;
  /** The name to suggest, or to download under. */
  suggestedName: string;
  /** The file the document came from or was last saved to, if the browser gave us a handle to it. */
  handle: FileSystemFileHandle | null;
  /** True for Save As: always ask where, even when there is a handle. */
  asNew: boolean;
}

export async function saveText(request: SaveRequest, access: Access = browserAccess): Promise<SaveOutcome> {
  if (!access.supported()) {
    access.download(request.suggestedName, request.text);
    return { kind: 'download', name: request.suggestedName };
  }
  const target = request.asNew || !request.handle ? await access.pickSave(request.suggestedName) : request.handle;
  if (!target) return { kind: 'cancelled' };
  if (!(await access.ensurePermission(target, 'readwrite'))) return { kind: 'denied', name: target.name };
  await access.write(target, request.text);
  return { kind: 'handle', handle: target, name: target.name };
}
