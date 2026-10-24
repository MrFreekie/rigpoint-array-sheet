import type { Change } from '../engine/compare';
import { Dialog } from './Dialog';

const SHOWN = 60;

const WORD = { changed: 'CHANGED', added: 'ADDED', removed: 'REMOVED', restored: 'RESTORED' } as const;

/** What a new PDF would change in the file that is open, with the choice to update or keep it as saved. */
export function CompareDialog({
  changes,
  sourceName,
  onUpdate,
  onKeep,
}: {
  changes: readonly Change[];
  sourceName: string;
  onUpdate: () => void;
  onKeep: () => void;
}) {
  const shown = changes.slice(0, SHOWN);
  return (
    <Dialog title="The new PDF is different" onClose={onKeep}>
      <p>
        {sourceName} differs from this file in {changes.length} {changes.length === 1 ? 'place' : 'places'}. Your show details, ground
        offsets, titles, notes, plot symbols and cable patches are kept. They stay with an array of the same name, and a symbol stays with the same pickup. A symbol the new PDF cannot follow is listed and goes back to 1 t. A cable patch stays row for row while the array has the same number of enclosures. If the number differs, that patch is listed and cleared. An array you deleted comes back if the new PDF has it.
      </p>
      <ul className="change-list" aria-label="Differences">
        {shown.map((c, i) => (
          <li key={i}>
            <span className={`tag ${c.kind === 'changed' ? 'tag-check' : c.kind === 'added' || c.kind === 'restored' ? 'tag-ok' : 'tag-error'}`}>{WORD[c.kind]}</span>{' '}
            {c.array ? <strong>{c.shownAs ? `${c.array} (shown as ${c.shownAs}): ` : `${c.array}: `}</strong> : null}
            {c.what}
            {c.saved !== null && c.now !== null ? (
              <>
                {' '}
                was <q>{c.saved}</q>, now <q>{c.now}</q>
              </>
            ) : c.saved !== null ? (
              <>
                {' '}
                (<q>{c.saved}</q>)
              </>
            ) : c.now !== null ? (
              <>
                {' '}
                (<q>{c.now}</q>)
              </>
            ) : null}
          </li>
        ))}
      </ul>
      {changes.length > SHOWN ? <p className="muted">…and {changes.length - SHOWN} more.</p> : null}
      <div className="dialog-actions">
        <button type="button" className="button primary" onClick={onUpdate}>
          Update from new PDF
        </button>
        <button type="button" className="button" onClick={onKeep}>
          Keep as saved
        </button>
      </div>
    </Dialog>
  );
}
