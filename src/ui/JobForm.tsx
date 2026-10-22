import { cleanRevision } from '../files/revision';
import { effectiveOffset, STATUS_LABELS, STATUSES, type Doc, type Job, type Status } from './document';

interface Props {
  doc: Doc;
  locked: boolean;
  onJob: (patch: Partial<Job>) => void;
  onStatus: (status: Status) => void;
  onRevision: (revision: string) => void;
}

/** The details a printed fly sheet carries that the PDF does not hold. */
export function JobForm({ doc, locked, onJob, onStatus, onRevision }: Props) {
  const badDefault = effectiveOffset({ ...doc, offsets: {} }, 0).value === null;
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
        <label className="field">
          <span>Ground offset for every array (m)</span>
          <input
            type="text"
            inputMode="decimal"
            value={doc.job.defaultOffset}
            disabled={locked}
            onChange={(e) => onJob({ defaultOffset: e.target.value })}
            aria-invalid={badDefault}
            aria-describedby="default-offset-hint"
            placeholder="0"
            autoComplete="off"
          />
          <span id="default-offset-hint" className={badDefault ? 'field-error' : 'field-hint'}>
            {badDefault ? 'Enter a number of metres, such as 0.3.' : 'Taken off the report heights. Each array can have its own.'}
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
