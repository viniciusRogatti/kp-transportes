import axios from 'axios';
import {
  IDriver,
  IReceiptUploadResponse,
  IReceiptBacklogResponse,
} from '../types/types';
import { API_URL } from '../data';

const getAuthConfig = () => {
  const token = localStorage.getItem('token');
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

type ReceiptListFilters = {
  nf?: string;
  motoristaId?: number | null;
  startDate?: string;
  endDate?: string;
  limit?: number;
  queueType?: string;
};

const toQueryParams = (filters: ReceiptListFilters = {}) => {
  const params = new URLSearchParams();

  if (filters.nf) params.set('nf', filters.nf);
  if (filters.motoristaId) params.set('motoristaId', String(filters.motoristaId));
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));
  if (filters.queueType) params.set('queueType', filters.queueType);

  return params;
};

export async function listReceiptBacklog(filters: ReceiptListFilters = {}): Promise<IReceiptBacklogResponse> {
  const params = toQueryParams(filters);
  const suffix = params.toString();
  const { data } = await axios.get<IReceiptBacklogResponse>(`${API_URL}/api/receipts/backlog${suffix ? `?${suffix}` : ''}`, getAuthConfig());
  return data;
}

export async function uploadReceipt(formData: FormData): Promise<IReceiptUploadResponse> {
  const { data } = await axios.post<IReceiptUploadResponse>(`${API_URL}/api/receipts`, formData, {
    ...getAuthConfig(),
    headers: {
      ...(getAuthConfig() as { headers?: Record<string, string> }).headers,
      'Content-Type': 'multipart/form-data',
    },
  });

  return data;
}

export async function listDriversForReceiptFilters(): Promise<IDriver[]> {
  const { data } = await axios.get<IDriver[]>(`${API_URL}/drivers`, getAuthConfig());
  return Array.isArray(data) ? data : [];
}
