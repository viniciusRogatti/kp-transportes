import { IImportSummary } from '../../types/upload';

interface ImportSummaryProps {
  summary: IImportSummary;
  progressPercent: number;
  processedLabel: string;
  rateLabel?: string;
  etaLabel?: string;
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[rgba(8,21,33,0.72)] p-3">
      <p className="text-[0.72rem] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-[1.05rem] font-semibold text-text">{value}</p>
    </div>
  );
}

function ImportSummary({
  summary,
  progressPercent,
  processedLabel,
  rateLabel,
  etaLabel,
}: ImportSummaryProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-[rgba(8,21,33,0.78)] p-4 shadow-[var(--shadow-1)]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text">Progresso de processamento</h3>
          <span className="text-xs text-muted">{processedLabel}</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-strong transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
          {rateLabel ? <span>Velocidade: {rateLabel}</span> : null}
          {etaLabel ? <span>Tempo estimado restante: {etaLabel}</span> : null}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Selecionados" value={summary.selected} />
        <SummaryCard label="Processados" value={summary.processed} />
        <SummaryCard label="Sucesso" value={summary.success} />
        <SummaryCard label="Falhas" value={summary.failed} />
        <SummaryCard label="Produtos novos" value={summary.newProducts} />
        <SummaryCard label="Produtos atualizados" value={summary.updatedProducts} />
        <SummaryCard label="Notas criadas" value={summary.createdInvoices} />
        <SummaryCard label="Notas atualizadas" value={summary.updatedInvoices} />
      </div>
    </div>
  );
}

export default ImportSummary;
