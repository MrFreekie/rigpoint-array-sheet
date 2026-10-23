// What a title and a note for the crew do to a card: the content, the pocket card layout and the image layout.

import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { newDoc, withNote, withTitle } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { estimateWidth, layoutCardImage, noteLines, type DrawOp } from './array-image';
import { cardContent, type CardContext } from './card-content';
import { layoutPocketCard } from './pdf-layout';

const ctx: CardContext = { show: 'Show', venue: 'Hall', status: 'issued', revision: 'B', zAxisZero: 'Floor' };
const base = newDoc(parseFixture('a'), 'a.pdf');
const index = base.result.report.sources.findIndex((s) => s.name === 'KARA II L Out');
const contentOf = (note: string, title = '') => {
  const doc = withNote(withTitle(base, index, title), index, note);
  const entry = sheetModel(doc, true).entries.find((e) => e.index === index)!;
  return cardContent(entry, ctx);
};
const texts = (ops: DrawOp[]) => ops.flatMap((o) => (o.op === 'text' ? [o.text] : []));

describe('a card with a title and a note', () => {
  it('has no extra lines when neither is set', () => {
    const c = contentOf('');
    expect(c.title).toBe('KARA II L Out');
    expect(c.reportNameNote).toBeNull();
    expect(c.note).toBeNull();
  });

  it('shows the title and says what the report calls the array, only when it is renamed', () => {
    const c = contentOf('', 'Left outfill');
    expect(c.title).toBe('Left outfill');
    expect(c.reportNameNote).toBe('Soundvision name: KARA II L Out');
    expect(contentOf('', '   ').reportNameNote).toBeNull();
  });

  it('keeps the note as typed apart from the ends, and blank means none', () => {
    expect(contentOf('  Hang at 2 m\nCheck the bar  ').note).toBe('Hang at 2 m\nCheck the bar');
    expect(contentOf(' \n ').note).toBeNull();
  });

  it('makes the pocket card taller by the note, and draws Note: in bold with the text after it', () => {
    const plain = layoutPocketCard(contentOf(''), estimateWidth);
    const noted = layoutPocketCard(contentOf('Hang at 2 m'), estimateWidth);
    expect(noted.height).toBeGreaterThan(plain.height);
    const ops = noted.ops.filter((o): o is Extract<DrawOp, { op: 'text' }> => o.op === 'text');
    expect(ops.find((o) => o.text === 'Note:')?.bold).toBe(true);
    const after = ops.find((o) => o.text === 'Hang at 2 m');
    expect(after?.bold).toBe(false);
    expect(after!.x).toBeGreaterThan(0);
  });

  it('keeps the line breaks, and a blank line stays a blank line', () => {
    const lines = noteLines('One\n\nThree', 6.5, 200, estimateWidth);
    expect(lines.map((l) => l.text)).toEqual(['One', '', 'Three']);
    expect(lines.map((l) => l.lead)).toEqual([true, false, false]);
  });

  it('wraps a long note and a 300 character word inside the card width', () => {
    const word = 'x'.repeat(300);
    const laid = layoutPocketCard(contentOf(word), estimateWidth);
    for (const o of laid.ops) {
      if (o.op !== 'text' || o.align !== 'left') continue;
      expect(o.x + estimateWidth(o.text, o.size, o.bold), o.text).toBeLessThanOrEqual(laid.width + 0.01);
    }
    expect(texts(laid.ops).filter((t) => /^x+$/.test(t)).join('')).toBe(word);
    const long = 'Rig this array after the others and check the motor chain twice. '.repeat(4).trim();
    const wrapped = noteLines(long, 6.5, 250, estimateWidth);
    expect(wrapped.length).toBeGreaterThan(2);
  });

  it('puts the title, the Soundvision name and the note on the image as well', () => {
    const options = { footer: 'f', draft: false };
    const text = texts(layoutCardImage(contentOf('Hang at 2 m', 'Left outfill'), options).ops);
    expect(text).toContain('Left outfill');
    expect(text).toContain('Soundvision name: KARA II L Out');
    expect(text).toContain('Note:');
    expect(text).toContain('Hang at 2 m');
    expect(texts(layoutCardImage(contentOf(''), options).ops)).not.toContain('Note:');
  });
});
