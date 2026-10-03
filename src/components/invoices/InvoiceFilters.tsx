import { Dispatch, ReactNode, SetStateAction } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { InvoiceListFilters } from '../../utils/danfeFilters';
import { PlannedRoute, UNASSIGNED_ROUTE } from '../../utils/routeCatalog';
import MultiSelectFilter from './MultiSelectFilter';

type Props = { filters: InvoiceListFilters; setFilters: Dispatch<SetStateAction<InvoiceListFilters>>;
  cities: string[]; drivers: string[]; loads: string[]; routes: PlannedRoute[]; leadingFields?: ReactNode;
  progressive?: boolean; expanded?: boolean; onExpandedChange?: (value: boolean) => void };

export default function InvoiceFilters({ filters, setFilters, cities, drivers, loads, routes, leadingFields, progressive = false, expanded = false, onExpandedChange }: Props) {
  const update = <K extends keyof InvoiceListFilters>(key: K, value: InvoiceListFilters[K]) => setFilters((old) => ({ ...old, [key]: value }));
  const choices = (values: string[]) => values.map((value) => ({ value, label: value }));
  const fields = [{ key: 'nf', label: 'NF', placeholder: progressive ? 'Número' : 'Número da nota' },
    { key: 'product', label: 'Produto', placeholder: 'Código ou descrição' },
    { key: 'customer', label: 'Cliente', placeholder: progressive ? 'Buscar cliente' : 'Nome do cliente' }] as const;
  const orderedFields = progressive ? [fields[1], fields[0], fields[2]] : fields;
  return (
    <div className="space-y-2">
      <div className={progressive ? 'invoice-search-grid' : `grid grid-cols-2 items-end gap-2 ${leadingFields ? 'lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]' : 'lg:grid-cols-3'}`}>
        {leadingFields}
        {orderedFields.map((field) => (
          <label key={field.key} className={`min-w-0 text-xs font-medium text-text ${progressive ? `invoice-search-label invoice-search-${field.key}` : ''}`}>{field.label}
            <span className={progressive ? `invoice-search-control${filters[field.key] ? ' has-value' : ''}` : 'block'}>
            {progressive && <Search aria-hidden="true" size={16} className="invoice-search-icon" />}
            <input aria-label={field.label} type="search" inputMode={field.key === 'nf' ? 'numeric' : 'search'} enterKeyHint="search" autoComplete="off" value={filters[field.key]} onChange={(event) => update(field.key, event.target.value)} placeholder={field.placeholder}
              className={progressive ? 'workspace-field mt-1 block' : 'mt-1 block h-9 w-full rounded-md border border-border bg-card px-3 text-text focus:outline-none focus:ring-2 focus:ring-accent'} />
            {progressive && filters[field.key] && <button type="button" aria-label={`Limpar ${field.label.toLowerCase()}`} className="invoice-search-clear" onClick={(event) => {
              event.preventDefault();
              event.currentTarget.parentElement?.querySelector('input')?.focus();
              update(field.key, '');
            }}><X size={16} aria-hidden="true" /></button>}
            </span>
          </label>
        ))}
      </div>
      {progressive && <button type="button" className="workspace-button" aria-expanded={expanded} aria-controls="today-additional-filters" onClick={() => onExpandedChange?.(!expanded)}>
        <SlidersHorizontal size={16} aria-hidden="true" />
        {expanded ? 'Recolher filtros' : 'Mais filtros'}
        {filters.city.length + filters.driver.length + filters.route.length + filters.loadNumbers.length + Number(Boolean(filters.status)) > 0 && <span className="rounded-full bg-surface-2 px-2">{filters.city.length + filters.driver.length + filters.route.length + filters.loadNumbers.length + Number(Boolean(filters.status))}</span>}
      </button>}
      <div id={progressive ? 'today-additional-filters' : undefined} hidden={progressive && !expanded}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MultiSelectFilter label="Cidades" values={filters.city} options={choices(cities)} onChange={(value) => update('city', value)} />
        <MultiSelectFilter label="Motoristas" values={filters.driver} options={choices(drivers)} onChange={(value) => update('driver', value)} />
        <MultiSelectFilter label="Rotas" values={filters.route} options={[...routes.map((route) => ({ value: route.id, label: route.name })),
          { value: UNASSIGNED_ROUTE, label: 'Sem rota definida' }]} onChange={(value) => update('route', value)} />
        <MultiSelectFilter label="Cargas" values={filters.loadNumbers} options={choices(loads)} onChange={(value) => update('loadNumbers', value)} />
    </div>
    </div>
    </div>
  );
}
