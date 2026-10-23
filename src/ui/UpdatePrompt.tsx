// Offline readiness and "Update available, reload". A new version waits until the person chooses to
// reload. It never replaces the app in the middle of an edit.

import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function UpdatePrompt({ dirty }: { dirty: boolean }) {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // A laptop left open on site still hears about new versions.
      if (registration) setInterval(() => void registration.update().catch(() => undefined), UPDATE_CHECK_MS);
    },
  });

  // "Ready to work offline" is worth saying once, then it gets out of the way.
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 8000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  const reload = () => {
    if (
      dirty &&
      !window.confirm(
        'Reload to update? Your unsaved changes are kept by autosave in this browser and will be offered back after the reload.',
      )
    ) {
      return;
    }
    void updateServiceWorker(true);
  };

  if (needRefresh) {
    return (
      <section className="banner banner-check" aria-labelledby="update-heading" role="status">
        <h2 id="update-heading">Update available, reload</h2>
        <p>A new version of the app is ready. It will be used after you reload.</p>
        <p className="banner-actions">
          <button type="button" className="button primary" onClick={reload}>
            Reload
          </button>
        </p>
      </section>
    );
  }
  if (offlineReady) {
    return (
      <p className="banner" role="status">
        Ready to work offline: the app is stored in this browser.
      </p>
    );
  }
  return null;
}
