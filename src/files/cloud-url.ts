// The cloud link: the address of the hosted copy of the PDF, typed by the person. It is printed on the rigging summary
// as a link and a QR code, so the crew can find the most up to date version. The app never opens or checks the address.

/** The longest address the file accepts: a short link, so it fits one line on the page. */
export const CLOUD_URL_MAX = 100;

/** The line above the link on the rigging summary. */
export const CLOUD_LINK_HEADING = 'Cloud Link';
export const CLOUD_LINK_LABEL = 'Click the link or scan the QR code to find the most up to date version of this document.';

/** True for a web address (http or https, a host, no spaces or control characters) of at most CLOUD_URL_MAX characters. */
export function isCloudUrl(text: string): boolean {
  if (text.length === 0 || text.length > CLOUD_URL_MAX) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(text)) return false;
  try {
    const u = new URL(text);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname !== '' && u.username === '' && u.password === '';
  } catch {
    return false;
  }
}

/** The address to print: the typed text when it is a web address, otherwise nothing. */
export function cloudUrlOf(job: { cloudUrl?: string }): string {
  const t = (job.cloudUrl ?? '').trim();
  return isCloudUrl(t) ? t : '';
}
