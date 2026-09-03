import { Search } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import ptBR from 'date-fns/locale/pt-BR';

registerLocale('ptBR', ptBR);

export type InvoiceSearchFeedback = {
  tone: 'danger' | 'info' | 'warning';
  message: string;
  actionUrl?: string;
  actionLabel?: string;
};

type InvoiceSearchPanelProps = {
  searchNf: string;
  onSearchNfChange: (value: string) => void;
  onSearchNf: () => void | Promise<void>;
  isSearchingInvoice: boolean;
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  onSearchPeriod: () => void | Promise<void>;
  isSearchingPeriod: boolean;
  invoiceSearchFeedback: InvoiceSearchFeedback | null;
  periodSearchError: string | null;
  onNavigate: (url: string) => void;
};

export default function InvoiceSearchPanel({
  searchNf,
  onSearchNfChange,
  onSearchNf,
  isSearchingInvoice,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSearchPeriod,
  isSearchingPeriod,
  invoiceSearchFeedback,
  periodSearchError,
  onNavigate,
}: InvoiceSearchPanelProps) {
  return (
    <section
      data-tutorial="page-filters"
      aria-labelledby="invoice-search-title"
      className="mb-3 w-full max-w-[var(--content-max-width)] rounded-lg border border-border bg-card p-3 shadow-soft [&_input]:h-9 [&_button]:h-9"
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h1 id="invoice-search-title" className="text-lg font-semibold text-text">Buscar notas</h1>
        <p className="text-sm text-muted">Consulte uma NF específica ou carregue as notas emitidas em um período.</p>
      </div>

      <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="self-end">
          <label htmlFor="invoice-number-search" className="mb-1.5 block text-sm font-medium text-text">
            Número da NF
          </label>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input
              id="invoice-number-search"
              value={searchNf}
              type="text"
              inputMode="numeric"
              onChange={(event) => onSearchNfChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void onSearchNf();
              }}
              placeholder="Ex.: 123456"
              disabled={isSearchingInvoice}
              className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void onSearchNf()}
              disabled={isSearchingInvoice || !searchNf.trim()}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-accent-strong bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              {isSearchingInvoice ? 'Buscando...' : 'Buscar NF'}
            </button>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Período de emissão</span>
          <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <label htmlFor="invoice-start-date" className="mb-1 block text-xs text-muted">Data inicial</label>
              <DatePicker
                id="invoice-start-date"
                selected={startDate}
                onChange={onStartDateChange}
                placeholderText="Data inicial"
                dateFormat="dd/MM/yyyy"
                locale="ptBR"
                popperPlacement="bottom-start"
                className="date-picker-input h-11"
                wrapperClassName="w-full"
                withPortal
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="invoice-end-date" className="mb-1 block text-xs text-muted">Data final</label>
              <DatePicker
                id="invoice-end-date"
                selected={endDate}
                onChange={onEndDateChange}
                placeholderText="Data final"
                dateFormat="dd/MM/yyyy"
                locale="ptBR"
                popperPlacement="bottom-start"
                className="date-picker-input h-11"
                wrapperClassName="w-full"
                withPortal
              />
            </div>
            <button
              type="button"
              onClick={() => void onSearchPeriod()}
              disabled={!startDate || !endDate || isSearchingPeriod}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-accent-strong bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              {isSearchingPeriod ? 'Buscando...' : 'Buscar período'}
            </button>
          </div>
        </div>
      </div>

      {invoiceSearchFeedback ? (
        <div
          role="status"
          className={`mt-2 rounded-md border px-3 py-2 text-sm ${invoiceSearchFeedback.tone === 'danger'
            ? 'semantic-panel-danger'
            : invoiceSearchFeedback.tone === 'warning'
              ? 'semantic-panel-warning'
              : 'semantic-panel-info'}`}
        >
          <span>{invoiceSearchFeedback.message}</span>
          {invoiceSearchFeedback.actionUrl ? (
            <button
              type="button"
              onClick={() => onNavigate(invoiceSearchFeedback.actionUrl as string)}
              className="ml-2 rounded-md border border-current/30 bg-card px-2 py-1 text-xs font-semibold"
            >
              {invoiceSearchFeedback.actionLabel || 'Abrir referência'}
            </button>
          ) : null}
        </div>
      ) : null}
      {periodSearchError ? (
        <div role="alert" className="mt-2 rounded-md border px-3 py-2 text-sm semantic-panel-danger">
          {periodSearchError}
        </div>
      ) : null}
    </section>
  );
}
