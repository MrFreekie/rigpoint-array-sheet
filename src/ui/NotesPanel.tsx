import { CLOUD_URL_MAX, isCloudUrl } from '../files/cloud-url';
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
          {doc.job.notes.length} of {SHOW_NOTES_MAX} characters.
        </span>
      </label>
      <label className="field">
        <span>Cloud link</span>
        <input
          type="url"
          inputMode="url"
          value={doc.job.cloudUrl}
          maxLength={CLOUD_URL_MAX}
          placeholder="https://"
          disabled={locked}
          onChange={(e) => onJob({ cloudUrl: e.target.value.trim() })}
          aria-describedby="cloud-url-hint"
          aria-invalid={doc.job.cloudUrl !== '' && !isCloudUrl(doc.job.cloudUrl)}
          data-testid="cloud-url"
        />
        <span id="cloud-url-hint" className="field-hint">
          {doc.job.cloudUrl !== '' && !isCloudUrl(doc.job.cloudUrl)
            ? 'Not printed or saved: this is not a web address starting http:// or https://.'
            : 'A short link to the hosted PDF. Printed under the notes as a link and a QR code that invite the crew to find the most up to date version.'}
        </span>
      </label>
    </section>
  );
}
