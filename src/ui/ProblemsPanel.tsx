import type { Problem } from '../engine/types';

/** The small READ OK mark in the header, for a report with nothing to check. The words are its tooltip. */
export function ReadOkChip() {
  return (
    <span className="tag tag-ok" title="Every line in the array sections was understood and the report's own figures agree with each other.">
      READ OK
    </span>
  );
}

/** Errors and checks from reading the PDF. Each carries a word, so colour is never the only signal. */
export function ProblemsPanel({ problems, ok }: { problems: readonly Problem[]; ok: boolean }) {
  // Nothing found: the READ OK chip in the header says so, so there is no banner.
  if (problems.length === 0) return null;
  const errors = problems.filter((p) => p.level === 'error');
  const checks = problems.filter((p) => p.level === 'check');
  return (
    <section className={`banner ${ok ? 'banner-check' : 'banner-error'}`} aria-labelledby="problems-heading" role={ok ? 'status' : 'alert'}>
      <h2 id="problems-heading">
        {ok
          ? `${checks.length} thing${checks.length === 1 ? '' : 's'} to check against the PDF`
          : 'This report cannot be relied on'}
      </h2>
      {ok ? (
        <p>The figures below were read as printed, but the items listed here need a look at the original PDF.</p>
      ) : (
        <p>The sheet is not shown, because the figures could be wrong.</p>
      )}
      <ul className="problem-list">
        {[...errors, ...checks].map((p, i) => (
          <li key={i}>
            <span className={`tag ${p.level === 'error' ? 'tag-error' : 'tag-check'}`}>{p.level === 'error' ? 'ERROR' : 'CHECK'}</span>{' '}
            {p.source ? <strong>{p.source}: </strong> : null}
            {p.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
