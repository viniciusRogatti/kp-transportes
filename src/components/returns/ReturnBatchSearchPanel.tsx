import type { MouseEvent as ReactMouseEvent } from 'react';
import { Database } from 'lucide-react';
import { formatDateTimeBR } from '../../utils/dateDisplay';

export const RETURN_BATCH_LOOKBACK_OPTIONS = [
  { value: '7', label: 'Ultimos 7 dias' },
  { value: '30', label: 'Ultimos 30 dias' },
] as const;

export type ReturnBatchLookbackValue = (typeof RETURN_BATCH_LOOKBACK_OPTIONS)[number]['value'];

type ReturnBatchSearchPanelProps = {
  returnDataLastUpdate?: string | null;
  canCreateBatch: boolean;
  batchCode: string;
  lookbackDays: ReturnBatchLookbackValue;
  startDate: string;
  endDate: string;
  onOpenRegistry: () => void;
  onCreateBatch: () => void;
  onBatchCodeChange: (value: string) => void;
  onSearchByCode: () => void | Promise<void>;
  onLookbackChange: (value: ReturnBatchLookbackValue) => void;
  onRefresh: () => void | Promise<void>;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onOpenDatePicker: (event: ReactMouseEvent<HTMLInputElement>) => void;
  onSearchByPeriod: () => void | Promise<void>;
};

export default function ReturnBatchSearchPanel({
  returnDataLastUpdate,
  canCreateBatch,
  batchCode,
  lookbackDays,
  startDate,
  endDate,
  onOpenRegistry,
  onCreateBatch,
  onBatchCodeChange,
  onSearchByCode,
  onLookbackChange,
  onRefresh,
  onStartDateChange,
  onEndDateChange,
  onOpenDatePicker,
  onSearchByPeriod,
}: ReturnBatchSearchPanelProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-text">Consultar lotes de devolucao</h2>
          <p className="text-xs text-muted">Pesquise por ID, periodo ou consulte os lotes mais recentes.</p>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <div className="text-left">
            <button
              type="button"
              onClick={onOpenRegistry}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-accent-strong bg-accent px-4 text-sm font-bold text-white shadow-soft transition-colors hover:bg-accent-strong"
            >
              <Database size={16} /> Base de devoluções
            </button>
            <p className="mt-1 text-[10px] text-muted">
              {returnDataLastUpdate
                ? `Atualizada em ${formatDateTimeBR(returnDataLastUpdate, '')}`
                : 'Base ainda não importada'}
            </p>
          </div>
          {canCreateBatch ? (
            <button
              type="button"
              onClick={onCreateBatch}
              className="h-10 shrink-0 rounded-md border border-accent-strong bg-accent px-5 text-sm font-bold text-white shadow-soft transition-colors hover:bg-accent-strong"
            >
              + Nova devolucao
            </button>
          ) : null}
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(280px,1fr)_190px_auto]">
        <div className="flex min-w-0 gap-2">
          <input
            type="search"
            value={batchCode}
            onChange={(event) => onBatchCodeChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void onSearchByCode();
            }}
            placeholder="ID do lote (ex.: RET-...)"
            aria-label="ID do lote de devolucao"
            className="h-10 min-w-0 flex-1 rounded-sm border border-border bg-card px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          />
          <button
            type="button"
            onClick={() => void onSearchByCode()}
            className="h-10 shrink-0 rounded-md border border-accent/60 bg-accent/15 px-4 text-[0.85rem] font-bold text-text-accent transition hover:bg-accent/25"
          >
            Buscar lote
          </button>
        </div>
        <select
          value={lookbackDays}
          onChange={(event) => onLookbackChange(event.target.value as ReturnBatchLookbackValue)}
          className="h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          aria-label="Periodo de devolucoes"
        >
          {RETURN_BATCH_LOOKBACK_OPTIONS.map((option) => (
            <option key={`return-lookback-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="h-10 rounded-md border border-border bg-card px-3 text-[0.82rem] font-semibold text-muted transition hover:bg-surface-2 hover:text-text"
        >
          Atualizar lista
        </button>
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="min-w-0 flex-1 sm:max-w-[220px]">
          <span className="mb-1 block text-xs font-semibold text-muted">Data inicial</span>
          <input
            type="date"
            value={startDate}
            onClick={onOpenDatePicker}
            onChange={(event) => onStartDateChange(event.target.value)}
            aria-label="Data inicial dos lotes de devolucao"
            className="h-10 w-full cursor-pointer rounded-sm border border-border bg-card px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          />
        </label>
        <label className="min-w-0 flex-1 sm:max-w-[220px]">
          <span className="mb-1 block text-xs font-semibold text-muted">Data final</span>
          <input
            type="date"
            value={endDate}
            onClick={onOpenDatePicker}
            onChange={(event) => onEndDateChange(event.target.value)}
            aria-label="Data final dos lotes de devolucao"
            className="h-10 w-full cursor-pointer rounded-sm border border-border bg-card px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          />
        </label>
        <button
          type="button"
          onClick={() => void onSearchByPeriod()}
          className="h-10 rounded-md border border-border bg-card px-4 text-[0.85rem] font-bold text-text transition hover:bg-surface-2"
        >
          Buscar período
        </button>
      </div>
    </div>
  );
}
