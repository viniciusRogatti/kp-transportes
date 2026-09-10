import { IDanfe } from '../types/types';

export type PlannedRoute = { id: string; name: string; cities: string[] };
export type RouteSummary = PlannedRoute & { count: number; weight: number; presentCities: string[] };
export type RouteCatalog = { version: number; routes: PlannedRoute[] };
export type CityTransfer = { city: string; from: string; to: string };
export const normalizeRouteCity = (value: unknown) => String(value || '').replace(/&(?:amp;)?apos;|&#0?39;/gi, "'")
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const UNASSIGNED_ROUTE = '__unassigned__';

export function routeByCity(routes: PlannedRoute[]) {
  return Object.fromEntries(routes.flatMap((route) => route.cities.map((city) => [normalizeRouteCity(city), route.id])));
}

export function summarizeRoutes(danfes: IDanfe[], routes: PlannedRoute[]) {
  const owners = routeByCity(routes);
  const groups = routes.map((route) => ({ ...route, count: 0, weight: 0, presentCities: [] as string[] }));
  groups.push({ id: UNASSIGNED_ROUTE, name: 'Sem rota definida', cities: [], count: 0, weight: 0, presentCities: [] });
  const byId = new Map(groups.map((group) => [group.id, group]));
  const cityKeys = new Map(groups.map((group) => [group.id, new Set<string>()]));
  danfes.forEach((danfe) => {
    const city = danfe.Customer?.city || 'Cidade não informada';
    const key = normalizeRouteCity(city);
    const group = byId.get(owners[key] || UNASSIGNED_ROUTE)!;
    group.count += 1;
    const weight = Number(danfe.gross_weight);
    group.weight += Number.isFinite(weight) ? weight : 0;
    if (!cityKeys.get(group.id)!.has(key)) group.presentCities.push(city);
    cityKeys.get(group.id)!.add(key);
  });
  return groups;
}
