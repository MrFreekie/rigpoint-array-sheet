// WCAG 2.1 AA: 4.5:1 for text, 3:1 for borders and focus outlines. Checks the colour tokens in
// styles.css for Day and Night, and the fixed navy header and amber button.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

function tokens(selectorStart: string): Record<string, string> {
  const start = css.indexOf(selectorStart);
  if (start < 0) throw new Error(`No ${selectorStart} block`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!]));
}

const day = tokens(':root {');
const night = tokens(":root[data-theme='dark'] {");

// The auto-dark block must agree with the explicit Night block, or Auto and Night would differ.
const autoStart = css.indexOf("@media (prefers-color-scheme: dark)");
const autoBody = css.slice(css.indexOf('{', css.indexOf(':root:not', autoStart)) + 1, css.indexOf('}', css.indexOf(':root:not', autoStart)));
const auto = Object.fromEntries([...autoBody.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!]));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'], ['muted', 'surface'], ['muted', 'bg'],
  ['danger', 'surface'], ['ok-text', 'ok-bg'], ['check-text', 'check-bg'], ['over-text', 'over-bg'],
  ['accent-text', 'accent'],
];
const NON_TEXT_PAIRS: [string, string][] = [['border-strong', 'surface'], ['focus', 'surface'], ['focus', 'bg'], ['check-border', 'check-bg'], ['over-border', 'over-bg']];

describe.each([['Day', day], ['Night', night]] as const)('%s theme contrast', (_name, t) => {
  it.each(TEXT_PAIRS)('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)('%s against %s is at least 3:1', (fg, bg) => {
    expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(3);
  });
});

describe('fixed colours', () => {
  it('header text on navy', () => {
    expect(ratio('#ffffff', '#0b2545')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#d5dbe6', '#0b2545')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#b9c3d4', '#0b2545')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#f2c230', '#0b2545')).toBeGreaterThanOrEqual(4.5);
  });

  it('primary button text on amber', () => {
    expect(ratio('#111418', '#f2c230')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Auto follows the device with the same colours as Night', () => {
  it('has identical values', () => {
    expect(auto).toEqual(Object.fromEntries(Object.entries(night).filter(([k]) => k in auto)));
    expect(Object.keys(auto).length).toBeGreaterThan(15);
  });
});
