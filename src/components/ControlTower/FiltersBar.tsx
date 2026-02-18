import { RotateCw, Download, FilterX, Search, X } from 'lucide-react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { ControlTowerFilters, PeriodPreset } from '../../types/controlTower';

interface FiltersBarProps {
  filters: ControlTowerFilters;
  options: {
    customers: string[];
    cities: string[];
    routes: string[];
    products: string[];
  };
  updatedAgoLabel: string;
  onChange: (next: Partial<ControlTowerFilters>) => void;
  onRefresh: () => void;
  onReset: () => void;
  onExport: () => void;
}

const periodOptions: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Personalizado' },
];

const today = new Date().toISOString().slice(0, 10);

function FiltersBar({ filters, options, updatedAgoLabel, onChange, onRefresh, onReset, onExport }: FiltersBarProps) {
  const periodLabel = periodOptions.find((option) => option.value === filters.periodPreset)?.label || filters.periodPreset;
  const returnStatusLabel = filters.returnStatus === 'confirmed'
    ? 'Confirmadas'
    : filters.returnStatus === 'pending'
      ? 'Pendentes'
      : 'Todos';
  const returnTypeLabel = filters.returnType === 'total'
    ? 'Total'
    : filters.returnType === 'partial'
      ? 'Parcial'
      : filters.returnType === 'coleta'
        ? 'Coleta'
        : filters.returnType === 'sobra'
          ? 'Sobra'
          : 'Todos';
  const pickupStatusLabel = filters.pickupStatus === 'all'
    ? 'Todos'
    : filters.pickupStatus === 'PENDENTE'
      ? 'Pendente'
      : filters.pickupStatus === 'SOLICITADA'
        ? 'Solicitada'
        : filters.pickupStatus === 'EM_ROTA'
          ? 'Em rota'
          : filters.pickupStatus === 'COLETADA'
            ? 'Coletada'
            : 'Cancelada';

  const activeFilters: Array<{ key: string; label: string; onRemove: () => void }> = [
    ...(filters.search.trim() ? [{ key: 'search', label: `Busca: ${filters.search.trim()}`, onRemove: () => onChange({ search: '' }) }] : []),
    ...(filters.periodPreset !== '7d' ? [{
      key: 'periodPreset',
      label: filters.periodPreset === 'custom'
        ? `Período: ${filters.startDate || '-'} até ${filters.endDate || '-'}`
        : `Período: ${periodLabel}`,
      onRemove: () => onChange({ periodPreset: '7d', startDate: '', endDate: today }),
    }] : []),
    ...(filters.returnStatus !== 'all' ? [{ key: 'returnStatus', label: `Status devolução: ${returnStatusLabel}`, onRemove: () => onChange({ returnStatus: 'all' }) }] : []),
    ...(filters.returnType !== 'all' ? [{ key: 'returnType', label: `Tipo devolução: ${returnTypeLabel}`, onRemove: () => onChange({ returnType: 'all' }) }] : []),
    ...(filters.pickupStatus !== 'all' ? [{ key: 'pickupStatus', label: `Status coleta: ${pickupStatusLabel}`, onRemove: () => onChange({ pickupStatus: 'all' }) }] : []),
    ...(filters.city ? [{ key: 'city', label: `Cidade: ${filters.city}`, onRemove: () => onChange({ city: '' }) }] : []),
    ...(filters.route ? [{ key: 'route', label: `Rota: ${filters.route}`, onRemove: () => onChange({ route: '' }) }] : []),
    ...(filters.customer ? [{ key: 'customer', label: `Cliente: ${filters.customer}`, onRemove: () => onChange({ customer: '' }) }] : []),
    ...(filters.product ? [{ key: 'product', label: `Produto: ${filters.product}`, onRemove: () => onChange({ product: '' }) }] : []),
  ];

  return (
    <div className="sticky top-0 z-30 rounded-lg border border-slate-700/80 bg-[#0b1624]/95 p-3 shadow-[0_12px_26px_rgba(2,6,23,0.55)] backdrop-blur">
      <div className="grid gap-2 lg:grid-cols-[2fr_repeat(6,minmax(0,1fr))_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Buscar NF, cliente ou produto"
            className="border-accent/35 bg-[rgba(14,33,56,0.9)] pl-9 text-slate-100 focus:ring-accent/60"
          />
        </div>

        <select
          value={filters.periodPreset}
          onChange={(event) => onChange({ periodPreset: event.target.value as PeriodPreset })}
          className="h-10 rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
        >
          {periodOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <Input
          type="date"
          value={filters.startDate}
          onChange={(event) => onChange({ startDate: event.target.value, periodPreset: 'custom' })}
          className="border-accent/35 bg-[rgba(14,33,56,0.9)] text-slate-100 focus:ring-accent/60"
        />

        <Input
          type="date"
          value={filters.endDate}
          onChange={(event) => onChange({ endDate: event.target.value, periodPreset: 'custom' })}
          className="border-accent/35 bg-[rgba(14,33,56,0.9)] text-slate-100 focus:ring-accent/60"
        />

        <select
          value={filters.returnStatus}
          onChange={(event) => onChange({ returnStatus: event.target.value as ControlTowerFilters['returnStatus'] })}
          className="h-10 rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
        >
          <option value="all">Status devolução: todos</option>
          <option value="confirmed">Confirmadas</option>
          <option value="pending">Pendentes</option>
        </select>

        <select
          value={filters.pickupStatus}
          onChange={(event) => onChange({ pickupStatus: event.target.value as ControlTowerFilters['pickupStatus'] })}
          className="h-10 rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
        >
          <option value="all">Status coleta: todos</option>
          <option value="PENDENTE">Pendente</option>
          <option value="SOLICITADA">Solicitada</option>
          <option value="EM_ROTA">Em rota</option>
          <option value="COLETADA">Coletada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>

        <select
          value={filters.city}
          onChange={(event) => onChange({ city: event.target.value })}
          className="h-10 rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
        >
          <option value="">Cidade: todas</option>
          {options.cities.map((city) => <option key={city} value={city}>{city}</option>)}
        </select>

        <div className="flex items-center gap-2 lg:justify-end">
          <Button tone="secondary" className="bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={onRefresh} title="Atualizar">
            <RotateCw className="mr-1 h-4 w-4" />Atualizar
          </Button>
          <Button tone="secondary" className="bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={onReset} title="Limpar filtros">
            <FilterX className="mr-1 h-4 w-4" />Limpar
          </Button>
          <Button tone="secondary" className="bg-slate-800 text-slate-100 hover:bg-slate-700" onClick={onExport} title="Exportar CSV">
            <Download className="mr-1 h-4 w-4" />Exportar
          </Button>
        </div>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-4">
        <select
          value={filters.route}
          onChange={(event) => onChange({ route: event.target.value })}
          className="h-9 rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
        >
          <option value="">Rota: todas</option>
          {options.routes.map((route) => <option key={route} value={route}>{route}</option>)}
        </select>
        <select
          value={filters.customer}
          onChange={(event) => onChange({ customer: event.target.value })}
          className="h-9 rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
        >
          <option value="">Cliente: todos</option>
          {options.customers.map((customer) => <option key={customer} value={customer}>{customer}</option>)}
        </select>
        <select
          value={filters.product}
          onChange={(event) => onChange({ product: event.target.value })}
          className="h-9 rounded-sm border border-accent/35 bg-[rgba(14,33,56,0.9)] px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/60"
        >
          <option value="">Produto: todos</option>
          {options.products.map((product) => <option key={product} value={product}>{product}</option>)}
        </select>
        <div className="flex items-center justify-end text-xs text-slate-300">
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1">Atualizado há {updatedAgoLabel}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs ${activeFilters.length ? 'border-sky-700 bg-sky-950/50 text-sky-200' : 'border-slate-700 bg-slate-900 text-slate-300'}`}>
          {activeFilters.length ? `${activeFilters.length} filtro(s) ativo(s)` : 'Sem filtros ativos'}
        </span>
        {activeFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={filter.onRemove}
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 hover:border-slate-600"
            title="Remover este filtro"
          >
            {filter.label}
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default FiltersBar;
