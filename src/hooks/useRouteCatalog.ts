import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '../data';
import { CityTransfer, PlannedRoute, RouteCatalog } from '../utils/routeCatalog';

export default function useRouteCatalog() {
  const client = useQueryClient();
  // Scope the cache by authenticated session; invoice company tabs are shippers,
  // while this catalog is shared by the carrier within its own database.
  const queryKey = ['route-catalog', localStorage.getItem('token')];
  const query = useQuery<RouteCatalog>({ queryKey,
    queryFn: async () => (await axios.get(`${API_URL}/api/route-catalog`)).data,
    staleTime: 30000,
  });
  async function save(routes: PlannedRoute[], version: number, transfers: CityTransfer[]) {
    const { data } = await axios.put<RouteCatalog>(`${API_URL}/api/route-catalog`, { routes, version, transfers });
    client.setQueryData(queryKey, data);
    return data;
  }
  return { ...query, data: query.data as RouteCatalog | undefined, save };
}
