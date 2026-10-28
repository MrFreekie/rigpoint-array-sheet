import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { newDoc, withCartSizes, withDeleted, type Doc } from './document';
import { reportTypes, SettingsDialog } from './SettingsDialog';
import { sheetModel } from './sheet-model';

const noop = () => {};
const docOf = (name: 'a' | 'b' | 'c' | 'e'): Doc => newDoc(parseFixture(name), `${name}.pdf`);
const html = (d: Doc, locked = false, showMirrors = false) =>
  renderToStaticMarkup(
    <SettingsDialog doc={d} model={sheetModel(d, showMirrors)} locked={locked} onJob={noop} onCartSizes={noop} onSymbolValue={noop} onSymbolValuesReset={noop} showMirrors={showMirrors} onShowMirrors={noop} onClose={noop} />,
  );

describe('Settings', () => {
  it('has a section for the cards, the rigging plot and the display, and none for defaults', () => {
    const out = html(docOf('a'));
    for (const heading of ['Settings', 'Cards', 'Rigging plot', 'Display']) expect(out).toContain(`>${heading}</h`);
    expect(out).not.toContain('>Defaults</h');
  });

  it('holds the side labels tick, and no longer the venue, the Origin (P0) note or the ground offset', () => {
    const out = html(docOf('a'));
    expect(out).toContain('Show side labels on the rigging plot');
    expect(out).not.toContain('data-testid="venue-panel"');
    expect(out).not.toContain('Import venue');
    expect(out).not.toContain('Origin (P0)');
    expect(out).not.toContain('Ground offset for every array');
  });

  it('offers the mirrored arrays tick when the report has mirror images, and says so when it has none', () => {
    expect(html(docOf('a'))).toContain('Show the 9 mirrored arrays too (exact mirror images are hidden)');
    expect(html(docOf('a'), false, true)).toContain('checked=""');
    const d = newDoc({ ...parseFixture('a'), report: { ...parseFixture('a').report, sources: parseFixture('a').report.sources.slice(0, 1) } }, 'one.pdf');
    expect(html(d)).toContain('no exact mirror images');
  });

  it('lists one boxes per cart field for each type in the report, in report order, with the saved size', () => {
    const d = docOf('c');
    expect(reportTypes(sheetModel(d, false))).toEqual(['K1', 'KS28', 'KS28_C', 'K2', 'KARA II', 'A15 FOCUS', 'X15 HiQ']);
    const out = html(d);
    for (const t of ['K1', 'KS28', 'KS28_C', 'K2', 'KARA II', 'A15 FOCUS', 'X15 HiQ']) expect(out).toContain(`>${t}</label>`);
    expect(out).toMatch(/id="[^"]+"[^>]*value="4"/);
    expect(out).toContain('placeholder="one block"');
  });

  it('lists a saved type the report does not have, marked as not in this report', () => {
    const d = withCartSizes(docOf('a'), [{ type: 'K2', size: 4 }, { type: 'KARA II', size: 3 }]);
    const out = html(d);
    expect(out).toContain('not in this report');
    expect(out).toContain('>K2<');
  });

  it('leaves out a type whose only arrays are deleted', () => {
    let d = docOf('b');
    expect(reportTypes(sheetModel(d, false))).toContain('SB18');
    d.result.report.sources.forEach((s, i) => {
      if (s.cabinets.some((c) => c.type === 'SB18')) d = withDeleted(d, i, true);
    });
    expect(reportTypes(sheetModel(d, false))).not.toContain('SB18');
  });

  it('has a Symbols section with one field for each of the four shapes, holding the usual values', () => {
    const out = html(docOf('a'));
    expect(out).toContain('>Symbols</h4>');
    for (const [shape, value] of [['square with a cross', '2 t'], ['circle with a cross', '1 t'], ['triangle with a cross', '0.5 t'], ['diamond with a cross', '0.25 t']] as const) {
      expect(out).toContain(`Symbol, ${shape}`);
      expect(out).toContain(`value="${value}"`);
    }
    expect(out.match(/class="symbol-icon"/g)).toHaveLength(4);
    expect(out).toContain('maxLength="12"');
    expect(out).toContain('Reset the symbols to the usual values');
  });

  it('shows the values the person set, and not the usual ones', () => {
    const d = { ...docOf('a'), symbolValues: { two: '2.5 t', one: '1.5 t', half: '0.4 t', quarter: '0.2 t' } };
    const out = html(d);
    for (const v of ['2.5 t', '1.5 t', '0.4 t', '0.2 t']) expect(out).toContain(`value="${v}"`);
    expect(out).not.toContain('value="0.25 t"');
  });

  it('has a Reset to the usual sizes button', () => {
    expect(html(docOf('a'))).toContain('Reset to the usual sizes');
  });

  it('switches off every field and button that changes the file when the file is read-only', () => {
    const d = docOf('a');
    const fields = new Set([...reportTypes(sheetModel(d, false)), ...d.cartSizes.map((c) => c.type)].map((t) => t.toLowerCase())).size;
    const out = html(d, true);
    // The reset buttons for the cart sizes and the symbols are disabled too.
    const buttons = out.match(/<button[^>]*disabled=""[^>]*>[^<]*</g) ?? [];
    expect(buttons.map((b) => b.replace(/<[^>]*>/g, '').replace('<', ''))).toEqual(expect.arrayContaining(['Reset to the usual sizes']));
    const inputs = out.match(/<input[^>]*disabled=""/g) ?? [];
    // Every size field (the report's types and the saved ones), the four symbol fields and the side labels tick. The mirrors tick stays on: it is a view choice.
    expect(inputs.length).toBe(fields + 4 + 1);
    expect(out).not.toMatch(/<input type="checkbox"(?![^>]*disabled)[^>]*>(?=<span>Show side labels)/);
  });
});
