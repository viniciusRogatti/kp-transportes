type CompanyScopeBannerProps = {
  title: string;
  description?: string;
  totalLabel?: string;
};

function CompanyScopeBanner({ title, description, totalLabel }: CompanyScopeBannerProps) {
  const permission = String(localStorage.getItem('user_permission') || '').trim().toLowerCase();
  const companyName = String(localStorage.getItem('company_name') || '').trim() || 'Empresa nao identificada';
  const companyCode = String(localStorage.getItem('company_code') || '').trim();
  const isScopedByCompany = permission === 'control_tower';
  const label = isScopedByCompany
    ? companyName
    : 'Todas as empresas configuradas';

  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface/80 px-4 py-3 shadow-[var(--shadow-1)]">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Escopo da empresa</p>
        <h2 className="mt-1 text-base font-semibold text-text">{title}</h2>
        <p className="mt-1 text-sm text-text">
          {label}
          {isScopedByCompany && companyCode ? <span className="text-muted">{` (${companyCode})`}</span> : null}
        </p>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      </div>
      {totalLabel ? (
        <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-200">
          {totalLabel}
        </span>
      ) : null}
    </div>
  );
}

export default CompanyScopeBanner;
