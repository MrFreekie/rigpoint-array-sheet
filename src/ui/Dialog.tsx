import { useEffect, useId, useRef, type ReactNode } from 'react';

/** A modal dialog on the browser's own <dialog>, so focus is kept inside and Escape closes it. */
export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </dialog>
  );
}
