import DatePicker from 'react-datepicker';
import ptBR from 'date-fns/locale/pt-BR';
import { Printer } from 'lucide-react';

type TripSearchControlsProps = {
  startDate: Date | null;
  endDate: Date | null;
  tripId: string;
  plate: string;
  driverName: string;
  isPrinting: boolean;
  isLoading: boolean;
  hasDisplayedTrips: boolean;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  onTripIdChange: (value: string) => void;
  onPlateChange: (value: string) => void;
  onDriverNameChange: (value: string) => void;
  onPrint: () => void | Promise<void>;
  onClear: () => void;
  onSearch: () => void | Promise<void>;
};

export default function TripSearchControls({
  startDate,
  endDate,
  tripId,
  plate,
  driverName,
  isPrinting,
  isLoading,
  hasDisplayedTrips,
  onStartDateChange,
  onEndDateChange,
  onTripIdChange,
  onPlateChange,
  onDriverNameChange,
  onPrint,
  onClear,
  onSearch,
}: TripSearchControlsProps) {
  return (
    <div className="mb-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-text">Trips / Rotas</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-700 bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-55"
            onClick={() => void onPrint()}
            disabled={isPrinting}
          >
            <Printer className="h-4 w-4" />
            Imprimir lista de salmão
          </button>
          <button
            type="button"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text"
            onClick={onClear}
          >
            Limpar
          </button>
          <button
            type="button"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text"
            onClick={() => void onSearch()}
          >
            Buscar período
          </button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <DatePicker
          selected={startDate}
          onChange={onStartDateChange}
          dateFormat="dd/MM/yyyy"
          locale={ptBR}
          placeholderText="Data inicial"
          aria-label="Data inicial das rotas"
          className="h-10 w-full rounded-sm border border-accent/35 bg-card px-3 text-sm text-text"
        />
        <DatePicker
          selected={endDate}
          onChange={onEndDateChange}
          dateFormat="dd/MM/yyyy"
          locale={ptBR}
          placeholderText="Data final"
          aria-label="Data final das rotas"
          className="h-10 w-full rounded-sm border border-accent/35 bg-card px-3 text-sm text-text"
        />
        <input
          type="text"
          value={tripId}
          onChange={(event) => onTripIdChange(event.target.value.replace(/[^\d]/g, ''))}
          placeholder="ID da rota"
          aria-label="ID da rota"
          className="h-10 rounded-sm border border-accent/35 bg-card px-3 text-sm text-text"
        />
        <input
          type="text"
          value={plate}
          onChange={(event) => onPlateChange(event.target.value.toUpperCase())}
          placeholder="Placa"
          aria-label="Placa"
          className="h-10 rounded-sm border border-accent/35 bg-card px-3 text-sm text-text"
        />
        <input
          type="text"
          value={driverName}
          onChange={(event) => onDriverNameChange(event.target.value)}
          placeholder="Nome do motorista"
          aria-label="Nome do motorista"
          className="h-10 rounded-sm border border-accent/35 bg-card px-3 text-sm text-text"
        />
      </div>

      {isLoading && hasDisplayedTrips ? (
        <div className="text-xs text-muted">Atualizando rotas...</div>
      ) : null}
    </div>
  );
}
