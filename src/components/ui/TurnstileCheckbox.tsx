import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

interface TurnstileCheckboxProps {
  siteKey: string;
  onTokenChange: (token: string) => void;
  onErrorChange?: (message: string) => void;
  onReadyChange?: (ready: boolean) => void;
}

export interface TurnstileCheckboxHandle {
  reset: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_ID = 'turnstile-script';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstileScriptPromise: Promise<void> | null = null;

const waitForTurnstile = (timeoutMs = 10000): Promise<void> => (
  new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      if (window.turnstile) {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Turnstile indisponível no navegador.'));
        return;
      }

      window.setTimeout(check, 50);
    };

    check();
  })
);

const loadTurnstileScript = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile disponível apenas no navegador.'));
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const scriptById = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    const scriptBySrc = document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`) as HTMLScriptElement | null;
    const existing = scriptById || scriptBySrc;

    const onLoad = () => {
      if (existing) existing.dataset.loaded = 'true';
      resolve();
    };

    const onError = () => reject(new Error('Falha ao carregar script do Turnstile.'));

    if (existing) {
      if (!existing.id) existing.id = TURNSTILE_SCRIPT_ID;
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', onLoad, { once: true });
      existing.addEventListener('error', onError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', onError, { once: true });
    document.head.appendChild(script);
  })
    .then(() => waitForTurnstile())
    .catch((error) => {
      turnstileScriptPromise = null;
      throw error;
    });

  return turnstileScriptPromise;
};

const TurnstileCheckbox = forwardRef<TurnstileCheckboxHandle, TurnstileCheckboxProps>(function TurnstileCheckbox(
  {
    siteKey,
    onTokenChange,
    onErrorChange,
    onReadyChange,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onTokenChange);
  const onErrorRef = useRef(onErrorChange);
  const onReadyRef = useRef(onReadyChange);

  useEffect(() => {
    onTokenRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    onErrorRef.current = onErrorChange;
  }, [onErrorChange]);

  useEffect(() => {
    onReadyRef.current = onReadyChange;
  }, [onReadyChange]);

  const resetWidget = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    onTokenRef.current('');
    onErrorRef.current?.('');
    onReadyRef.current?.(false);

    if (!siteKey) {
      onErrorRef.current?.('Site key do Turnstile não configurada.');
      return () => {
        cancelled = true;
      };
    }

    const renderWidget = async () => {
      await loadTurnstileScript();
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current !== null) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        size: 'normal',
        appearance: 'always',
        callback: (token: string) => {
          onErrorRef.current?.('');
          onTokenRef.current(token);
        },
        'expired-callback': () => {
          onTokenRef.current('');
          resetWidget();
        },
        'error-callback': () => {
          onTokenRef.current('');
          onErrorRef.current?.('Não foi possível validar o CAPTCHA. Tente novamente.');
          resetWidget();
        },
      });

      onReadyRef.current?.(true);
    };

    renderWidget().catch((error) => {
      if (!cancelled) {
        onErrorRef.current?.(error instanceof Error ? error.message : 'Falha ao inicializar Turnstile.');
      }
    });

    return () => {
      cancelled = true;
      onReadyRef.current?.(false);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, resetWidget]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenRef.current('');
      onErrorRef.current?.('');
      resetWidget();
    },
  }), [resetWidget]);

  return <div ref={containerRef} className="mx-auto min-h-[70px] w-full max-w-full" />;
});

export default TurnstileCheckbox;
