import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { newDoc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { cardContent, type CardContext } from './card-content';
import { formatStamp, printFooter } from './footer';
import { CARDS_PER_PAGE, CELL_H_MM, FULL_H_MM, fitScale, MIN_FULL_SCALE, MIN_SCALE, PX_PER_MM, planPages } from './layout';

const px = (mm: number) => mm * PX_PER_MM;

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

  it('puts four cards on a page, in order', () => {
    const pages = planPages(cards(Array(9).fill(100)));
    expect(pages.map((p) => (p.kind === 'grid' ? p.cards.map((c) => c.item) : null))).toEqual([[0, 1, 2, 3], [4, 5, 6, 7], [8]]);
  });

  it('gives a card that is too tall for a panel a page of its own, keeping the order', () => {
    const pages = planPages(cards([100, 100, 300, 100, 100]));
    expect(pages.map((p) => (p.kind === 'grid' ? p.cards.map((c) => c.item) : `full ${p.item}`))).toEqual([[0, 1], 'full 2', [3, 4]]);
  });

  it('shrinks a tall card to its page, and flags one that cannot fit even there', () => {
    const [tall] = planPages(cards([300]));
    expect(tall).toMatchObject({ kind: 'full', overflow: false });
    expect(tall && tall.kind === 'full' && tall.scale).toBeLessThan(1);
    const [huge] = planPages(cards([FULL_H_MM / MIN_FULL_SCALE + 50]));
    expect(huge).toMatchObject({ kind: 'full', overflow: true, scale: MIN_FULL_SCALE });
  });

  it('shrinks a card that nearly fits instead of moving it', () => {
    const pages = planPages(cards([CELL_H_MM * 1.2]));
    expect(pages[0]?.kind).toBe('grid');
    expect(pages[0]?.kind === 'grid' && pages[0].cards[0]?.scale).toBeLessThan(1);
  });

  it('property: every card is placed once, in order, and no page holds more than four', () => {
    for (let n = 0; n < 30; n++) {
      const heights = Array.from({ length: n }, (_, i) => 40 + ((i * 37) % 260));
      const pages = planPages(cards(heights));
      const placed = pages.flatMap((p) => (p.kind === 'grid' ? p.cards.map((c) => c.item) : [p.item]));
      expect(placed).toEqual(heights.map((_, i) => i));
      for (const p of pages) if (p.kind === 'grid') expect(p.cards.length).toBeLessThanOrEqual(CARDS_PER_PAGE);
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
      ['Frame', 'M-BUMP+MBAR hole A'], ['Pickups', 'Front 6'], ['Position X, Y, Z', '10, 13.01, 9.4 m'],
    ]);
    expect(c.columns).toEqual(['#', 'Type', 'Panflex', 'Angle', 'Site']);
    expect(c.rows).toHaveLength(15);
    expect(c.rows[0]).toEqual(['1', 'KARA II', '70', '5', '3.8']);
    expect(c.rows[14]).toEqual(['15', 'KARA II', '90 On', '10', '-41.2']);
  });

  it('says it covers a mirror, and which array a shown mirror belongs to', () => {
    expect(card(docA, 'KARA II L Main').mirrorNote).toBe('MIRRORED: KARA II R Main');
    expect(card(docA, 'KARA II R Main', true).mirrorNote).toBe('MIRRORED: KARA II L Main');
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
