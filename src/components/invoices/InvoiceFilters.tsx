import { Dispatch, ReactNode, SetStateAction } from 'react';
import { InvoiceListFilters } from '../../utils/danfeFilters';
import { PlannedRoute, UNASSIGNED_ROUTE } from '../../utils/routeCatalog';
import MultiSelectFilter from './MultiSelectFilter';

type Props = { filters: InvoiceListFilters; setFilters: Dispatch<SetStateAction<InvoiceListFilters>>;
  cities: string[]; drivers: string[]; loads: string[]; routes: PlannedRoute[]; leadingFields?: ReactNode };

export default function InvoiceFilters({ filters, setFilters, cities, drivers, loads, routes, leadingFields }: Props) {
  const update = <K extends keyof InvoiceListFilters>(key: K, value: InvoiceListFilters[K]) => setFilters((old) => ({ ...old, [key]: value }));
  const choices = (values: string[]) => values.map((value) => ({ value, label: value }));
  return (
    <div className="space-y-2">
      <div className={`grid grid-cols-2 items-end gap-2 ${leadingFields ? 'lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]' : 'lg:grid-cols-3'}`}>
        {leadingFields}
        {([{ key: 'nf', label: 'NF', placeholder: 'Número da nota' }, { key: 'product', label: 'Produto', placeholder: 'Código ou descrição' },
          { key: 'customer', label: 'Cliente', placeholder: 'Nome do cliente' }] as const).map((field) => (
          <label key={field.key} className="min-w-0 text-xs font-medium text-text">{field.label}
            <input type="search" value={filters[field.key]} onChange={(event) => update(field.key, event.target.value)} placeholder={field.placeholder}
              className="mt-1 block h-9 w-full rounded-md border border-border bg-card px-3 text-text focus:outline-none focus:ring-2 focus:ring-accent" />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MultiSelectFilter label="Cidades" values={filters.city} options={choices(cities)} onChange={(value) => update('city', value)} />
        <MultiSelectFilter label="Motoristas" values={filters.driver} options={choices(drivers)} onChange={(value) => update('driver', value)} />
        <MultiSelectFilter label="Rotas" values={filters.route} options={[...routes.map((route) => ({ value: route.id, label: route.name })),
          { value: UNASSIGNED_ROUTE, label: 'Sem rota definida' }]} onChange={(value) => update('route', value)} />
        <MultiSelectFilter label="Cargas" values={filters.loadNumbers} options={choices(loads)} onChange={(value) => update('loadNumbers', value)} />
    </div>
    </div>
  );
}
