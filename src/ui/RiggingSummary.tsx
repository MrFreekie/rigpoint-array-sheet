import { EXTRA_TABLE_COLUMNS, edgeText, extraTableRows, extrasUsed, riggingEdgeNote, riggingNote, riggingWeightsNote, weightTableColumns, weightTableRows, type FixationRow, type RiggingRow, type RiggingWeight } from '../engine/sheet';
import { NOT_STATED, num } from './format';

export function RiggingSummary({ rows, weights = [], fixations = [] }: { rows: readonly RiggingRow[]; weights?: readonly RiggingWeight[]; fixations?: readonly FixationRow[] }) {
  const used = extrasUsed(rows);
  const note = riggingNote(rows.length > 0, fixations.length > 0);
  const edgeNote = riggingEdgeNote(rows.length > 0);
  return (
    <section className="panel" aria-labelledby="rigging-heading">
      <h2 id="rigging-heading">Rigging summary</h2>
      {note ? <p className="muted">{note}</p> : null}
      {edgeNote ? <p className="muted">{edgeNote}</p> : null}
      {rows.length === 0 ? (
        <p className="muted">No flown array in this report has a pickup position.</p>
      ) : (
        <div className="table-wrap" data-testid="rigging-pickups">
          <table>
            <caption>Rigging Points</caption>
            <thead>
              <tr>
                <th scope="col" className="n">Point</th>
                <th scope="col">Array</th>
                <th scope="col">Pickup</th>
                <th scope="col" className="n">Position no.</th>
                <th scope="col" className="n">X (m)</th>
                <th scope="col" className="n">Y (m)</th>
                <th scope="col" className="n">Z (m)</th>
                <th scope="col" className="n">Load (kg)</th>
                <th scope="col" className="n">To front (m)</th>
                <th scope="col" className="n">To rear (m)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="n">{r.point}</td>
                  <th scope="row">{r.source}</th>
                  <td>{r.location}</td>
                  <td className="n">{r.pickupPosition}</td>
                  <td className="n">{r.x}</td>
                  <td className="n">{r.y}</td>
                  <td className="n">{r.z}</td>
                  <td className="n">{num(r.load)}</td>
                  <td className="n">{edgeText(r, 'toFront', NOT_STATED)}</td>
                  <td className="n">{edgeText(r, 'toRear', NOT_STATED)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {used ? (
        <div className="table-wrap" data-testid="rigging-extra-weights">
          <table>
            <caption>Additional weight, typed in the app</caption>
            <thead>
              <tr>
                {EXTRA_TABLE_COLUMNS.map((h, i) => (
                  <th key={h} scope="col" className={i >= 2 ? 'n' : undefined}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {extraTableRows(rows, NOT_STATED).map((r, i) => (
                <tr key={i}>
                  <th scope="row">{r[0]}</th>
                  <td>{r[1]}</td>
                  {r.slice(2).map((v, k) => (
                    <td key={k} className="n">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {weights.length > 0 ? (
        <div className="table-wrap" data-testid="rigging-array-weights">
          <table>
            <caption>Array weights</caption>
            <thead>
              <tr>
                {weightTableColumns(used).map((h, i) => (
                  <th key={h} scope="col" className={i >= 1 ? 'n' : undefined}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weightTableRows(weights, used, NOT_STATED).map((r, i) => (
                <tr key={i}>
                  <th scope="row">{r[0]}</th>
                  {r.slice(1).map((v, k) => (
                    <td key={k} className="n">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">{riggingWeightsNote(used)}</p>
        </div>
      ) : null}
      {fixations.length > 0 ? (
        <div className="table-wrap" data-testid="rigging-fixations">
          <table>
            <caption className="visually-hidden">Fixation positions, as listed in the report</caption>
            <thead>
              <tr>
                <th scope="col">Array</th>
                <th scope="col">Fixation</th>
                <th scope="col" className="n">X (m)</th>
                <th scope="col" className="n">Y (m)</th>
                <th scope="col" className="n">Z (m)</th>
              </tr>
            </thead>
            <tbody>
              {fixations.map((f, i) => (
                <tr key={i}>
                  <th scope="row">{f.source}</th>
                  <td>{f.name}</td>
                  <td className="n">{f.x}</td>
                  <td className="n">{f.y}</td>
                  <td className="n">{f.z}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
