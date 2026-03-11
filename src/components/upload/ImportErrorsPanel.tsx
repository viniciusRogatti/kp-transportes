import { IImportResult } from '../../types/upload';
import { getImportErrorPresentation } from '../../utils/importErrorPresentation';

interface ImportErrorsPanelProps {
  results: IImportResult[];
}

function normalizeTechnicalDetails(details?: string) {
  const normalized = String(details || '').trim();
  if (!normalized) return '';

  const statusMatch = normalized.match(/status code\s+(\d{3})/i);
  if (statusMatch?.[1]) {
    return `Falha no servidor ao processar o lote (HTTP ${statusMatch[1]}).`;
  }

  if (/network error/i.test(normalized)) {
    return 'Falha de rede ao comunicar com o servidor.';
  }

  return normalized;
}

function buildClipboardPayload(result: IImportResult) {
  return JSON.stringify({
    fileName: result.fileName,
    status: result.status,
    error: result.error || null,
  }, null, 2);
}

function ImportErrorsPanel({ results }: ImportErrorsPanelProps) {
  const errors = results.filter((item) => item.status === 'error');
  const successCount = results.filter((item) => item.status === 'success').length;

  if (!errors.length) {
    return (
      <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/12 p-4 text-sm text-[color:var(--color-success)]">
        Nenhum erro encontrado no processamento.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-rose-500/35 bg-rose-500/12 p-4 text-sm text-[color:var(--color-danger)]">
        {errors.length} arquivo(s) tiveram problema. {successCount} foi/foram importado(s) normalmente.
        Verifique abaixo o motivo em linguagem simples e, se quiser, use "Reenviar apenas com erro".
      </div>

      <div className="space-y-2">
        {errors.map((item) => {
          const presentation = getImportErrorPresentation(item.error);

          return (
            <div key={`${item.fileKey || item.fileName}-error`} className="rounded-xl border border-border bg-surface/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text">{item.fileName}</p>
                  <p className="mt-1 text-xs font-semibold text-[color:var(--color-danger)]">
                    {presentation.title}
                  </p>
                  <p className="mt-1 text-xs text-text">
                    {presentation.description}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--color-text-accent)]">
                    Próximo passo: {presentation.hint}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(buildClipboardPayload(item))}
                  className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-semibold text-text hover:border-accent/60"
                >
                  Copiar detalhes para suporte
                </button>
              </div>

              {item.error?.details || item.error?.stack ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-muted">Detalhes técnicos (opcional)</summary>
                  {item.error?.details ? (
                    <p className="mt-2 text-xs text-muted">
                      {normalizeTechnicalDetails(item.error.details)}
                    </p>
                  ) : null}
                  {item.error?.stack ? (
                    <pre className="scrollbar-ui mt-2 max-h-48 overflow-auto rounded-md border border-border bg-surface-2/90 p-2 text-[11px] text-text">
                      {item.error.stack}
                    </pre>
                  ) : null}
                </details>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ImportErrorsPanel;
