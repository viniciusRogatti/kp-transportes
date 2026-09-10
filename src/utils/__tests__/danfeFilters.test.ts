import { IDanfe } from '../../types/types';
import { createEmptyInvoiceListFilters, filterInvoiceListDanfes, filterTodayInvoiceDanfes } from '../danfeFilters';
import { normalizeRouteCity, routeByCity, summarizeRoutes, UNASSIGNED_ROUTE } from '../routeCatalog';
import { buildTodayInvoiceProductMatches } from '../todayInvoiceQuickSearch';
const rows = [
  { company_id: 1, invoice_number: '100', gross_weight: '15', Customer: { city: 'Limeira', name_or_legal_entity: 'Loja A' }, DanfeProducts: [{ Product: { code: '123', description: 'Peixe' }, quantity: 2 }] },
  { company_id: 2, invoice_number: '100', gross_weight: '20', Customer: { city: 'Rio Claro', name_or_legal_entity: 'Loja B' }, DanfeProducts: [{ Product: { code: '123', description: 'Peixe' }, quantity: 3 }] },
  { company_id: 1, invoice_number: '101', gross_weight: '30', Customer: { city: 'Araras', name_or_legal_entity: 'Loja C' }, DanfeProducts: [{ Product: { code: '456', description: 'Outro' } }] },
  { company_id: 1, invoice_number: '102', gross_weight: '5', Customer: { city: 'Outra', name_or_legal_entity: 'Loja D' }, DanfeProducts: [{ Product: { code: '123', description: 'Peixe' } }] },
] as unknown as IDanfe[];
const drivers = { '1::100': 'Jonas', '2::100': 'Diogo', '1::101': 'Renato', '1::102': 'Jonas' };
const routes = [{ id: 'limeira', name: 'Limeira', cities: ['Limeira', 'Rio Claro'] }, { id: 'araras', name: 'Araras', cities: ['Araras'] }];

test('combina múltiplas cidades, motoristas e rotas com produto em ambas as telas', () => {
  const filters = { ...createEmptyInvoiceListFilters(), driver: ['Jonas', 'Diogo', 'Renato'], city: ['Limeira', 'Rio Claro', 'Araras'], route: ['limeira', 'araras'], product: '123' };
  const options = { driverByInvoice: drivers, routeByCity: routeByCity(routes) };
  expect(filterInvoiceListDanfes(rows, filters, options)).toEqual(rows.slice(0, 2));
  expect(filterTodayInvoiceDanfes(rows, drivers, filters, undefined, options.routeByCity)).toEqual(rows.slice(0, 2));
  expect(buildTodayInvoiceProductMatches(filterInvoiceListDanfes(rows, { ...filters, driver: ['Diogo'] }, options), '123', { '2::100': { driverName: 'Diogo', tripId: 22 } })).toMatchObject([{ companyId: 2, driverName: 'Diogo', tripId: 22 }]);
});

test('normaliza acentos, hífen e entidades e mostra cidades com carga sem duplicar NF', () => {
  expect(normalizeRouteCity("Santa Bárbara d'Oeste")).toBe(normalizeRouteCity('Santa Barbara d&amp;apos;Oeste'));
  const groups = summarizeRoutes(rows, routes);
  expect(groups[0]).toMatchObject({ count: 2, weight: 35, presentCities: ['Limeira', 'Rio Claro'] });
  expect(groups[2]).toMatchObject({ id: UNASSIGNED_ROUTE, count: 1, weight: 5 });
  const moved = [{ ...routes[0], cities: ['Limeira'] }, { ...routes[1], cities: ['Araras', 'Rio Claro'] }];
  expect(summarizeRoutes(rows, moved)[1]).toMatchObject({ count: 2, weight: 50 });
});
