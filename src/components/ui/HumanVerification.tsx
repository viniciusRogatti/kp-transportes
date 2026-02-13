import { useEffect, useMemo, useRef, useState } from 'react';

export type HumanVerificationProvider = 'turnstile' | 'recaptcha' | 'none';

interface HumanVerificationProps {
  provider: HumanVerificationProvider;
  resetKey?: number;
  onTokenChange: (token: string) => void;
  onErrorChange?: (message: string) => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
    grecaptcha?: {
      ready: (callback: () => void) => void;
      render: (container: HTMLElement, options: Record<string, unknown>) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

const loadScript = (id: string, src: string): Promise<void> => {
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${id}`)), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Falha ao carregar ${id}`));
    document.head.appendChild(script);
  });
};

function HumanVerification({
  provider,
  resetKey = 0,
  onTokenChange,
  onErrorChange,
}: HumanVerificationProps) {
  const [isLoading, setIsLoading] = useState(provider !== 'none');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | number | null>(null);

  const siteKey = useMemo(() => {
    if (provider === 'turnstile') return process.env.REACT_APP_TURNSTILE_SITE_KEY ?? '';
    if (provider === 'recaptcha') return process.env.REACT_APP_RECAPTCHA_SITE_KEY ?? '';
    return '';
  }, [provider]);

  useEffect(() => {
    let cancelled = false;
    onTokenChange('');
    onErrorChange?.('');

    if (provider === 'none') {
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!siteKey) {
      setIsLoading(false);
      onErrorChange?.('Site key do CAPTCHA não configurada.');
      return () => {
        cancelled = true;
      };
    }

    const setupTurnstile = async () => {
      await loadScript('turnstile-script', 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
      if (cancelled || !containerRef.current || !window.turnstile) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          onErrorChange?.('');
          onTokenChange(token);
        },
        'expired-callback': () => {
          onTokenChange('');
        },
        'error-callback': () => {
          onTokenChange('');
          onErrorChange?.('Não foi possível validar o CAPTCHA. Tente novamente.');
        },
      });
      setIsLoading(false);
    };

    const setupRecaptcha = async () => {
      await loadScript('recaptcha-script', 'https://www.google.com/recaptcha/api.js?render=explicit');
      if (cancelled || !containerRef.current || !window.grecaptcha) return;

      window.grecaptcha.ready(() => {
        if (cancelled || !containerRef.current || !window.grecaptcha) return;
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            onErrorChange?.('');
            onTokenChange(token);
          },
          'expired-callback': () => {
            onTokenChange('');
          },
          'error-callback': () => {
            onTokenChange('');
            onErrorChange?.('Não foi possível validar o CAPTCHA. Tente novamente.');
          },
        });
        setIsLoading(false);
      });
    };

    setIsLoading(true);
    const setup = provider === 'turnstile' ? setupTurnstile : setupRecaptcha;
    setup().catch(() => {
      if (!cancelled) {
        setIsLoading(false);
        onErrorChange?.('Falha ao carregar a verificação de segurança.');
      }
    });

    return () => {
      cancelled = true;
      if (provider === 'turnstile' && typeof widgetIdRef.current === 'string' && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      if (provider === 'recaptcha' && typeof widgetIdRef.current === 'number' && window.grecaptcha) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [provider, resetKey, siteKey, onTokenChange, onErrorChange]);

  if (provider === 'none') {
    return (
      <div className="rounded-xl border border-border bg-surface/70 p-3 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Verificação de segurança</p>
        <div className="mt-2 flex min-h-[68px] items-center justify-center rounded-md border border-dashed border-border bg-surface-2/60 px-2">
          <span className="text-xs text-muted">CAPTCHA pendente de configuração (Turnstile/reCAPTCHA).</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface/70 p-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Verificação de segurança</p>
      <div className="mt-2 flex min-h-[78px] items-center justify-center rounded-md border border-dashed border-border bg-surface-2/60 px-2">
        {isLoading && <span className="text-xs text-muted">Carregando CAPTCHA...</span>}
        <div ref={containerRef} />
      </div>
    </div>
  );
}

export default HumanVerification;
