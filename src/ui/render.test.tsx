// Renders components to HTML on the server and checks what a person would read.

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { flySheetColumn, riggingFixations, riggingNote, riggingRows } from '../engine/sheet';
import type { Problem } from '../engine/types';
import { parseFixture } from '../testing/fixtures';
import { App } from './App';
import { ArrayCard } from './ArrayCard';
import { ProblemsPanel } from './ProblemsPanel';
import { PlotSvg } from '../print/PlotSvg';
import { plotContent } from '../print/plot-input';
import { layoutPlotPages, PRINT_PALETTE, SCREEN_PALETTE } from '../print/plot-layout';
import { estimateWidth } from '../print/array-image';
import { RiggingPlotPreview, PLOT_DEVELOPMENT_NOTE } from './RiggingPlotPreview';
import { ORIGIN_MAX } from '../schema/array-file';
import { newDoc, withOnPlot, type Doc } from './document';
import { sheetModel } from './sheet-model';
import { RiggingSummary } from './RiggingSummary';

const a = parseFixture('a').report.sources;
const b = parseFixture('b').report.sources;
const byName = (list: typeof a, name: string) => list.find((s) => s.name === name)!;

const card = (name: string, list = a, extra: Partial<Parameters<typeof ArrayCard>[0]> = {}) =>
  renderToStaticMarkup(
    <ArrayCard column={flySheetColumn(byName(list, name))} offsetText="" offsetBad={false} defaultBad={false} usingDefault onOffset={() => {}} titleText="" reportName={name} onTitle={() => {}} note="" onNote={() => {}} printed onPrinted={() => {}} onPlot onOnPlot={() => {}} markers={{ front: { shape: 'one' }, rear: { shape: 'one' } }} onMarker={() => {}} symbolValues={{ two: '2 t', one: '1 t', half: '0.5 t', quarter: '0.25 t' }} patch={[]} onPatch={() => {}} carts={{ breaks: [], manual: false, groups: [flySheetColumn(byName(list, name)).rows.length], forced: [] }} onCartBreak={() => {}} onCartReset={() => {}} {...extra} />,
  );

describe('ArrayCard', () => {
  it('labels the rows of a stack laid out in columns', () => {
    const html = card('SB28 L', parseFixture('d').report.sources);
    expect(html).toContain('Col #');
    expect(html).toContain('C1 #1');
    expect(html).toContain('C2 #1');
  });

  it('shows the fixations of a stacked array as the report prints them, under the facts', () => {
    const html = card('KARA II 2', parseFixture('e').report.sources);
    expect(html).toContain('Fixation positions of KARA II 2');
    for (const text of ['Fixations', 'X (m)', 'Y (m)', 'Z (m)', 'Fr', 'Fl', 'Rr', 'Rl', '-2.84', '-2.16', '4.6', '3.9']) expect(html).toContain(text);
    expect(html.indexOf('Azimuth')).toBeLessThan(html.indexOf('Fixations'));
    expect(card('KS28 4', parseFixture('e').report.sources)).not.toContain('Fixations');
    expect(card('KARA II L Main')).not.toContain('Fixations');
  });

  it('draws fixations that share a name, and cuts a very long name', () => {
    const sources = structuredClone(parseFixture('e').report.sources);
    const fill = sources.find((s) => s.name === 'KARA II 2')!;
    fill.fixations = [
      { name: 'Fr', at: { x: 1, y: 2, z: 3 } },
      { name: 'Fr', at: { x: 4, y: 5, z: 6 } },
      { name: 'F'.repeat(60), at: { x: 7, y: 8, z: 9 } },
    ];
    const html = card('KARA II 2', sources);
    expect(html.match(/<th scope="row" class="left" title=/g)).toHaveLength(3);
    expect(html).toContain(`>${'F'.repeat(11)}…</th>`);
  });

  it('shows a flown array as the report states it', () => {
    const html = card('KARA II L Main');
    expect(html).toContain('KARA II L Main');
    expect(html).toContain('MAINS');
    expect(html).toContain('414.2 kg');
    expect(html).toContain('M-BUMP+MBAR hole A / 6');
    expect(html).toContain('Frame/Bar Hole');
    expect(html).not.toContain('Front 6');
    expect(html).toContain('90 On');
    expect(html).not.toContain('Rear motor load');
  });

  it('shows both motor loads for a two-motor array', () => {
    const html = card('FL KARA II L', b);
    expect(html).toContain('182.7 kg');
    expect(html).toContain('52.7 kg');
    expect(html).toContain('Front 16, Rear 0');
  });

  it('puts a word on every Soundvision warning', () => {
    const html = card('SB28 L Front');
    expect(html).toContain('WARNING');
    expect(html).toContain('CAUTION');
    expect(html).toContain('Tipping hazard');
    expect(html).toContain('L-Acoustics recommends securing the array to the ground.');
  });

  it('leaves out the Angle and Panflex columns when the report has none', () => {
    const html = card('X8 2');
    expect(html).not.toContain('>Angle<');
    expect(html).not.toContain('>Panflex<');
  });

  it('lists a stack in report order, top first', () => {
    const html = card('GS KARA II L', b);
    expect(html.indexOf('<th scope="row">6</th>')).toBeLessThan(html.indexOf('<th scope="row">1</th>'));
  });

  it('explains a bad own offset, and a bad shared offset', () => {
    expect(card('X8 2', a, { offsetText: 'x', offsetBad: true })).toContain('The heights are hidden until you do');
    expect(card('X8 2', a, { defaultBad: true })).toContain('the ground offset for every array is not a number');
    expect(card('X8 2')).not.toContain('field-error');
  });

  it('says Also mirrored with and the name of the other array, and nothing else', () => {
    const covers = card('KARA II L Main', a, { coversMirror: 'KARA II R Main' });
    expect(covers).toContain('Also mirrored with: KARA II R Main');
    expect(covers).not.toContain('exact left-right');
    expect(covers).not.toContain('not shown separately');
    const mirror = card('KARA II R Main', a, { mirrorOf: 'KARA II L Main' });
    expect(mirror).toContain('Also mirrored with: KARA II L Main');
    expect(mirror).not.toContain('tag-mirror');
    expect(mirror).not.toContain('exact left-right');
    expect(card('KARA II L Main')).not.toContain('Also mirrored');
  });

  it('has a print checkbox, ticked when the array is chosen', () => {
    expect(card('X8 2')).toMatch(/<input type="checkbox" checked=""[^>]*\/><span>Print this array<\/span>/);
    const off = card('X8 2', a, { printed: false });
    expect(off).toContain('Print this array');
    expect(off).not.toMatch(/checked=""[^>]*\/><span>Print this array/);
  });

  it('has an Include on rigging plot checkbox beside it, ticked unless the array is left off', () => {
    expect(card('X8 2')).toMatch(/<input type="checkbox" checked=""[^>]*\/><span>Include on rigging plot<\/span>/);
    const off = card('X8 2', a, { onPlot: false });
    expect(off).toContain('Include on rigging plot');
    expect(off).not.toMatch(/checked=""[^>]*\/><span>Include on rigging plot/);
  });

  it('labels the offset field', () => {
    expect(card('X8 2')).toContain('Ground offset (m)');
  });
});

describe('ProblemsPanel', () => {
  it('says READ OK in words when nothing was found', () => {
    const html = renderToStaticMarkup(<ProblemsPanel problems={[]} ok />);
    expect(html).toContain('READ OK');
    expect(html).toContain('This does not check the design');
  });

  it('lists checks with the array name and the word CHECK', () => {
    const problems: Problem[] = [{ level: 'check', source: 'KARA II L Main', message: 'A line was not understood.' }];
    const html = renderToStaticMarkup(<ProblemsPanel problems={problems} ok />);
    expect(html).toContain('1 thing to check against the PDF');
    expect(html).toContain('CHECK');
    expect(html).toContain('KARA II L Main: ');
    expect(html).toContain('role="status"');
  });

  it('is an alert and says the sheet is not shown when there is an error', () => {
    const problems: Problem[] = [
      { level: 'check', source: null, message: 'Minor.' },
      { level: 'error', source: null, message: 'Units are wrong.' },
    ];
    const html = renderToStaticMarkup(<ProblemsPanel problems={problems} ok={false} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('This report cannot be relied on');
    expect(html).toContain('The sheet is not shown');
    expect(html.indexOf('ERROR')).toBeLessThan(html.indexOf('CHECK'));
  });
});

describe('RiggingSummary', () => {
  it('lists each pickup with its position and load', () => {
    const html = renderToStaticMarkup(<RiggingSummary rows={riggingRows(b)} />);
    expect(html).toContain('FL KARA II L');
    expect(html).toContain('>Front<');
    expect(html).toContain('>Rear<');
    expect(html).toContain('182.7');
    expect(html).toContain('3.08');
  });

  it('shows the notes for the show above the tables, and nothing when there are none', () => {
    const withNotes = renderToStaticMarkup(<RiggingSummary rows={riggingRows(b)} notes={'Load in at 08:00.\nCall Sam first.'} />);
    expect(withNotes).toContain('data-testid="show-notes"');
    expect(withNotes).toContain('Load in at 08:00.');
    expect(withNotes.indexOf('show-notes')).toBeLessThan(withNotes.indexOf('<table'));
    const without = renderToStaticMarkup(<RiggingSummary rows={riggingRows(b)} />);
    expect(without).not.toContain('show-notes');
    expect(renderToStaticMarkup(<RiggingSummary rows={riggingRows(b)} notes="" />)).not.toContain('Notes:');
  });

  it('names only pickups in its line when the report states no fixations, and shows no fixation table', () => {
    const html = renderToStaticMarkup(<RiggingSummary rows={riggingRows(b)} fixations={riggingFixations(b)} />);
    expect(html).toContain(riggingNote(true, false));
    expect(html).not.toContain('rigging-fixations');
  });

  it('lists the fixations of report E under the pickups, with the line that covers both', () => {
    const e = parseFixture('e').report.sources;
    const html = renderToStaticMarkup(<RiggingSummary rows={riggingRows(e)} fixations={riggingFixations(e)} />);
    expect(html).toContain('Every pickup and fixation is listed, including those of mirrored arrays, because their positions differ.');
    expect(html).toContain('rigging-fixations');
    expect(html).toContain('>Fixation<');
    expect(html).toContain('<td>Fr</td><td class="n">-2.84</td><td class="n">4.6</td><td class="n">1</td>');
    expect(html.match(/<td>Fr<\/td>/g)).toHaveLength(riggingFixations(e).filter((f) => f.name === 'Fr').length);
    expect(html.indexOf('Pickup positions')).toBeLessThan(html.indexOf('Fixation positions'));
  });

  it('says so when there is nothing to list', () => {
    expect(renderToStaticMarkup(<RiggingSummary rows={[]} />)).toContain('No flown array in this report has a pickup position');
  });
});

describe('App', () => {
  it('starts on the open-a-report screen and promises nothing it does not do', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Open a Soundvision report');
    expect(html).toContain('does not calculate loads or check that a rig is safe');
    expect(html).toContain('Nothing is uploaded');
  });
});

describe('rigging plot', () => {
  const doc = newDoc(parseFixture('c'), 'c.pdf');
  const page = layoutPlotPages({ ...plotContent(doc, sheetModel(doc, false))!, footer: () => 'footer' }, estimateWidth)[0]!;

  it('draws the page as plain SVG, with the screen colours on screen and a quarter turn in print', () => {
    const screen = renderToStaticMarkup(<PlotSvg page={page} palette={SCREEN_PALETTE} />);
    expect(screen).toContain('viewBox="0 0 284 198"');
    expect(screen).toContain('stroke="#d00000"');
    expect(screen).not.toContain('foreignObject');
    const print = renderToStaticMarkup(<PlotSvg page={page} palette={PRINT_PALETTE} rotated />);
    expect(print).toContain('viewBox="0 0 198 284"');
    expect(print).toContain('matrix(0 -1 1 0 0 284)');
    expect(print).not.toContain('#d00000');
    expect(print).not.toContain('#0a8a0a');
  });

  it('shows the under development note above the plot', () => {
    const html = renderToStaticMarkup(<RiggingPlotPreview doc={doc} model={sheetModel(doc, false)} locked={false} onJob={() => {}} onPlotPrinted={() => {}} onUnderlay={() => {}} onLayer={() => {}} />);
    expect(html).toContain(PLOT_DEVELOPMENT_NOTE);
    expect(html).toContain('data-testid="plot-svg"');
  });
});

describe('the controls under the rigging plot', () => {
  const preview = (d: Doc, locked = false) =>
    renderToStaticMarkup(<RiggingPlotPreview doc={d} model={sheetModel(d, false)} locked={locked} onJob={() => {}} onPlotPrinted={() => {}} onUnderlay={() => {}} onLayer={() => {}} />);

  it('hold the Origin (P0) note with its limit', () => {
    const d = newDoc(parseFixture('a'), 'a.pdf');
    d.job.origin = 'Iron Line';
    const out = preview(d);
    expect(out).toContain('data-testid="plot-controls"');
    expect(out).toContain('Origin (P0)');
    expect(out).toContain('value="Iron Line"');
    expect(out).toContain(`maxLength="${ORIGIN_MAX}"`);
  });

  it('hold the ground offset for every array, with its hint, and the typed value', () => {
    const d = newDoc(parseFixture('a'), 'a.pdf');
    d.job.defaultOffset = '0.3';
    const out = preview(d);
    expect(out).toContain('Ground offset for every array (m)');
    expect(out).toContain('value="0.3"');
    expect(out).toContain('Taken off the report heights.');
    d.job.defaultOffset = 'x';
    expect(preview(d)).toContain('Enter a number of metres, such as 0.3.');
  });

  it('hold a Venue button that opens the venue box, and say what is on', () => {
    const d = newDoc(parseFixture('a'), 'a.pdf');
    const out = preview(d);
    expect(out).toContain('data-testid="venue-button"');
    expect(out).toMatch(/data-testid="venue-button"[^>]*>Venue</);
    expect(out).toContain('The side labels are in Settings.');
    expect(out).not.toContain('and the venue under the plot are in Settings');
  });

  it('switch the two fields off on a read-only file, and keep Print rigging plot and Download DXF with them', () => {
    const d = newDoc(parseFixture('a'), 'a.pdf');
    const open = preview(d);
    expect(open).not.toMatch(/disabled=""[^>]*placeholder="e\.g\. DSE/);
    const out = preview(d, true);
    expect(out).toMatch(/<input[^>]*disabled=""[^>]*placeholder="e\.g\. DSE/);
    expect(out).toContain('Print rigging plot');
    expect(out).toContain('Download DXF');
  });

  it('are still there, with Print rigging plot switched off, when no array is on the plot', () => {
    let d = newDoc(parseFixture('a'), 'a.pdf');
    d.result.report.sources.forEach((_, i) => (d = withOnPlot(d, i, false)));
    const out = renderToStaticMarkup(<RiggingPlotPreview doc={d} model={sheetModel(d, true)} locked={false} onJob={() => {}} onPlotPrinted={() => {}} onUnderlay={() => {}} onLayer={() => {}} />);
    expect(out).toContain('No array is on the plot');
    expect(out).toContain('Origin (P0)');
    expect(out).toContain('Ground offset for every array (m)');
    expect(out).toMatch(/disabled=""[^>]*\/><span>Print rigging plot/);
    expect(out).not.toContain('Download DXF');
  });
});

describe('ArrayCard delete button', () => {
  it('is there when the file can be changed, and named for its array', () => {
    const html = card('KARA II L Main', a, { onDelete: () => {} });
    expect(html).toContain('Delete array');
    expect(html).toContain('aria-label="Delete KARA II L Main"');
  });

  it('is not offered on a read-only file', () => {
    expect(card('KARA II L Main', a, { locked: true })).not.toContain('Delete array');
  });
});

describe('ArrayCard title and notes', () => {
  it('has a card title field with the report name as its placeholder, and a notes box with a count', () => {
    const html = card('KARA II L Main', a, { note: 'Hang at 2 m' });
    expect(html).toContain('Card title');
    expect(html).toContain('placeholder="KARA II L Main"');
    expect(html).toContain('maxLength="60"');
    expect(html).toContain('Notes for the crew');
    expect(html).toContain('maxLength="300"');
    expect(html).toContain('11 of 300 characters');
    expect(html).not.toContain('Soundvision name:');
  });

  it('says what Soundvision calls an array once it has a title of its own', () => {
    const html = card('KARA II L Main', a, { titleText: 'Main left', reportName: 'KARA II L Main' });
    expect(html).toContain('Soundvision name: KARA II L Main');
  });

  it('disables both fields on a read-only file', () => {
    const open = card('KARA II L Main', a);
    const locked = card('KARA II L Main', a, { locked: true });
    // The symbol picker may disable a shape; the text fields and the title and note boxes are free on an open file.
    expect(open.match(/<(input|textarea)[^>]*disabled/g)).toBeNull();
    expect(locked.match(/disabled=""/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});

describe('ArrayCard plot symbol picker', () => {
  const c = parseFixture('c').report.sources;
  const heavy = c.find((s) => s.pickups.length === 2 && (s.weights.total ?? 0) > 1000)!;
  const pick = (extra: Partial<Parameters<typeof ArrayCard>[0]> = {}) => card(heavy.name, c, extra);
  const options = (html: string) => [...html.matchAll(/<option value="(\w+)"( disabled="")?( selected="")?[^>]*>([^<]*)</g)].map((m) => ({ value: m[1]!, disabled: !!m[2], text: m[4]! }));

  it('has one picker for a single pickup and one for each of a pair', () => {
    const html = pick();
    expect(html).toContain('Plot symbol, front pickup');
    expect(html).toContain('Plot symbol, rear pickup');
    const single = c.find((s) => s.pickups.length === 1)!;
    const one = card(single.name, c);
    expect(one).toContain('Plot symbol');
    expect(one).not.toContain('Plot symbol, ');
    const stack = card('KS28 4', parseFixture('e').report.sources);
    expect(stack).not.toContain('Plot symbol');
  });

  it('offers the four shapes with their ratings, all of them always, whatever the weight of the array', () => {
    const first = options(pick()).slice(0, 4);
    expect(first.map((o) => o.value)).toEqual(['two', 'one', 'half', 'quarter']);
    expect(first.map((o) => o.disabled)).toEqual([false, false, false, false]);
    expect(first[0]!.text).toContain('2 t, square with a cross');
    expect(first[1]!.text).toContain('1 t, circle with a cross');
    expect(first[1]!.text).not.toContain('below the total weight');
  });

  it('has no field for a typed value on the card, and names each shape with the value set in Settings', () => {
    const html = pick();
    expect(html).not.toContain('Typed value');
    expect(html).not.toContain('typed text');
    expect(html).not.toContain('stated total weight');
    const set = pick({ symbolValues: { two: '2.5 t', one: '1.5 t', half: '0.4 t', quarter: '0.2 t' } });
    const named = options(set).slice(0, 4);
    expect(named.map((o) => o.text)).toEqual(['2.5 t, square with a cross', '1.5 t, circle with a cross', '0.4 t, triangle with a cross', '0.2 t, diamond with a cross']);
    expect(named.map((o) => o.disabled)).toEqual([false, false, false, false]);
  });

  it('can still be changed on a read-only file, for this session', () => {
    const locked = pick({ locked: true });
    expect(locked.match(/<select(?![^>]*patch-select)[^>]*disabled/g)).toBeNull();
  });
});

describe('ArrayCard cable patch', () => {
  const rows = byName(a, 'KARA II L Main').cabinets.length;
  const patch = Array.from({ length: rows }, (_, i) => (i === 1 ? { feeder: '1' as const, way: '4' as const } : { feeder: '' as const, way: '' as const }));

  it('has a Feeder and a Way dropdown for every enclosure row, after Panflex, offering 1 to 9, then 0, then blank', () => {
    const html = card('KARA II L Main', a);
    expect(html.match(/<select class="patch-select"/g)).toHaveLength(2 * rows);
    expect(html.indexOf('>Panflex</th>')).toBeLessThan(html.indexOf('>Feeder</th>'));
    expect(html.indexOf('>Feeder</th>')).toBeLessThan(html.indexOf('>Way</th>'));
    expect(html).toContain('aria-label="Feeder, enclosure 2 of KARA II L Main"');
    expect(html).toContain('aria-label="Way, enclosure 2 of KARA II L Main"');
    const start = html.indexOf('<select class="patch-select"');
    const first = html.slice(start, html.indexOf('</select>', start));
    expect([...first.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1])).toEqual(['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
  });

  it('shows the chosen digit on its colour chip', () => {
    const html = card('KARA II L Main', a, { patch });
    expect(html).toContain('background-color:#3f1d08');
    expect(html).toContain('background-color:#fff040');
    expect(html).not.toContain('background-color:#ec4444');
  });

  it('is disabled on a read-only file', () => {
    const locked = card('KARA II L Main', a, { locked: true });
    expect(locked.match(/<select class="patch-select"[^>]*disabled/g)).toHaveLength(2 * rows);
    expect(card('KARA II L Main', a).match(/<select class="patch-select"[^>]*disabled/g)).toBeNull();
  });

  it('centres every column of the enclosure table except Type', () => {
    const html = card('KARA II L Main', a);
    expect(html).toContain('<table class="card-table">');
    expect(html).toContain('<th scope="col" class="left">Type</th>');
  });
});

describe('ArrayCard carts', () => {
  const column = flySheetColumn(byName(a, 'KARA II L Main'));
  const carts = { breaks: [3, 6, 9, 12], manual: false, groups: [3, 3, 3, 3, 3], forced: [] as number[] };

  it('says what the carts are, and whether they are automatic or set by hand, in a live region', () => {
    const html = card('KARA II L Main', a, { carts });
    expect(html).toContain('Carts: 3 + 3 + 3 + 3 + 3, automatic');
    expect(html).toContain('aria-live="polite"');
    expect(card('KARA II L Main', a, { carts: { ...carts, manual: true } })).toContain('Carts: 3 + 3 + 3 + 3 + 3, set by hand');
    expect(card('SB28 L Front', a)).toContain('Carts: 1, one block, automatic');
  });

  it('offers a way back to automatic only while the carts are set by hand, and no size buttons', () => {
    const auto = card('KARA II L Main', a, { carts });
    expect(auto).not.toContain('Back to automatic');
    expect(auto).not.toContain('into carts of');
    expect(auto).not.toContain('Custom cart size');
    expect(auto).not.toContain('Reset to automatic');
    expect(card('KARA II L Main', a, { carts: { ...carts, manual: true } })).toContain('Back to automatic');
  });

  it('has a break button between every pair of rows, pressed where a cart starts, and none above the first row', () => {
    const html = card('KARA II L Main', a, { carts });
    const buttons = html.match(/<button type="button" class="cart-break"[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(column.rows.length - 1);
    expect(buttons.filter((b) => b.includes('aria-pressed="true"'))).toHaveLength(4);
    expect(html).toContain('aria-label="Cart break between enclosures 3 and 4"');
    expect(html).not.toContain('aria-label="Cart break between enclosures  and 1"');
  });

  it('shows no break button where the type changes, only a fixed line', () => {
    const html = card('GS KARA II L', b, { carts: { breaks: [4], manual: false, groups: [4, 2], forced: [4] } });
    expect(html).toContain('The type changes here, so a new cart starts');
    expect(html).not.toContain('aria-label="Cart break between enclosures 4 and 5"');
  });

  it('bands every other cart, and leaves the Feeder and Way cells unbanded', () => {
    const html = card('KARA II L Main', a, { carts });
    expect(html.match(/cart-band/g)?.length).toBeGreaterThan(0);
    const banded = html.match(/<td class="patch-cell cart-band/g);
    expect(banded).toBeNull();
    expect(html).toContain('<tr class="cart-start" data-testid="enclosure-row">');
  });

  it('shows the carts but no buttons on a read-only file', () => {
    const html = card('KARA II L Main', a, { carts, locked: true });
    expect(html).toContain('Carts: 3 + 3 + 3 + 3 + 3, automatic');
    expect(html).not.toContain('class="cart-break"');
    expect(html).not.toContain('Back to automatic');
    expect(html).not.toContain('into carts of');
    expect(html).toContain('A new cart starts here');
  });
});
