// The printed small print is the owner's approved disclaimer. These tests keep the two copies identical.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLOT_SMALL_PRINT, SMALL_PRINT } from './small-print';

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

describe('rigging plot small print', () => {
  it("is the owner's approved text, word for word", () => {
    expect(PLOT_SMALL_PRINT).toBe(
      'This plot is drawn only from the Soundvision report. It shows array positions, pickups and loads as the report states them. It does not include shackles, slings, bridles, spreaders, trusses, motors or any other rigging component. Marker symbols show a nominal rating and are a guide only. Use this plot as a visual guide when developing the final rigging plot, check the scale bar against a ruler, and check every figure against the Soundvision report. It is a design aid, not a definitive CAD drawing.',
    );
  });
});
