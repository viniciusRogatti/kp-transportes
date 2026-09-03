import {
  CardHeaderRow,
  Grid,
  InlineText,
} from '../../style/returnsOccurrences';

export type OccurrenceWorkflowFilter = 'all' | 'pending_transportadora' | 'awaiting_control_tower' | 'finalized';

type OccurrenceListControlsProps = {
  canManageStatus: boolean;
  hasSavedDraft: boolean;
  isControlTowerUser: boolean;
  statusFilter: OccurrenceWorkflowFilter;
  invoiceFilter: string;
  startDate: string;
  endDate: string;
  onCreate: () => void;
  onDiscardDraft: () => void;
  onStatusFilterChange: (value: OccurrenceWorkflowFilter) => void;
  onInvoiceFilterChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
};

export default function OccurrenceListControls({
  canManageStatus,
  hasSavedDraft,
  isControlTowerUser,
  statusFilter,
  invoiceFilter,
  startDate,
  endDate,
  onCreate,
  onDiscardDraft,
  onStatusFilterChange,
  onInvoiceFilterChange,
  onStartDateChange,
  onEndDateChange,
}: OccurrenceListControlsProps) {
  return (
    <>
      <CardHeaderRow>
        <h2>Ocorrencias Cadastradas</h2>
        {canManageStatus ? (
          <button
            onClick={onCreate}
            type="button"
            className="rounded-md border border-warning bg-warning px-4 py-[0.65rem] font-bold text-white transition hover:brightness-110"
          >
            Criar ocorrencia
          </button>
        ) : null}
      </CardHeaderRow>
      {hasSavedDraft && canManageStatus ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border semantic-panel-info px-3 py-2 text-sm">
          <span>Existe um rascunho de ocorrência salvo neste aparelho.</span>
          <div className="flex gap-2">
            <button type="button" className="primary" onClick={onCreate}>Continuar</button>
            <button type="button" className="secondary" onClick={onDiscardDraft}>Descartar</button>
          </div>
        </div>
      ) : null}
      <Grid className="mt-[5px] grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <InlineText>Status</InlineText>
          <select
            aria-label="Status das ocorrencias"
            value={isControlTowerUser ? 'awaiting_control_tower' : statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as OccurrenceWorkflowFilter)}
            disabled={isControlTowerUser}
          >
            {isControlTowerUser ? (
              <option value="awaiting_control_tower">Aguardando finalizacao (Talão)</option>
            ) : (
              <>
                <option value="pending_transportadora">Pendentes da transportadora</option>
                <option value="awaiting_control_tower">Aguardando finalizacao da torre</option>
                <option value="finalized">Finalizadas</option>
                <option value="all">Todas</option>
              </>
            )}
          </select>
        </div>
        <div>
          <InlineText>Filtro por NF</InlineText>
          <input
            aria-label="Filtro por NF"
            value={invoiceFilter}
            onChange={(event) => onInvoiceFilterChange(event.target.value)}
            placeholder="Ex.: 12345"
          />
        </div>
        <div>
          <InlineText>Data inicial</InlineText>
          <input
            aria-label="Data inicial das ocorrencias"
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
          />
        </div>
        <div>
          <InlineText>Data final</InlineText>
          <input
            aria-label="Data final das ocorrencias"
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
          />
        </div>
      </Grid>
    </>
  );
}
