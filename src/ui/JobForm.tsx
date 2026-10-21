import { effectiveOffset, type Doc, type Job } from './document';

interface Props {
  doc: Doc;
  onJob: (patch: Partial<Job>) => void;
}

/** The details a printed fly sheet carries that the PDF does not hold. */
export function JobForm({ doc, onJob }: Props) {
  const badDefault = effectiveOffset({ ...doc, offsets: {} }, 0).value === null;
  return (
    <section className="panel" aria-labelledby="job-heading">
      <h2 id="job-heading">Show details</h2>
      <div className="form-grid">
        <label className="field">
          <span>Show</span>
          <input type="text" value={doc.job.show} onChange={(e) => onJob({ show: e.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span>System engineer</span>
          <input type="text" value={doc.job.engineer} onChange={(e) => onJob({ engineer: e.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span>Company</span>
          <input type="text" value={doc.job.company} onChange={(e) => onJob({ company: e.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span>Z-axis zero</span>
          <input
            type="text"
            value={doc.job.zAxisZero}
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
            onChange={(e) => onJob({ defaultOffset: e.target.value })}
            aria-invalid={badDefault}
            aria-describedby="default-offset-hint"
            placeholder="0"
            autoComplete="off"
          />
          <span id="default-offset-hint" className={badDefault ? 'field-error' : 'field-hint'}>
            {badDefault
              ? 'Enter a number of metres, such as 0.3.'
              : 'Taken off the report heights. Each array can have its own.'}
          </span>
        </label>
      </div>
    </section>
  );
}
