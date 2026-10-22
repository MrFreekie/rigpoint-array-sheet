// The printed small print is the owner's approved disclaimer. These tests keep the two copies identical.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SMALL_PRINT } from './small-print';

const file = readFileSync(new URL('../../DISCLAIMER.md', import.meta.url), 'utf8');
const paragraphs = file
  .split(/\n\s*\n/)
  .map((p) => p.trim())
  .filter((p) => p && !p.startsWith('# '));

describe('small print', () => {
  it('has one paragraph for each paragraph of DISCLAIMER.md, in the same order', () => {
    expect(SMALL_PRINT).toHaveLength(paragraphs.length);
  });

  it('matches DISCLAIMER.md word for word', () => {
    SMALL_PRINT.forEach((p, i) => {
      const printed = p.label ? `**${p.label}** ${p.text}` : p.text;
      expect(printed).toBe(paragraphs[i]);
    });
  });

  it('is no longer marked as a draft', () => {
    expect(file).not.toMatch(/draft/i);
  });
});
