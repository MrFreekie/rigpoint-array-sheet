// The tuning sheet: what the report states for each array (delay, gain, Autofilter, LF Contour, zoom and the delay and gain of
// its groups), as a table to look at. An extra for the system tech, not part of the cards or the main PDF. It changes nothing
// in the file, so it opens the same on every status. The PDF and image buttons save this table on its own.

import type { Doc } from '../files/doc';
import { Dialog } from './Dialog';
import { hasTuning, noTuningNotice, tuningRows, TUNING_COLUMNS, TUNING_FOOTNOTE } from './tuning-rows';

interface Props {
  doc: Doc;
  locked: boolean;
  busy: boolean;
  onPdf: () => void;
  onImage: () => void;
  onClose: () => void;
}

export function TuningDialog({ doc, locked, busy, onPdf, onImage, onClose }: Props) {
  const has = hasTuning(doc);
  const rows = has ? tuningRows(doc) : [];
  return (
    <Dialog title="Tuning sheet" className="tuning-dialog" onClose={onClose}>
      {!has ? (
        <p>{noTuningNotice(locked)}</p>
      ) : (
        <>
          <div className="table-wrap tuning-wrap" data-testid="tuning-table">
            <table className="tuning-table">
              <thead>
                <tr>
                  {TUNING_COLUMNS.map((heading) => (
                    <th key={heading} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.index}>
                    {row.cells.map((cell, c) => {
                      const lines = cell.map((l, i) => (
                        <div key={i} className={l.small ? 'tuning-small' : undefined}>
                          {l.text}
                        </div>
                      ));
                      return c === 0 ? (
                        <th key={c} scope="row">
                          {lines}
                        </th>
                      ) : (
                        <td key={c}>{lines}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">{TUNING_FOOTNOTE}</p>
        </>
      )}
      <div className="dialog-actions">
        <button type="button" className="button" disabled={!has || busy} onClick={onPdf} title="Download the tuning sheet as a PDF. The main PDF does not hold it">
          Download PDF
        </button>
        <button type="button" className="button" disabled={!has || busy} onClick={onImage} title="Save the tuning sheet as an image">
          Save image
        </button>
        <button type="button" className="button primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
