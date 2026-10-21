export interface ServiceWorkerState {
  isRegistered: boolean;
  isOfflineReady: boolean;
  needRefresh: boolean;
  updateSW: () => Promise<void>;
}

let swState: ServiceWorkerState = {
  isRegistered: false,
  isOfflineReady: false,
  needRefresh: false,
  updateSW: async () => {},
};

export function initServiceWorker(onStateChange?: (state: ServiceWorkerState) => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Em ambiente de desenvolvimento (localhost), remove qualquer Service Worker antigo que possa travar o carregamento
  if (
    import.meta.env.DEV ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      })
      .catch(() => {});
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        swState = {
          ...swState,
          isRegistered: true,
          isOfflineReady: true,
          updateSW: async () => {
            await registration.update();
          },
        };
        onStateChange?.(swState);
      })
      .catch((error) => {
        console.warn('[Service Worker] Erro durante o registro:', error);
      });
  });
}

export function getServiceWorkerState(): ServiceWorkerState {
  return swState;
}