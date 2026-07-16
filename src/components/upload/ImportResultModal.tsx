import { useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { IUploadImportReportResponse } from '../../types/upload';
import { getImportErrorPresentation } from '../../utils/importErrorPresentation';

interface ImportResultModalProps {
  isOpen: boolean;
  report: IUploadImportReportResponse | null;
  unregisteredCompanyCount: number;
  onClose: () => void;
  onRetryErrors: () => void;
  onDownload: () => void;
  onOpenCnpjRegistration: () => void;
  onShowFullReport: () => void;
}

function ResultCount({ label, value, tone = 'default' }: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    default: 'border-border bg-card text-text',
    success: 'border-emerald-500/35 bg-emerald-500/10 text-[color:var(--color-success)]',
    warning: 'border-amber-500/35 bg-amber-500/10 text-[color:var(--color-warning)]',
    danger: 'border-rose-500/35 bg-rose-500/10 text-[color:var(--color-danger)]',
  }[tone];

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ImportResultModal({
  isOpen,
  report,
  unregisteredCompanyCount,
  onClose,
  onRetryErrors,
  onDownload,
  onOpenCnpjRegistration,
  onShowFullReport,
}: ImportResultModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const errors = useMemo(
    () => (report?.results || []).filter((item) => item.status === 'error'),
    [report],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !report) return null;

  const { summary } = report;
  const hasErrors = summary.failed > 0;
  const hasIgnored = summary.ignoredInvoices > 0;
  const nothingImported = summary.importedInvoices === 0;

  const title = hasErrors
    ? 'Alguns arquivos não puderam ser importados'
    : nothingImported && hasIgnored
      ? 'Nenhum arquivo novo foi importado'
      : hasIgnored
        ? 'Importação concluída com avisos'
        : 'Importação concluída com sucesso';

  const description = hasErrors
    ? `${summary.failed} arquivo(s) apresentaram problema. Confira a causa abaixo e tente novamente apenas os arquivos com erro.`
    : nothingImported && hasIgnored
      ? 'Todos os XMLs selecionados já existiam no sistema e foram ignorados com segurança.'
      : hasIgnored
        ? `${summary.importedInvoices} nota(s) foram importadas e ${summary.ignoredInvoices} já existiam no sistema.`
        : `${summary.importedInvoices} nota(s) foram importadas com sucesso.`;

  const HeaderIcon = hasErrors ? AlertTriangle : hasIgnored ? Info : CheckCircle2;
  const headerTone = hasErrors
    ? 'border-rose-500/40 bg-rose-500/12 text-[color:var(--color-danger)]'
    : hasIgnored
      ? 'border-amber-500/40 bg-amber-500/12 text-[color:var(--color-warning)]'
      : 'border-emerald-500/40 bg-emerald-500/12 text-[color:var(--color-success)]';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 px-3 py-5 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-result-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-3)]"
      >
        <div className={`border-b p-4 ${headerTone}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <HeaderIcon className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
              <div>
                <h2 id="import-result-title" className="text-lg font-bold">{title}</h2>
                <p className="mt-1 text-sm text-text">{description}</p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-current/30 bg-surface/70"
              aria-label="Fechar resultado da importação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="scrollbar-ui overflow-y-auto p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <ResultCount label="Arquivos selecionados" value={summary.selected} />
            <ResultCount label="Processados" value={summary.processed} />
            <ResultCount label="Notas importadas" value={summary.importedInvoices} tone="success" />
            <ResultCount label="Já existiam" value={summary.ignoredInvoices} tone="warning" />
            <ResultCount label="Com erro" value={summary.failed} tone={hasErrors ? 'danger' : 'default'} />
          </div>

          {unregisteredCompanyCount > 0 ? (
            <div className="mt-4 rounded-xl border semantic-panel-warning p-4">
              <p className="text-sm font-semibold">CNPJ de emitente ainda não cadastrado</p>
              <p className="mt-1 text-xs">
                {unregisteredCompanyCount} CNPJ(s) foram encontrados nos XMLs. Se pertencem a uma empresa autorizada,
                cadastre-os e depois reenvie somente os arquivos com erro.
              </p>
              <button
                type="button"
                onClick={onOpenCnpjRegistration}
                className="mt-3 inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-semibold text-text"
              >
                Cadastrar novo CNPJ
              </button>
            </div>
          ) : null}

          {errors.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-text">Detalhes dos arquivos com erro</h3>
              <div className="mt-2 space-y-2">
                {errors.map((item) => {
                  const presentation = getImportErrorPresentation(item.error);
                  return (
                    <details key={`${item.fileKey || item.fileName}-modal-error`} className="rounded-xl border border-border bg-card p-3">
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-text">{item.fileName}</span>
                          <span className="rounded-full border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-[0.68rem] font-semibold text-[color:var(--color-danger)]">
                            {presentation.title}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">{presentation.description}</p>
                      </summary>
                      <div className="mt-3 border-t border-border pt-3 text-xs">
                        <p className="font-semibold text-[color:var(--color-text-accent)]">Como resolver</p>
                        <p className="mt-1 text-text">{presentation.hint}</p>
                        {item.error?.details ? (
                          <div className="mt-3 rounded-md border border-border bg-surface p-2">
                            <p className="font-semibold text-muted">Informação técnica</p>
                            <p className="mt-1 break-words text-muted">{item.error.details}</p>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-card/60 p-4">
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text"
          >
            Baixar relatório
          </button>
          <button
            type="button"
            onClick={onShowFullReport}
            className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text"
          >
            Ver relatório na página
          </button>
          {hasErrors ? (
            <button
              type="button"
              onClick={onRetryErrors}
              className="inline-flex h-10 items-center rounded-md border semantic-solid-danger px-4 text-sm font-semibold"
            >
              Reenviar arquivos com erro
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-md border border-accent/40 bg-gradient-to-r from-accent to-accent-strong px-4 text-sm font-semibold text-[#04131e]"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportResultModal;
