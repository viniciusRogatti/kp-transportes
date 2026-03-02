import axios from 'axios';
import {
  IAlertRow,
  IAlertsListResponse,
} from '../types/types';
import { API_URL } from '../data';

type AlertsFilters = {
  status?: 'OPEN' | 'RESOLVED' | 'ALL';
  code?: string;
  nf?: string;
  limit?: number;
};

export async function listAlerts(filters: AlertsFilters = {}): Promise<IAlertsListResponse> {
  const params = new URLSearchParams();

  if (filters.status) params.set('status', filters.status);
  if (filters.code) params.set('code', filters.code);
  if (filters.nf) params.set('nf', filters.nf);
  if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));

  const suffix = params.toString();
  const { data } = await axios.get<IAlertsListResponse>(`${API_URL}/api/alerts${suffix ? `?${suffix}` : ''}`);

  return {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    total: Number(data?.total || 0),
    limit: Number(data?.limit || filters.limit || 80),
  };
}

export async function resolveAlert(alertId: number): Promise<IAlertRow> {
  const { data } = await axios.patch<IAlertRow>(`${API_URL}/api/alerts/${alertId}/resolve`);
  return data;
}
