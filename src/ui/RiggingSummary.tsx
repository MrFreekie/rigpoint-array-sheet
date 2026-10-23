import { edgeText, riggingEdgeNote, riggingNote, type FixationRow, type RiggingRow } from '../engine/sheet';
import { NOT_STATED, num } from './format';

export function RiggingSummary({ rows, fixations = [] }: { rows: readonly RiggingRow[]; fixations?: readonly FixationRow[] }) {
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
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">Pickup positions and motor loads, as listed in the report</caption>
            <thead>
              <tr>
                <th scope="col">Array</th>
                <th scope="col">Pickup</th>
                <th scope="col">Position no.</th>
                <th scope="col">X (m)</th>
                <th scope="col">Y (m)</th>
                <th scope="col">Z (m)</th>
                <th scope="col">Load (kg)</th>
                <th scope="col">To front (m)</th>
                <th scope="col">To rear (m)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
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
      {fixations.length > 0 ? (
        <div className="table-wrap" data-testid="rigging-fixations">
          <table>
            <caption className="visually-hidden">Fixation positions, as listed in the report</caption>
            <thead>
              <tr>
                <th scope="col">Array</th>
                <th scope="col">Fixation</th>
                <th scope="col">X (m)</th>
                <th scope="col">Y (m)</th>
                <th scope="col">Z (m)</th>
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
