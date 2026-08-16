import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import TurnstileCheckbox, { TurnstileCheckboxHandle } from './TurnstileCheckbox';
import { useTheme } from '../../context/ThemeContext';

export type HumanVerificationProvider = 'turnstile' | 'recaptcha' | 'none';

interface HumanVerificationProps {
  provider: HumanVerificationProvider;
  resetKey?: number;
  onTokenChange: (token: string) => void;
  onErrorChange?: (message: string) => void;
}

export interface HumanVerificationHandle {
  reset: () => void;
}

declare global {
  interface Window {
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

const HumanVerification = forwardRef<HumanVerificationHandle, HumanVerificationProps>(function HumanVerification(
  {
    provider,
    resetKey = 0,
    onTokenChange,
    onErrorChange,
  },
  ref,
) {
  const { isLightTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(provider !== 'none');
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const recaptchaWidgetIdRef = useRef<number | null>(null);
  const turnstileCheckboxRef = useRef<TurnstileCheckboxHandle | null>(null);

  const siteKey = useMemo(() => {
    if (provider === 'turnstile') return process.env.REACT_APP_TURNSTILE_SITE_KEY ?? '';
    if (provider === 'recaptcha') return process.env.REACT_APP_RECAPTCHA_SITE_KEY ?? '';
    return '';
  }, [provider]);

  useEffect(() => {
    onTokenChange('');
    onErrorChange?.('');
  }, [provider, onTokenChange, onErrorChange]);

  useEffect(() => {
    if (provider !== 'recaptcha') {
      setIsLoading(provider === 'turnstile');
      return;
    }

    let cancelled = false;
    const recaptchaContainer = recaptchaContainerRef.current;
    setIsLoading(true);

    if (!siteKey) {
      setIsLoading(false);
      onErrorChange?.('A verificação de segurança está indisponível. Contate o suporte.');
      return () => {
        cancelled = true;
      };
    }

    const setupRecaptcha = async () => {
      await loadScript('recaptcha-script', 'https://www.google.com/recaptcha/api.js?render=explicit');
      if (cancelled || !recaptchaContainerRef.current || !window.grecaptcha) return;
      if (recaptchaWidgetIdRef.current !== null) return;

      window.grecaptcha.ready(() => {
        if (cancelled || !recaptchaContainerRef.current || !window.grecaptcha) return;
        if (recaptchaWidgetIdRef.current !== null) return;

        recaptchaWidgetIdRef.current = window.grecaptcha.render(recaptchaContainerRef.current, {
          sitekey: siteKey,
          size: 'normal',
          theme: isLightTheme ? 'light' : 'dark',
          callback: (token: string) => {
            onErrorChange?.('');
            onTokenChange(token);
          },
          'expired-callback': () => {
            onTokenChange('');
            if (typeof recaptchaWidgetIdRef.current === 'number' && window.grecaptcha) {
              window.grecaptcha.reset(recaptchaWidgetIdRef.current);
            }
          },
          'error-callback': () => {
            onTokenChange('');
            onErrorChange?.('Não foi possível validar o CAPTCHA. Tente novamente.');
            if (typeof recaptchaWidgetIdRef.current === 'number' && window.grecaptcha) {
              window.grecaptcha.reset(recaptchaWidgetIdRef.current);
            }
          },
        });
        setIsLoading(false);
      });
    };

    setupRecaptcha().catch(() => {
      if (!cancelled) {
        setIsLoading(false);
        onErrorChange?.('Não foi possível carregar a verificação de segurança. Tente novamente.');
      }
    });

    return () => {
      cancelled = true;
      if (typeof recaptchaWidgetIdRef.current === 'number' && window.grecaptcha) {
        window.grecaptcha.reset(recaptchaWidgetIdRef.current);
      }
      recaptchaContainer?.replaceChildren();
      recaptchaWidgetIdRef.current = null;
    };
  }, [provider, siteKey, onTokenChange, onErrorChange, isLightTheme]);

  useEffect(() => {
    if (resetKey <= 0) return;

    if (provider === 'turnstile') {
      turnstileCheckboxRef.current?.reset();
    }

    if (provider === 'recaptcha' && typeof recaptchaWidgetIdRef.current === 'number' && window.grecaptcha) {
      onTokenChange('');
      window.grecaptcha.reset(recaptchaWidgetIdRef.current);
    }
  }, [resetKey, provider, onTokenChange]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenChange('');
      onErrorChange?.('');
      if (provider === 'turnstile') {
        turnstileCheckboxRef.current?.reset();
      }
      if (provider === 'recaptcha' && typeof recaptchaWidgetIdRef.current === 'number' && window.grecaptcha) {
        window.grecaptcha.reset(recaptchaWidgetIdRef.current);
      }
    },
  }), [provider, onTokenChange, onErrorChange]);

  if (provider === 'none') {
    return (
      <div className="human-verification rounded-lg border border-border bg-card p-3 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Verificação de segurança</p>
        <div className="human-verification-frame mt-2 flex min-h-[68px] items-center justify-center rounded-md border border-dashed border-border bg-surface-2 px-2">
          <span className="text-xs text-muted">Verificação não exigida neste ambiente.</span>
        </div>
      </div>
    );
  }

  if (provider === 'turnstile') {
    return (
      <div className="human-verification rounded-md border border-border bg-card p-3 text-left max-[420px]:p-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Verificação de segurança</p>
        <div className="human-verification-frame mt-2 flex min-h-[78px] w-full flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-2 p-2 max-[420px]:px-0 max-[420px]:py-1">
          {isLoading && <span className="text-xs text-muted">Carregando verificação...</span>}
          <div className="w-full overflow-hidden rounded-md">
            <TurnstileCheckbox
              ref={turnstileCheckboxRef}
              siteKey={siteKey}
              onTokenChange={onTokenChange}
              onErrorChange={onErrorChange}
              onReadyChange={(ready) => setIsLoading(!ready)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="human-verification rounded-lg border border-border bg-card p-3 text-left max-[420px]:p-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Verificação de segurança</p>
      <div className="human-verification-frame mt-2 flex min-h-[78px] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface-2 p-2 max-[420px]:px-0 max-[420px]:py-1">
        {isLoading && <span className="text-xs text-muted">Carregando CAPTCHA...</span>}
        <div className="w-full overflow-hidden rounded-md">
          <div ref={recaptchaContainerRef} className="mx-auto w-full max-w-full" />
        </div>
      </div>
    </div>
  );
});

export default HumanVerification;
