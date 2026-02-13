interface CaptchaSlotProps {
  provider?: 'turnstile' | 'recaptcha' | 'none';
}

function CaptchaSlot({ provider = 'none' }: CaptchaSlotProps) {
  const message = provider === 'turnstile'
    ? 'Turnstile habilitado: configure REACT_APP_TURNSTILE_SITE_KEY para ativar.'
    : provider === 'recaptcha'
      ? 'reCAPTCHA habilitado: configure REACT_APP_RECAPTCHA_SITE_KEY para ativar.'
      : 'CAPTCHA pendente de configuração (Turnstile/reCAPTCHA).';

  return (
    <div className="rounded-xl border border-border bg-surface/70 p-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Verificação de segurança</p>
      <div className="mt-2 flex min-h-[68px] items-center justify-center rounded-md border border-dashed border-border bg-surface-2/60 px-2">
        <span className="text-xs text-muted">{message}</span>
      </div>
    </div>
  );
}

export default CaptchaSlot;
