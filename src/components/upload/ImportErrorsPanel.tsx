import { IImportResult } from '../../types/upload';

interface ImportErrorsPanelProps {
  results: IImportResult[];
}

const ERROR_CODE_LABELS: Record<string, string> = {
  INVALID_FILE_TYPE: 'Arquivo inválido',
  XML_PARSE_ERROR: 'XML inválido',
  MISSING_REQUIRED_FIELD: 'Campo obrigatório ausente',
  DUPLICATE_INVOICE: 'Nota fiscal duplicada',
  DB_CONSTRAINT_ERROR: 'Conflito de dados',
  UNKNOWN_ERROR: 'Erro inesperado',
};

function getErrorCodeLabel(code?: string) {
  if (!code) return ERROR_CODE_LABELS.UNKNOWN_ERROR;
  return ERROR_CODE_LABELS[code] || 'Erro de importação';
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
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-900/20 p-4 text-sm text-emerald-100">
        Nenhum erro encontrado no processamento.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-rose-500/25 bg-rose-900/20 p-4 text-sm text-rose-100">
        Falhou em {errors.length} arquivo(s) — {successCount} foi/foram importado(s) normalmente.
      </div>

      <div className="space-y-2">
        {errors.map((item) => (
          <div key={`${item.fileKey || item.fileName}-error`} className="rounded-xl border border-white/10 bg-[rgba(8,21,33,0.72)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-text">{item.fileName}</p>
                <p className="mt-1 text-xs text-rose-200">
                  {getErrorCodeLabel(item.error?.code)} • {item.error?.message || 'Erro inesperado ao processar arquivo.'}
                </p>
                {item.error?.hint ? (
                  <p className="mt-1 text-xs text-sky-200">Dica: {item.error.hint}</p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(buildClipboardPayload(item))}
                className="inline-flex h-8 items-center rounded-md border border-white/15 bg-surface-2 px-3 text-xs font-semibold text-text hover:border-accent/60"
              >
                Copiar detalhes
              </button>
            </div>

            {item.error?.details || item.error?.stack ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-muted">Detalhes técnicos</summary>
                {item.error?.details ? (
                  <p className="mt-2 text-xs text-muted">
                    {normalizeTechnicalDetails(item.error.details)}
                  </p>
                ) : null}
                {item.error?.stack ? (
                  <pre className="scrollbar-ui mt-2 max-h-48 overflow-auto rounded-md border border-white/10 bg-black/30 p-2 text-[11px] text-slate-200">
                    {item.error.stack}
                  </pre>
                ) : null}
              </details>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ImportErrorsPanel;
