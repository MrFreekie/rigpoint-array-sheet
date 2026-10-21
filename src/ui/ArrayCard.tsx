import { useId } from 'react';
import type { FlySheetColumn } from '../engine/sheet';
import { degrees, kg, metres, NOT_STATED, num } from './format';

interface Props {
  column: FlySheetColumn;
  /** What the person typed for this array's own ground offset. */
  offsetText: string;
  offsetBad: boolean;
  /** True when this array uses the "every array" offset and that is not a number. */
  defaultBad: boolean;
  /** Set when this card stands for a pair: the name of the mirror image that is not shown separately. */
  coversMirror?: string | undefined;
  /** Set when this card is the mirror image of another array that is also shown. */
  mirrorOf?: string | undefined;
  onOffset: (text: string) => void;
  /** True when the offset in use comes from the "every array" field. */
  usingDefault: boolean;
}

export function ArrayCard({ column: c, offsetText, offsetBad, defaultBad, onOffset, usingDefault, coversMirror, mirrorOf }: Props) {
  const id = useId();
  const hasAngles = c.rows.some((r) => r.angle !== null);
  const hasPanflex = c.rows.some((r) => r.panflexPrinted !== null);
  const pickups =
    c.pickups.length === 0
      ? NOT_STATED
      : c.pickups.map((p) => `${p.which === 'front' ? 'Front' : 'Rear'} ${p.position}`).join(', ');

  return (
    <article className="card" aria-labelledby={`${id}-name`}>
      <header className="card-head">
        <h3 id={`${id}-name`}>{c.name}</h3>
        <p className="card-sub">
          {c.group ? <span className="chip">{c.group}</span> : null} {c.configuration ?? 'configuration not stated'}
        </p>
      </header>

      {coversMirror ? (
        <p className="mirror-note" data-testid="mirror-note">
          <span className="tag tag-mirror">MIRRORED</span> Also <strong>{coversMirror}</strong>, an exact left-right mirror of this array. It is
          not shown separately.
        </p>
      ) : null}
      {mirrorOf ? (
        <p className="mirror-note" data-testid="mirror-note">
          <span className="tag tag-mirror">MIRRORED</span> An exact left-right mirror of <strong>{mirrorOf}</strong>.
        </p>
      ) : null}

      {c.warnings.length > 0 ? (
        <ul className="warnings" aria-label={`Soundvision warnings for ${c.name}`}>
          {c.warnings.map((w, i) => (
            <li key={i} className={w.severity === 'WARNING' ? 'warning-high' : 'warning-low'}>
              <span className="tag tag-warning">{w.severity}</span> <strong>{w.title}</strong>
              {w.message ? <span> {w.message}</span> : null}
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
        <dt>Pickups</dt>
        <dd>{pickups}</dd>
        <dt>Position X, Y, Z</dt>
        <dd>{c.position ? `${c.position.x}, ${c.position.y}, ${c.position.z} m` : NOT_STATED}</dd>
      </dl>

      <label className="field offset-field">
        <span>Ground offset (m)</span>
        <input
          type="text"
          inputMode="decimal"
          value={offsetText}
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
                <th scope="col">#</th>
                <th scope="col">Type</th>
                {hasAngles ? <th scope="col">Angle</th> : null}
                <th scope="col">Site</th>
                {hasPanflex ? <th scope="col">Panflex</th> : null}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r) => (
                <tr key={r.number}>
                  <th scope="row">{r.number}</th>
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
