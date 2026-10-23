import { describe, expect, it } from 'vitest';
import { suggestedImageName } from '../files/file-name';
import { parseFixture } from '../testing/fixtures';
import { newDoc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { estimateWidth, IMAGE_W, layoutCardImage, wrap, type DrawOp } from './array-image';
import { cardContent } from './card-content';

const ctx = { show: 'Main stage', venue: 'Grand Hall', status: 'issued' as const, revision: 'B', zAxisZero: 'Arena floor' };
const docA = newDoc(parseFixture('a'), 'a.pdf');
const docB = newDoc(parseFixture('b'), 'b.pdf');
const docD = newDoc(parseFixture('d'), 'd.pdf');
const content = (doc: typeof docA, name: string) => cardContent(sheetModel(doc, true).entries.find((e) => e.column.name === name)!, ctx);
const options = { footer: 'RigPoint Array 0.1.0 · a.arraysheet.json · Exported 22/10/2026 09:05', draft: false };
const texts = (ops: DrawOp[]) => ops.flatMap((o) => (o.op === 'text' ? [o.text] : []));

describe('wrap', () => {
  it('breaks at spaces and keeps every word', () => {
    const lines = wrap('one two three four five six', 10, false, 80, estimateWidth);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('one two three four five six');
    for (const l of lines) expect(estimateWidth(l, 10, false)).toBeLessThanOrEqual(80);
  });

  it('breaks inside a word that is too long, losing nothing', () => {
    const lines = wrap('x'.repeat(100), 10, false, 80, estimateWidth);
    expect(lines.join('')).toBe('x'.repeat(100));
    for (const l of lines) expect(estimateWidth(l, 10, false)).toBeLessThanOrEqual(80);
  });

  it('gives one empty line for empty text', () => {
    expect(wrap('', 10, false, 80, estimateWidth)).toEqual(['']);
  });

  it('property: wrapping never loses a character', () => {
    for (let n = 1; n < 60; n++) {
      const text = Array.from({ length: n }, (_, i) => 'w'.repeat((i % 9) + 1)).join(' ');
      expect(wrap(text, 12, false, 120, estimateWidth).join(' ')).toBe(text);
    }
  });
});

describe('layoutCardImage', () => {
  it('draws every fact and every enclosure row of a flown array', () => {
    const c = content(docA, 'KARA II L Main');
    const layout = layoutCardImage(c, options);
    const t = texts(layout.ops);
    expect(layout.width).toBe(IMAGE_W);
    expect(t).toContain('KARA II L Main');
    expect(t).toContain('MAINS · vertical, flown array');
    expect(t).toContain('Main stage · Grand Hall · Issued Rev B · Z-axis zero: Arena floor');
    for (const [label, value] of c.facts) {
      expect(t).toContain(label);
      expect(t).toContain(value);
    }
    for (const cell of c.columns) expect(t).toContain(cell);
    expect(t.filter((x) => x === 'KARA II')).toHaveLength(15);
    expect(t).toContain('90 On');
    expect(t).toContain(options.footer);
  });

  it('gets taller with more rows, and every row adds the same height', () => {
    const one = layoutCardImage(content(docA, 'X8 2'), options).height;
    const six = layoutCardImage(content(docA, 'KARA II L Out'), options).height;
    const fifteen = layoutCardImage(content(docA, 'KARA II L Main'), options).height;
    expect(one).toBeLessThan(six);
    expect(six).toBeLessThan(fifteen);
  });

  it('boxes each Soundvision warning with its word', () => {
    const layout = layoutCardImage(content(docA, 'SB28 L Front'), options);
    const t = texts(layout.ops);
    expect(t).toContain('WARNING Tipping hazard');
    expect(t).toContain('CAUTION Tipping hazard');
    expect(layout.ops.filter((o) => o.op === 'rect' && o.stroke === '#000' && o.lineWidth === 3)).toHaveLength(2);
  });

  it('says when it stands for a mirror image', () => {
    const t = texts(layoutCardImage(content(docA, 'KARA II R Main'), options).ops).join(' ');
    expect(t).toContain('MIRRORED: KARA II L Main');
  });

  it('watermarks drafts only', () => {
    const draft = layoutCardImage(content(docA, 'X8 2'), { ...options, draft: true });
    expect(texts(draft.ops)).toContain('DRAFT');
    expect(texts(layoutCardImage(content(docA, 'X8 2'), options).ops)).not.toContain('DRAFT');
  });

  it('keeps everything inside the picture', () => {
    for (const [doc, name] of [[docA, 'KARA II L Main'], [docB, 'FL KARA II L'], [docB, 'GS KARA II L'], [docA, 'SB28 L Front'], [docD, 'SB28 L']] as const) {
      const layout = layoutCardImage(content(doc, name), { ...options, footer: 'x '.repeat(120) });
      for (const o of layout.ops) {
        if (o.op === 'text' && o.rotate === undefined) {
          const w = estimateWidth(o.text, o.size, o.bold);
          const left = o.align === 'left' ? o.x : o.align === 'right' ? o.x - w : o.x - w / 2;
          expect(left, o.text).toBeGreaterThanOrEqual(0);
          expect(left + w, o.text).toBeLessThanOrEqual(IMAGE_W + 0.001);
          expect(o.y + o.size, o.text).toBeLessThanOrEqual(layout.height);
        }
        if (o.op === 'line') expect(o.y2).toBeLessThanOrEqual(layout.height);
        if (o.op === 'rect') expect(o.y + o.h).toBeLessThanOrEqual(layout.height);
      }
    }
  });

  it('labels the rows of a stack laid out in columns', () => {
    const t = texts(layoutCardImage(content(docD, 'SB28 L'), options).ops);
    expect(t).toContain('Col #');
    expect(t).toContain('C1 #1');
    expect(t).toContain('C2 #1');
  });

  it('is the same every time', () => {
    const c = content(docB, 'FL KARA II L');
    expect(layoutCardImage(c, options)).toEqual(layoutCardImage(c, options));
  });

  it('leaves out the Panflex and Angle columns when the report has none', () => {
    const t = texts(layoutCardImage(content(docA, 'X8 2'), options).ops);
    expect(t).not.toContain('Panflex');
    expect(t).not.toContain('Angle');
  });
});

describe('image file names', () => {
  it('names the image after the show and the array', () => {
    expect(suggestedImageName('Main stage', 'KARA II L Main')).toBe('Main stage - KARA II L Main.png');
  });

  it('drops the Soundvision extension and unsafe characters', () => {
    expect(suggestedImageName('Example Arena - Example Show.xmlp', 'SB28 L/R')).toBe('Example Arena - Example Show - SB28 L R.png');
  });
});
