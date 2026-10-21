// Layer 1 of saving: hand the file to the browser as a download. Works in every browser.

export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadText(fileName: string, text: string): void {
  downloadBlob(fileName, new Blob([text], { type: 'application/json' }));
}
