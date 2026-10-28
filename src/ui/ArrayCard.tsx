import { Fragment, useId } from 'react';
import { cartShade, groupsText } from '../engine/carts';
import type { FlySheetColumn } from '../engine/sheet';
import { cleanMarkerText, MARKER_TEXT_MAX, RATING_LABEL, SHAPE_NAME, SHAPES, type Marker, type MarkerPair, type PickupSide, type Shape } from '../engine/markers';
import { PATCH_COLOURS, PATCH_DIGITS, type PatchDigit, type PatchField, type PatchRow, type PatchValue } from '../engine/patch';
import { enclosureLabel } from '../engine/types';
import type { CartsOf } from '../files/doc';
import { FIXATION_COLUMNS, fixationName, frameFacts, warningText } from '../print/card-content';
import { NOTES_MAX, TITLE_MAX } from '../schema/array-file';
import { plain } from './plain';
import { degrees, kg, metres, NOT_STATED, num } from './format';

interface Props {
  column: FlySheetColumn;
  /** What the person typed for this array's own ground offset. */
  offsetText: string;
  offsetBad: boolean;
  /** True when this array uses the "every array" offset and that is not a number. */
  defaultBad: boolean;
  /** Whether this array is chosen for printing, and how to change that. */
  printed: boolean;
  onPrinted: (printed: boolean) => void;
  /** Whether this array is on the rigging plot, and how to change that. A card that stands for a mirror pair decides for both. */
  onPlot: boolean;
  onOnPlot: (on: boolean) => void;
  /** Saves this array as a PNG image. Not offered when the heights cannot be shown. */
  onImage?: (() => void) | undefined;
  /** True for a read-only file: the offset cannot be changed. */
  locked?: boolean | undefined;
  /** Set when this card stands for a pair: the name of the mirror image that is not shown separately. */
  coversMirror?: string | undefined;
  /** Set when this card is the mirror image of another array that is also shown. */
  mirrorOf?: string | undefined;
  onOffset: (text: string) => void;
  /** The title the person typed for this card, or blank to use the name in the report. */
  titleText: string;
  /** The name the report gives the array. */
  reportName: string;
  onTitle: (text: string) => void;
  /** What the person wrote for the crew. */
  note: string;
  onNote: (text: string) => void;
  /** The plot symbol of each pickup, and how to change one. A read-only file keeps a change for this session only. */
  markers: MarkerPair;
  onMarker: (side: PickupSide, marker: Marker) => void;
  /** The feeder and way of each enclosure row, and how to change one. Read-only files cannot change. */
  patch: PatchRow[];
  onPatch: (row: number, field: PatchField, value: PatchValue) => void;
  /** The carts of this array, and how to change them. A read-only file shows them but cannot change them. */
  carts: CartsOf;
  onCartBreak: (row: number) => void;
  onCartReset: () => void;
  /** Deletes this array. Not offered on a read-only file. */
  onDelete?: (() => void) | undefined;
  /** True when the offset in use comes from the "every array" field. */
  usingDefault: boolean;
}

export function ArrayCard({ column: c, offsetText, offsetBad, defaultBad, onOffset, usingDefault, coversMirror, mirrorOf, locked, onImage, printed, onPrinted, onPlot, onOnPlot, onDelete, titleText, reportName, onTitle, note, onNote, markers, onMarker, patch, onPatch, carts, onCartBreak, onCartReset }: Props) {
  const id = useId();
  const hasColumns = c.rows.some((r) => r.column !== null);
  const hasStackRows = c.rows.some((r) => r.row !== null);
  const hasAngles = c.rows.some((r) => r.angle !== null);
  const hasPanflex = c.rows.some((r) => r.panflexPrinted !== null);
  // Every other cart is banded on screen as it is shaded in print, counted from the top, the first one plain.
  const shade = cartShade(carts.breaks, c.rows.length);

  return (
    <article className="card" aria-labelledby={`${id}-name`}>
      <header className="card-head">
        <div className="card-title-row">
          <h3 id={`${id}-name`}>{c.name}</h3>
          {onImage ? (
            <button type="button" className="button" onClick={onImage} aria-label={`Save ${c.name} as an image`}>
              Save image
            </button>
          ) : null}
        </div>
        <p className="card-sub">
          {c.group ? <span className="chip">{c.group}</span> : null} {c.configuration ?? 'configuration not stated'}
        </p>
        {coversMirror || mirrorOf ? (
          <p className="mirror-note" data-testid="mirror-note">
            {`Also mirrored with: ${coversMirror ?? mirrorOf}`}
          </p>
        ) : null}
        {titleText.trim() !== '' ? (
          <p className="mirror-note" data-testid="report-name-note">
            {`Soundvision name: ${reportName}`}
          </p>
        ) : null}
      </header>

      <label className="check-field print-check">
        <input type="checkbox" checked={printed} onChange={(e) => onPrinted(e.target.checked)} />
        <span>Print this array</span>
      </label>
      <label className="check-field print-check">
        <input type="checkbox" checked={onPlot} onChange={(e) => onOnPlot(e.target.checked)} />
        <span>Include on rigging plot</span>
      </label>

      {c.warnings.length > 0 ? (
        <ul className="warnings" aria-label={`Soundvision warnings for ${c.name}`}>
          {c.warnings.map((w, i) => (
            <li key={i} className={w.severity === 'WARNING' ? 'warning-high' : 'warning-low'}>
              <span className="tag tag-warning">{w.severity}</span> {warningText(w)}
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="facts">
        <dt>Total mass</dt>
        <dd>{kg(c.totalMass)}</dd>
        {c.motors !== null ? (
          <>
            <dt>Front motor load</dt>
            <dd>{kg(c.frontMotorLoad)}</dd>
            {c.motors > 1 || c.rearMotorLoad !== null ? (
              <>
                <dt>Rear motor load</dt>
                <dd>{kg(c.rearMotorLoad)}</dd>
              </>
            ) : null}
          </>
        ) : null}
        <dt>Top height</dt>
        <dd data-testid="top-height">{metres(c.topHeight)}</dd>
        <dt>Bottom height</dt>
        <dd data-testid="bottom-height">{metres(c.bottomHeight)}</dd>
        <dt>Top site</dt>
        <dd>{degrees(c.topSite)}</dd>
        <dt>Azimuth</dt>
        <dd>{degrees(c.azimuth)}</dd>
        {frameFacts(c.bumper, c.pickups).map(([label, value]) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </Fragment>
        ))}
      </dl>

      {c.fixations.length > 0 ? (
        <div className="table-wrap fixations">
          <table className="card-table">
            <caption className="visually-hidden">Fixation positions of {c.name}, as listed in the report</caption>
            <thead>
              <tr>
                {FIXATION_COLUMNS.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.fixations.map((f, i) => (
                <tr key={i}>
                  <th scope="row" className="left" title={f.name}>
                    {fixationName(f.name)}
                  </th>
                  <td className="n">{f.at.x}</td>
                  <td className="n">{f.at.y}</td>
                  <td className="n">{f.at.z}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <label className="field title-field">
        <span>Card title</span>
        <input
          type="text"
          value={titleText}
          maxLength={TITLE_MAX}
          disabled={locked === true}
          // A title is one line of plain text. The file refuses control characters, so they are dropped as they are typed.
          onChange={(e) => onTitle(plain(e.target.value, false))}
          placeholder={reportName}
          autoComplete="off"
        />
      </label>

      <label className="field note-field">
        <span>Notes for the crew</span>
        <textarea
          value={note}
          maxLength={NOTES_MAX}
          rows={3}
          disabled={locked === true}
          // Line breaks stay; any other control character is dropped.
          onChange={(e) => onNote(plain(e.target.value, true))}
          aria-describedby={`${id}-note-count`}
        />
        <span id={`${id}-note-count`} className="muted">
          {note.length} of {NOTES_MAX} characters. Printed on the card.
        </span>
      </label>

      {c.pickups.map((p) => (
        <SymbolField
          key={p.which}
          label={c.pickups.length > 1 ? `Plot symbol, ${p.which} pickup` : 'Plot symbol'}
          marker={markers[p.which]}
          onChange={(m) => onMarker(p.which, m)}
        />
      ))}

      <label className="field offset-field">
        <span>Ground offset (m)</span>
        <input
          type="text"
          inputMode="decimal"
          value={offsetText}
          disabled={locked === true}
          onChange={(e) => onOffset(e.target.value)}
          placeholder={usingDefault ? 'same as all arrays' : '0'}
          aria-invalid={offsetBad}
          aria-describedby={offsetBad ? `${id}-offset-error` : undefined}
          autoComplete="off"
        />
        {offsetBad ? (
          <span id={`${id}-offset-error`} className="field-error">
            Enter a number of metres, such as 0.3. The heights are hidden until you do.
          </span>
        ) : null}
        {defaultBad ? (
          <span className="field-error">Heights are hidden: the ground offset for every array is not a number.</span>
        ) : null}
      </label>

      {onDelete ? (
        <p className="card-delete">
          <button type="button" className="button" onClick={onDelete} aria-label={`Delete ${c.name}`}>
            Delete array
          </button>
        </p>
      ) : null}

      {c.rows.length === 0 ? (
        <p className="muted">No enclosure table was found for this array.</p>
      ) : (
        <>
        <CartControls carts={carts} locked={locked === true} onReset={onCartReset} />
        <div className="table-wrap">
          <table className="card-table">
            <caption className="visually-hidden">Enclosures of {c.name}, as listed in the report</caption>
            <thead>
              <tr>
                <th scope="col" className="cart-strip">
                  <span className="visually-hidden">Cart break</span>
                </th>
                <th scope="col">{hasColumns ? 'Col #' : hasStackRows ? 'Row #' : '#'}</th>
                <th scope="col" className="left">Type</th>
                {hasPanflex ? <th scope="col">Panflex</th> : null}
                {hasAngles ? <th scope="col">Angle</th> : null}
                <th scope="col">Feeder</th>
                <th scope="col">Way</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r, n) => {
                const banded = shade[n] === true;
                const band = banded ? ' cart-band' : '';
                const starts = n > 0 && carts.breaks.includes(n);
                const forced = starts && carts.forced.includes(n);
                const previous = c.rows[n - 1];
                return (
                <tr key={enclosureLabel(r)} className={starts ? 'cart-start' : undefined} data-testid="enclosure-row">
                  <td className={`cart-strip${band}`}>
                    {n === 0 ? null : forced ? (
                      <span className="cart-forced" title="The type changes here, so a new cart starts">
                        <span className="visually-hidden">A new cart starts here, because the type changes</span>
                      </span>
                    ) : locked === true ? (
                      starts ? (
                        <span className="cart-forced">
                          <span className="visually-hidden">A new cart starts here</span>
                        </span>
                      ) : null
                    ) : (
                      <button
                        type="button"
                        className="cart-break"
                        aria-pressed={starts}
                        aria-label={`Cart break between enclosures ${previous ? enclosureLabel(previous) : ''} and ${enclosureLabel(r)}`}
                        onClick={() => onCartBreak(n)}
                      />
                    )}
                  </td>
                  <th scope="row" className={band.trim() || undefined}>{enclosureLabel(r)}</th>
                  <td className={`left${band}`}>{r.type}</td>
                  {hasPanflex ? (
                    <td className={`n${band}`} title={r.panflexPrinted ? `Report: ${r.panflexPrinted}` : undefined}>
                      {r.panflex ? r.panflex.text : r.panflexPrinted ?? NOT_STATED}
                      {r.panflex?.sideUnknown ? ' (side not known)' : ''}
                    </td>
                  ) : null}
                  {hasAngles ? <td className={`n${band}`}>{num(r.angle)}</td> : null}
                  {(['feeder', 'way'] as const).map((field) => (
                    <td key={field} className="patch-cell">
                      <PatchSelect
                        label={`${field === 'feeder' ? 'Feeder' : 'Way'}, enclosure ${enclosureLabel(r)} of ${c.name}`}
                        value={patch[n]?.[field] ?? ''}
                        disabled={locked === true}
                        onChange={(v) => onPatch(n, field, v)}
                      />
                    </td>
                  ))}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </article>
  );
}

/** The symbol of one pickup on the rigging plot: a shape, and optionally text such as 1.5 t shown in place of its rating. */
function SymbolField({ label, marker, onChange }: { label: string; marker: Marker; onChange: (m: Marker) => void }) {
  const id = useId();
  return (
    <fieldset className="field symbol-field">
      <legend>{label}</legend>
      <label htmlFor={`${id}-shape`} className="visually-hidden">
        {label}: shape
      </label>
      <select id={`${id}-shape`} value={marker.shape} onChange={(e) => onChange({ ...marker, shape: e.target.value as Shape })} aria-describedby={`${id}-help`}>
        {SHAPES.map((shape) => (
          <option key={shape} value={shape}>
            {`${RATING_LABEL[shape]}, ${SHAPE_NAME[shape]}`}
          </option>
        ))}
      </select>
      <label className="field">
        <span>Typed value, instead of the rating (optional)</span>
        <input type="text" value={marker.text} maxLength={MARKER_TEXT_MAX} placeholder="for example 1.5 t" autoComplete="off" onChange={(e) => onChange({ ...marker, text: cleanMarkerText(e.target.value) })} />
      </label>
      <span id={`${id}-help`} className="muted">
        A guide only. A symbol with typed text is grey on the plot.
      </span>
    </fieldset>
  );
}

/** One feeder or way: a dropdown of the digits 1 to 9 and 0, or blank, coloured as the printed chip is. */
function PatchSelect({ label, value, disabled, onChange }: { label: string; value: PatchValue; disabled: boolean; onChange: (v: PatchValue) => void }) {
  const colour = value === '' ? null : PATCH_COLOURS[value as PatchDigit];
  return (
    <select
      className="patch-select"
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as PatchValue)}
      style={colour ? { backgroundColor: colour.fill, color: colour.text, borderColor: colour.outline ?? colour.fill } : undefined}
      title={colour?.name}
    >
      <option value=""> </option>
      {PATCH_DIGITS.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  );
}

/** The carts of one array: what they are now, and a way back to automatic while they are set by hand. The sizes live in Settings. */
function CartControls({ carts, locked, onReset }: { carts: CartsOf; locked: boolean; onReset: () => void }) {
  return (
    <div className="carts-field" data-testid="carts">
      <p className="carts-summary" role="status" aria-live="polite" data-testid="carts-summary">
        {`Carts: ${groupsText(carts.groups)}, ${carts.manual ? 'set by hand' : 'automatic'}`}
      </p>
      {locked || !carts.manual ? null : (
        <button type="button" className="button" onClick={onReset}>
          Back to automatic
        </button>
      )}
    </div>
  );
}
