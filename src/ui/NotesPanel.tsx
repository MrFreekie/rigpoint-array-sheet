import { SHOW_NOTES_MAX } from '../schema/array-file';
import type { Doc, Job } from './document';
import { plain } from './plain';

interface Props {
  doc: Doc;
  locked: boolean;
  onJob: (patch: Partial<Job>) => void;
}

/** The notes for the whole show: typed here, printed at the end of the rigging summary page. */
export function NotesPanel({ doc, locked, onJob }: Props) {
  return (
    <section className="panel" aria-labelledby="show-notes-heading" data-testid="show-notes-panel">
      <h2 id="show-notes-heading">Notes</h2>
      <label className="field note-field">
        <span>Notes for the show</span>
        <textarea
          value={doc.job.notes}
          maxLength={SHOW_NOTES_MAX}
          rows={4}
          disabled={locked}
          // Line breaks stay; any other control character is dropped, because the file refuses them.
          onChange={(e) => onJob({ notes: plain(e.target.value, true) })}
          aria-describedby="show-notes-count"
        />
        <span id="show-notes-count" className="field-hint">
          {doc.job.notes.length} of {SHOW_NOTES_MAX} characters. Printed at the end of the rigging summary page.
        </span>
      </label>
    </section>
  );
}
