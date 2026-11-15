import { describe, expect, it } from 'vitest';
import { qrMatrix } from '../print/qr';
import { estimateWidth } from '../print/array-image';
import { layoutRiggingPage } from '../print/pdf-layout';
import { CLOUD_URL_MAX, cloudUrlOf, isCloudUrl } from './cloud-url';

describe('cloud link', () => {
  it('accepts a short web address and nothing else', () => {
    for (const ok of ['https://example.com/a1', 'http://example.com', 'https://bit.ly/3xYz']) expect(isCloudUrl(ok)).toBe(true);
    for (const bad of ['', 'example.com', 'ftp://example.com', 'javascript:alert(1)', 'https://', 'https://exa mple.com', 'https://u:p@example.com', `https://example.com/${'a'.repeat(CLOUD_URL_MAX)}`]) expect(isCloudUrl(bad)).toBe(false);
  });

  it('prints only a valid address', () => {
    expect(cloudUrlOf({ cloudUrl: ' https://example.com/x ' })).toBe('https://example.com/x');
    expect(cloudUrlOf({ cloudUrl: 'nonsense' })).toBe('');
    expect(cloudUrlOf({})).toBe('');
  });

  it('puts the heading, the invitation, the address, a QR code and two link areas under the notes, and nothing without one', () => {
    const base = { rows: [], fixations: [], subtitle: '', notes: 'Hello', qr: qrMatrix('https://example.test/'), qrUrl: 'https://example.test/' };
    const url = 'https://example.com/a1';
    const laid = layoutRiggingPage({ ...base, cloud: { url, qr: qrMatrix(url) } }, estimateWidth);
    const texts = laid.ops.flatMap((o) => (o.op === 'text' ? [o.text] : []));
    expect(texts).toContain('Cloud Link');
    expect(texts).toContain(url);
    expect(texts.join(' ')).toContain('most up to date');
    expect(texts.indexOf('Notes')).toBeLessThan(texts.indexOf('Cloud Link'));
    expect(laid.links).toHaveLength(2);
    expect(laid.links!.every((l) => l.url === url && l.w > 0 && l.h > 0)).toBe(true);
    const none = layoutRiggingPage(base, estimateWidth);
    expect(none.links).toEqual([]);
    expect(none.ops.some((o) => o.op === 'text' && o.text === 'Cloud Link')).toBe(false);
  });
});
