// Recent files (layer 2): reopen a saved file without browsing for it.

import type { RecentFile } from '../files/recent';
import { formatStamp } from '../print/footer';
import { Dialog } from './Dialog';

interface Props {
  files: RecentFile[];
  onOpen: (file: RecentFile) => void;
  onRemove: (file: RecentFile) => void;
  onClose: () => void;
}

export function RecentFilesDialog({ files, onOpen, onRemove, onClose }: Props) {
  return (
    <Dialog title="Recent files" onClose={onClose}>
      <p className="muted">Files opened or saved in this browser. The browser may ask again for permission to use a file.</p>
      {files.length === 0 ? <p>No recent files.</p> : null}
      <ul className="recent-list">
        {files.map((f) => (
          <li key={`${f.name}-${f.usedAt}`}>
            <span className="recent-name">
              {f.name}
              <span className="recent-when"> · last used {formatStamp(new Date(f.usedAt))}</span>
            </span>
            <span className="recent-actions">
              <button type="button" className="button primary" onClick={() => onOpen(f)} aria-label={`Open ${f.name}`}>
                Open
              </button>
              <button type="button" className="button" onClick={() => onRemove(f)} aria-label={`Remove ${f.name} from the list`}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
