// Stands in for the build-time module 'virtual:pwa-register/react' in unit tests, where there is no
// service worker: nothing to update and not ready for offline.

type Flag = [boolean, (value: boolean) => void];

export function useRegisterSW(): {
  needRefresh: Flag;
  offlineReady: Flag;
  updateServiceWorker: (reload?: boolean) => Promise<void>;
} {
  return {
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: async () => undefined,
  };
}
