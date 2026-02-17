import { useEffect } from 'react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RELOAD_GUARD_TTL_MS = 60 * 1000;
const RELOAD_GUARD_KEY = 'kp_app_forced_reload_guard';

type AssetManifest = {
  files?: {
    ['main.js']?: string;
  };
};

function normalizePath(value: string) {
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.pathname;
  } catch {
    return value;
  }
}

function extractMainHash(value: string) {
  const source = normalizePath(String(value || ''));
  const match = source.match(/main\.([a-z0-9]+)\.js$/i);
  return match?.[1] || '';
}

function getCurrentMainScriptHash() {
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const mainScript = scripts.find((script) => {
    const src = script.getAttribute('src') || '';
    return /\/static\/js\/main\.[a-z0-9]+\.js($|\?)/i.test(src);
  });

  if (!mainScript) {
    return '';
  }

  return extractMainHash(mainScript.getAttribute('src') || '');
}

function shouldBlockReloadForHash(nextHash: string) {
  if (!nextHash) {
    return true;
  }

  try {
    const raw = sessionStorage.getItem(RELOAD_GUARD_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as { hash?: string; timestamp?: number };
    const timestamp = Number(parsed?.timestamp || 0);
    const isFresh = Number.isFinite(timestamp) && Date.now() - timestamp < RELOAD_GUARD_TTL_MS;

    return parsed?.hash === nextHash && isFresh;
  } catch {
    return false;
  }
}

function saveReloadGuard(nextHash: string) {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify({
      hash: nextHash,
      timestamp: Date.now(),
    }));
  } catch {
    // no-op
  }
}

function clearReloadGuard() {
  try {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    // no-op
  }
}

export default function useAppVersionAutoRefresh() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    let cancelled = false;

    const runVersionCheck = async () => {
      if (cancelled) return;

      const manifestBase = process.env.PUBLIC_URL || '';
      const manifestUrl = `${manifestBase}/asset-manifest.json?v=${Date.now()}`;

      try {
        const response = await fetch(manifestUrl, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        });

        if (!response.ok) return;

        const manifest = await response.json() as AssetManifest;
        const nextMainHash = extractMainHash(manifest?.files?.['main.js'] || '');
        const currentMainHash = getCurrentMainScriptHash();

        if (!nextMainHash || !currentMainHash) return;

        if (nextMainHash === currentMainHash) {
          clearReloadGuard();
          return;
        }

        if (shouldBlockReloadForHash(nextMainHash)) {
          return;
        }

        saveReloadGuard(nextMainHash);
        window.location.reload();
      } catch {
        // Keep silent: this check should never break app usage.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runVersionCheck();
      }
    };

    const onFocus = () => {
      void runVersionCheck();
    };

    void runVersionCheck();
    const intervalId = window.setInterval(() => {
      void runVersionCheck();
    }, CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
}
