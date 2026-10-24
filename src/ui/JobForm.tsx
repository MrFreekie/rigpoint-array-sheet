import { cleanRevision } from '../files/revision';
import { SHOW_NOTES_MAX } from '../schema/array-file';
import { STATUS_LABELS, STATUSES, type Doc, type Job, type Status } from './document';
import { plain } from './plain';

interface Props {
  doc: Doc;
  locked: boolean;
  onJob: (patch: Partial<Job>) => void;
  onStatus: (status: Status) => void;
  onRevision: (revision: string) => void;
}

/** The details a printed fly sheet carries that the PDF does not hold. */
export function JobForm({ doc, locked, onJob, onStatus, onRevision }: Props) {
  return (
    <section className="panel" aria-labelledby="job-heading">
      <h2 id="job-heading">Show details</h2>
      <div className="form-grid">
        <label className="field">
          <span>Show</span>
          <input type="text" value={doc.job.show} disabled={locked} onChange={(e) => onJob({ show: e.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span>Venue</span>
          <input type="text" value={doc.job.venue} disabled={locked} onChange={(e) => onJob({ venue: e.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span>Show date</span>
          <input type="date" value={doc.job.showDate} disabled={locked} onChange={(e) => onJob({ showDate: e.target.value })} />
          <span className="field-hint">Optional. Printed as day, month, year with the show details.</span>
        </label>
        <label className="field">
          <span>System engineer</span>
          <input type="text" value={doc.job.engineer} disabled={locked} onChange={(e) => onJob({ engineer: e.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span>Company</span>
          <input type="text" value={doc.job.company} disabled={locked} onChange={(e) => onJob({ company: e.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span>Z-axis zero</span>
          <input
            type="text"
            value={doc.job.zAxisZero}
            disabled={locked}
            onChange={(e) => onJob({ zAxisZero: e.target.value })}
            placeholder="e.g. Arena floor"
            autoComplete="off"
          />
        </label>
        <label className="field note-field">
          <span>Notes</span>
          <textarea
            value={doc.job.notes}
            maxLength={SHOW_NOTES_MAX}
            rows={3}
            disabled={locked}
            // Line breaks stay; any other control character is dropped, because the file refuses them.
            onChange={(e) => onJob({ notes: plain(e.target.value, true) })}
            aria-describedby="show-notes-count"
          />
          <span id="show-notes-count" className="field-hint">
            {doc.job.notes.length} of {SHOW_NOTES_MAX} characters. Printed on the rigging summary.
          </span>
        </label>
        <label className="field">
          <span>Status</span>
          <select value={doc.status} disabled={locked} onChange={(e) => onStatus(e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <span className="field-hint">Approved and superseded files are read-only.</span>
        </label>
        <label className="field">
          <span>Revision</span>
          <input
            type="text"
            value={doc.revision}
            disabled={locked}
            maxLength={2}
            onChange={(e) => onRevision(cleanRevision(e.target.value))}
            aria-describedby="revision-hint"
            autoComplete="off"
          />
          <span id="revision-hint" className="field-hint">
            Blank for the first issue, then A, B, C.
          </span>
        </label>
      </div>
    </section>
  );
}
