import type { RiggingRow } from '../engine/sheet';
import { num } from './format';

export function RiggingSummary({ rows }: { rows: readonly RiggingRow[] }) {
  return (
    <section className="panel" aria-labelledby="rigging-heading">
      <h2 id="rigging-heading">Rigging summary</h2>
      <p className="muted">Every pickup is listed, including those of mirrored arrays, because their positions differ.</p>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
