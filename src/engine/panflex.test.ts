// Expected labels come from the owner's sample fly sheet output for report A (left-hand arrays):
// KARA II L Main is 70 for enclosures 1 to 12 and 90 On for 13 to 15; KARA II L Out is 90 Off throughout.
// Right-hand arrays are the mirror image and are not in that output.

import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { panflexLabel } from './panflex';

const a = parseFixture('a');
const source = (name: string) => {
  const s = a.report.sources.find((x) => x.name === name);
  if (!s) throw new Error(name);
  return s;
};
const labels = (name: string) => {
  const s = source(name);
  return s.cabinets.map((c) => panflexLabel(c.panflex, s.position?.x ?? null)?.text);
};

describe('panflexLabel', () => {
  it('matches the sample fly sheet for the left main array', () => {
    expect(labels('KARA II L Main')).toEqual([...Array(12).fill('70'), '90 On', '90 On', '90 On']);
  });

  it('matches the sample fly sheet for the left out hang', () => {
    expect(labels('KARA II L Out')).toEqual(Array(6).fill('90 Off'));
  });

  it('mirrors for the right-hand arrays', () => {
    expect(labels('KARA II R Main').slice(12)).toEqual(['90 On', '90 On', '90 On']);
    expect(labels('KARA II R Out')).toEqual(Array(6).fill('90 Off'));
  });

  it('adds equal figures with no side', () => {
    expect(panflexLabel('35/35', 5)).toEqual({ total: 70, side: null, sideUnknown: false, text: '70' });
    expect(panflexLabel('55/55', -5)).toEqual({ total: 110, side: null, sideUnknown: false, text: '110' });
  });

  it('says so when the side cannot be worked out', () => {
    expect(panflexLabel('55/35', 0)).toEqual({ total: 90, side: null, sideUnknown: true, text: '90' });
    expect(panflexLabel('55/35', null)?.sideUnknown).toBe(true);
  });

  it('returns nothing when there is no usable Panflex value', () => {
    expect(panflexLabel(null, 5)).toBeNull();
    expect(panflexLabel('wide', 5)).toBeNull();
  });

  it('swapping the figures and mirroring the position gives the same label', () => {
    for (const [p, q] of [['55/35', '35/55'], ['35/55', '55/35'], ['70/35', '35/70']] as const) {
      for (const x of [0.5, 3, 17.5]) {
        expect(panflexLabel(p, x)?.text).toBe(panflexLabel(q, -x)?.text);
      }
    }
  });
});
