import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { newDoc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { cardContent, warningText, type CardContext } from './card-content';
import { formatStamp, printFooter } from './footer';
import { CARDS_PER_PAGE, CELL_H_MM, fitScale, LONG_H_MM, MIN_FULL_SCALE, PX_PER_MM, planPages, type PagePlan } from './layout';

const px = (mm: number) => mm * PX_PER_MM;
const MIN_SCALE = 0.72;

describe('fitScale', () => {
  it('leaves content that already fits at full size, and never scales up', () => {
    expect(fitScale(px(100), 130, MIN_SCALE)).toEqual({ scale: 1, overflow: false });
    expect(fitScale(px(10), 130, MIN_SCALE).scale).toBe(1);
  });

  it('shrinks content that is a little too tall', () => {
    const fit = fitScale(px(160), 128, MIN_SCALE);
    expect(fit.scale).toBeCloseTo(0.8, 2);
    expect(fit.overflow).toBe(false);
  });

  it('rounds down, so the scaled content is never taller than its box', () => {
    for (const mm of [140, 150, 163, 170, 175]) {
      expect(mm * fitScale(px(mm), 128, MIN_SCALE).scale).toBeLessThanOrEqual(128 + 1e-9);
    }
  });

  it('stops at the minimum and says it overflows', () => {
    expect(fitScale(px(400), 128, MIN_SCALE)).toEqual({ scale: MIN_SCALE, overflow: true });
  });

  it('property: the scale is always between the minimum and 1', () => {
    for (let mm = 1; mm < 2000; mm += 13) {
      const { scale } = fitScale(px(mm), 128, MIN_SCALE);
      expect(scale).toBeGreaterThanOrEqual(MIN_SCALE);
      expect(scale).toBeLessThanOrEqual(1);
    }
  });

  it('copes with nothing to measure', () => {
    expect(fitScale(0, 128, 0.5)).toEqual({ scale: 1, overflow: false });
    expect(fitScale(Number.NaN, 128, 0.5)).toEqual({ scale: 1, overflow: false });
  });
});

describe('planPages', () => {
  const cards = (heights: number[]) => heights.map((h, i) => ({ item: i, heightPx: px(h) }));
  const shape = (pages: PagePlan<number>[]) => pages.map((p) => `${p.kind} ${p.cards.map((c) => c.item).join(',')}`);

  it('puts four cards on a page, in order', () => {
    expect(shape(planPages(cards(Array(9).fill(100))))).toEqual(['grid 0,1,2,3', 'grid 4,5,6,7', 'grid 8']);
  });

  it('puts a card exactly CELL_H_MM tall in a pocket panel at full size, and one a little taller in a long column', () => {
    const [fits] = planPages(cards([CELL_H_MM]));
    expect(fits).toEqual({ kind: 'grid', cards: [{ item: 0, scale: 1 }] });
    const [taller] = planPages(cards([CELL_H_MM + 0.1]));
    expect(taller).toEqual({ kind: 'long', cards: [{ item: 0, scale: 1, overflow: false }] });
  });

  it('puts two long cards on a page, in order, and the odd one on its own', () => {
    expect(shape(planPages(cards([300, 300, 300])))).toEqual(['long 0,1', 'long 2']);
  });

  it('puts long pages before grid pages, each kind in report order', () => {
    expect(shape(planPages(cards([100, 100, 300, 100, 100, 300, 300])))).toEqual(['long 2,5', 'long 6', 'grid 0,1,3,4']);
  });

  it('shrinks a card above LONG_H_MM to fit, and stops at the floor with overflow', () => {
    const [shrunk] = planPages(cards([LONG_H_MM * 1.5]));
    expect(shrunk).toMatchObject({ kind: 'long', cards: [{ overflow: false }] });
    const scale = shrunk?.cards[0]?.scale ?? 0;
    expect(scale).toBeCloseTo(1 / 1.5, 2);
    expect(scale * LONG_H_MM * 1.5).toBeLessThanOrEqual(LONG_H_MM * 1.5 / 1.5 + 1e-9);
    const [huge] = planPages(cards([LONG_H_MM / MIN_FULL_SCALE + 50]));
    expect(huge).toEqual({ kind: 'long', cards: [{ item: 0, scale: MIN_FULL_SCALE, overflow: true }] });
  });

  it('never pairs a card that overflows', () => {
    const huge = LONG_H_MM / MIN_FULL_SCALE + 50;
    const pages = planPages(cards([300, huge, 300]));
    expect(shape(pages)).toEqual(['long 0', 'long 1', 'long 2']);
    expect(pages.map((p) => p.cards.length)).toEqual([1, 1, 1]);
  });

  it('property: grid cards print at full size, four to a grid page and two to a long page, every card once, long pages first', () => {
    for (let n = 0; n < 40; n++) {
      const heights = Array.from({ length: n }, (_, i) => 40 + ((i * 37) % 700));
      const pages = planPages(cards(heights));
      const placed = pages.flatMap((p) => p.cards.map((c) => c.item));
      expect([...placed].sort((a, b) => a - b)).toEqual(heights.map((_, i) => i));
      let seenGrid = false;
      for (const p of pages) {
        if (p.kind === 'grid') {
          seenGrid = true;
          expect(p.cards.length).toBeLessThanOrEqual(CARDS_PER_PAGE);
          for (const c of p.cards) expect(c.scale).toBe(1);
        } else {
          expect(seenGrid).toBe(false);
          expect(p.cards.length).toBeLessThanOrEqual(2);
        }
      }
      // Within each kind the report order is kept.
      for (const kind of ['grid', 'long']) {
        const ids = pages.filter((p) => p.kind === kind).flatMap((p) => p.cards.map((c) => c.item));
        expect(ids).toEqual([...ids].sort((a, b) => a - b));
      }
    }
  });

  it('plans nothing for no cards', () => {
    expect(planPages([])).toEqual([]);
  });
});

describe('printFooter', () => {
  const printedAt = new Date(2026, 9, 22, 9, 5);
  const base = { appVersion: '0.1.0', soundvisionVersion: '2026.3.1', defaultName: 'Main stage.arraysheet.json', dirty: false, printedAt };

  it('marks a file that was never saved', () => {
    expect(printFooter({ ...base, fileName: null })).toBe(
      'RigPoint Array 0.1.0 · Soundvision 2026.3.1 · Main stage.arraysheet.json (not saved) · Printed 22/10/2026 09:05',
    );
  });

  it('names a saved file, and marks it when it has changed since', () => {
    expect(printFooter({ ...base, fileName: 'a.arraysheet.json' })).toContain('a.arraysheet.json · Printed');
    expect(printFooter({ ...base, fileName: 'a.arraysheet.json', dirty: true })).toContain('a.arraysheet.json (unsaved changes)');
  });

  it('copes with a report that states no version, and can say Exported', () => {
    const text = printFooter({ ...base, soundvisionVersion: null, fileName: 'a', verb: 'Exported' });
    expect(text).not.toContain('Soundvision');
    expect(text).toContain('Exported 22/10/2026 09:05');
  });

  it('pads the stamp', () => {
    expect(formatStamp(new Date(2026, 0, 2, 3, 4))).toBe('02/01/2026 03:04');
  });
});

describe('warningText', () => {
  it('joins the title and the message with a full stop, and is just the title with no message', () => {
    expect(warningText({ title: 'Tipping hazard', message: 'Check the rigging.' })).toBe('Tipping hazard. Check the rigging.');
    expect(warningText({ title: 'Tipping hazard', message: '' })).toBe('Tipping hazard');
  });
});

describe('cardContent', () => {
  const ctx: CardContext = { show: 'Main stage', venue: 'Grand Hall', status: 'issued', revision: 'B', zAxisZero: 'Arena floor' };
  const docA = newDoc(parseFixture('a'), 'a.pdf');
  const docB = newDoc(parseFixture('b'), 'b.pdf');
  const card = (doc: typeof docA, name: string, mirrors = false) => {
    const entry = sheetModel(doc, mirrors).entries.find((e) => e.column.name === name);
    if (!entry) throw new Error(name);
    return cardContent(entry, ctx);
  };

  it('a flown main array', () => {
    const c = card(docA, 'KARA II L Main');
    expect(c.title).toBe('KARA II L Main');
    expect(c.subtitle).toBe('MAINS · vertical, flown array');
    expect(c.context).toBe('Main stage · Grand Hall · Issued Rev B · Z-axis zero: Arena floor');
    expect(c.facts).toEqual([
      ['Total mass', '414.2 kg'], ['Front motor load', '414.2 kg'], ['Ground offset', '0 m'], ['Top height', '9.4 m'],
      ['Bottom height', '5.75 m'], ['Top site', '3.8°'], ['Bottom site', '-41.2°'], ['Azimuth', '0°'],
      ['Frame', 'M-BUMP+MBAR hole A'], ['Frame/Bar Hole', '6'], ['Position X, Y, Z', '10, 13.01, 9.4 m'],
    ]);
    expect(c.columns).toEqual(['#', 'Type', 'Panflex', 'Angle', 'Site']);
    expect(c.rows).toHaveLength(15);
    expect(c.rows[0]).toEqual(['1', 'KARA II', '70', '5', '3.8']);
    expect(c.rows[14]).toEqual(['15', 'KARA II', '90 On', '10', '-41.2']);
  });

  it('says it covers a mirror, and which array a shown mirror belongs to', () => {
    expect(card(docA, 'KARA II L Main').mirrorNote).toBe('Also mirrored with: KARA II R Main');
    expect(card(docA, 'KARA II R Main', true).mirrorNote).toBe('Also mirrored with: KARA II L Main');
    expect(card(docA, 'KARA II L Out', true).mirrorNote).toBeNull();
  });

  it('a two-motor array lists both loads and both pickups', () => {
    const c = card(docB, 'FL KARA II L');
    expect(c.facts.slice(0, 3)).toEqual([['Total mass', '235.4 kg'], ['Front motor load', '182.7 kg'], ['Rear motor load', '52.7 kg']]);
    expect(c.facts.find(([l]) => l === 'Pickups')?.[1]).toBe('Front 16, Rear 0');
  });

  it('leaves out the Angle and Panflex columns when the report has none, and carries warnings', () => {
    const c = card(docA, 'SB28 L Front');
    expect(c.columns).toEqual(['#', 'Type', 'Site']);
    expect(c.rows).toEqual([['1', 'SB28', '0']]);
    expect(c.warnings.map((w) => w.severity)).toEqual(['WARNING', 'CAUTION']);
    expect(c.facts.some(([l]) => l === 'Front motor load')).toBe(false);
  });

  it('shows a blank angle as a dash and keeps a stack in report order', () => {
    const c = card(docB, 'GS KARA II L');
    expect(c.rows.map((r) => r[0])).toEqual(['6', '5', '4', '3', '2', '1']);
    expect(c.rows[4]).toEqual(['2', 'SB18', '–', '–', '0']);
  });

  it('puts the show date, UK style, after the venue in the context, and nothing when there is none', () => {
    const entry = sheetModel(docA, false).entries[0]!;
    expect(cardContent(entry, { ...ctx, showDate: '2026-10-23' }).context).toBe('Main stage · Grand Hall · 23/10/2026 · Issued Rev B · Z-axis zero: Arena floor');
    expect(cardContent(entry, { ...ctx, showDate: '' }).context).toBe('Main stage · Grand Hall · Issued Rev B · Z-axis zero: Arena floor');
  });

  it('drops empty context parts', () => {
    const entry = sheetModel(docA, false).entries[0]!;
    expect(cardContent(entry, { show: '', venue: '', status: 'draft', revision: '', zAxisZero: '' }).context).toBe('Draft');
  });

  it('a bad offset shows dashes, not zero', () => {
    const doc = newDoc(parseFixture('a'), 'a.pdf');
    doc.job.defaultOffset = 'x';
    const c = cardContent(sheetModel(doc, false).entries[0]!, ctx);
    expect(c.facts.find(([l]) => l === 'Ground offset')?.[1]).toBe('–');
    expect(c.facts.find(([l]) => l === 'Top height')?.[1]).toBe('–');
  });
});
