import { useId } from 'react';
import type { FlySheetColumn } from '../engine/sheet';
import { enclosureLabel } from '../engine/types';
import { FIXATION_COLUMNS, fixationName, pickupFact, warningText } from '../print/card-content';
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
  /** Saves this array as a PNG image. Not offered when the heights cannot be shown. */
  onImage?: (() => void) | undefined;
  /** True for a read-only file: the offset cannot be changed. */
  locked?: boolean | undefined;
  /** Set when this card stands for a pair: the name of the mirror image that is not shown separately. */
  coversMirror?: string | undefined;
  /** Set when this card is the mirror image of another array that is also shown. */
  mirrorOf?: string | undefined;
  onOffset: (text: string) => void;
  /** True when the offset in use comes from the "every array" field. */
  usingDefault: boolean;
}

export function ArrayCard({ column: c, offsetText, offsetBad, defaultBad, onOffset, usingDefault, coversMirror, mirrorOf, locked, onImage, printed, onPrinted }: Props) {
  const id = useId();
  const hasColumns = c.rows.some((r) => r.column !== null);
  const hasAngles = c.rows.some((r) => r.angle !== null);
  const hasPanflex = c.rows.some((r) => r.panflexPrinted !== null);
  const [pickupLabel, pickups] = pickupFact(c.pickups);

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
      </header>

      <label className="check-field print-check">
        <input type="checkbox" checked={printed} onChange={(e) => onPrinted(e.target.checked)} />
        <span>Print this array</span>
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
        <dt>Bottom site</dt>
        <dd>{degrees(c.bottomSite)}</dd>
        <dt>Azimuth</dt>
        <dd>{degrees(c.azimuth)}</dd>
        <dt>Frame</dt>
        <dd>{c.bumper ?? NOT_STATED}</dd>
        <dt>{pickupLabel}</dt>
        <dd>{pickups}</dd>
        <dt>Position X, Y, Z</dt>
        <dd>{c.position ? `${c.position.x}, ${c.position.y}, ${c.position.z} m` : NOT_STATED}</dd>
      </dl>

      {c.fixations.length > 0 ? (
        <div className="table-wrap fixations">
          <table>
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
                  <th scope="row" title={f.name}>
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

      {c.rows.length === 0 ? (
        <p className="muted">No enclosure table was found for this array.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">Enclosures of {c.name}, as listed in the report</caption>
            <thead>
              <tr>
                <th scope="col">{hasColumns ? 'Col #' : '#'}</th>
                <th scope="col">Type</th>
                {hasAngles ? <th scope="col">Angle</th> : null}
                <th scope="col">Site</th>
                {hasPanflex ? <th scope="col">Panflex</th> : null}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r) => (
                <tr key={enclosureLabel(r)}>
                  <th scope="row">{enclosureLabel(r)}</th>
                  <td>{r.type}</td>
                  {hasAngles ? <td className="n">{num(r.angle)}</td> : null}
                  <td className="n">{num(r.site)}</td>
                  {hasPanflex ? (
                    <td className="n" title={r.panflexPrinted ? `Report: ${r.panflexPrinted}` : undefined}>
                      {r.panflex ? r.panflex.text : r.panflexPrinted ?? NOT_STATED}
                      {r.panflex?.sideUnknown ? ' (side not known)' : ''}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
