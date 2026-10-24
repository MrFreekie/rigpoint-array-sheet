import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ORIGIN_MAX } from '../schema/array-file';
import { parseFixture } from '../testing/fixtures';
import { newDoc, withCartSizes, withDeleted, type Doc } from './document';
import { reportTypes, SettingsDialog } from './SettingsDialog';
import { sheetModel } from './sheet-model';

const noop = () => {};
const docOf = (name: 'a' | 'b' | 'c' | 'e'): Doc => newDoc(parseFixture(name), `${name}.pdf`);
const html = (d: Doc, locked = false, showMirrors = false) =>
  renderToStaticMarkup(
    <SettingsDialog doc={d} model={sheetModel(d, showMirrors)} locked={locked} onJob={noop} onCartSizes={noop} onUnderlay={noop} onLayer={noop} showMirrors={showMirrors} onShowMirrors={noop} onClose={noop} />,
  );

describe('Settings', () => {
  it('has a section for the cards, the rigging plot, the defaults and the display', () => {
    const out = html(docOf('a'));
    for (const heading of ['Settings', 'Cards', 'Rigging plot', 'Defaults', 'Display']) expect(out).toContain(`>${heading}</h`);
  });

  it('holds the Origin (P0) note with its limit, the side labels tick and the venue box that used to sit in other places', () => {
    const d = docOf('a');
    d.job.origin = 'Iron Line';
    const out = html(d);
    expect(out).toContain('Origin (P0)');
    expect(out).toContain('value="Iron Line"');
    expect(out).toContain(`maxLength="${ORIGIN_MAX}"`);
    expect(out).toContain('Show side labels on the rigging plot');
    expect(out).toContain('data-testid="venue-panel"');
    expect(out).toContain('Import venue (SU4SV text file)');
  });

  it('holds the ground offset for every array, with its hint, and the typed value', () => {
    const d = docOf('a');
    d.job.defaultOffset = '0.3';
    const out = html(d);
    expect(out).toContain('Ground offset for every array (m)');
    expect(out).toContain('value="0.3"');
    expect(out).toContain('Taken off the report heights.');
    d.job.defaultOffset = 'x';
    expect(html(d)).toContain('Enter a number of metres, such as 0.3.');
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

  it('has a Reset to the usual sizes button', () => {
    expect(html(docOf('a'))).toContain('Reset to the usual sizes');
  });

  it('switches off every field and button that changes the file when the file is read-only', () => {
    const out = html(docOf('a'), true);
    // Venue import and replace, origin, side labels, ground offset, every size field and the reset button.
    const buttons = out.match(/<button[^>]*disabled=""[^>]*>[^<]*</g) ?? [];
    expect(buttons.map((b) => b.replace(/<[^>]*>/g, '').replace('<', ''))).toEqual(expect.arrayContaining(['Reset to the usual sizes', 'Import venue (SU4SV text file)']));
    const inputs = out.match(/<input[^>]*disabled=""/g) ?? [];
    expect(inputs.length).toBeGreaterThan(8);
    expect(out).not.toMatch(/<input type="checkbox"(?![^>]*disabled)[^>]*>(?=<span>Show side labels)/);
  });
});
