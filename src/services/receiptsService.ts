import axios from 'axios';
import {
  IDriver,
  IPendingReceiptsListResponse,
  IReceiptUploadResponse,
  IReceiptsListResponse,
  IReceiptSignedUrlResponse,
  IReceiptWhatsappActivityListResponse,
} from '../types/types';
import { API_URL } from '../data';

type ReceiptListFilters = {
  nf?: string;
  motoristaId?: number | null;
  tripId?: number | null;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  includeUrls?: boolean;
  needsManualReview?: boolean;
  status?: string;
  group?: string;
};

const toQueryParams = (filters: ReceiptListFilters = {}) => {
  const params = new URLSearchParams();

  if (filters.nf) params.set('nf', filters.nf);
  if (filters.motoristaId) params.set('motoristaId', String(filters.motoristaId));
  if (filters.tripId) params.set('tripId', String(filters.tripId));
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));
  if (typeof filters.offset === 'number') params.set('offset', String(filters.offset));
  if (typeof filters.includeUrls === 'boolean') params.set('includeUrls', filters.includeUrls ? '1' : '0');
  if (typeof filters.needsManualReview === 'boolean') params.set('needsManualReview', filters.needsManualReview ? '1' : '0');
  if (filters.status) params.set('status', filters.status);
  if (filters.group) params.set('group', filters.group);

  return params;
};

export async function listPostedReceipts(filters: ReceiptListFilters = {}): Promise<IReceiptsListResponse> {
  const params = toQueryParams(filters);
  const { data } = await axios.get<IReceiptsListResponse>(`${API_URL}/api/receipts?${params.toString()}`);
  return data;
}

export async function listPendingReceipts(filters: ReceiptListFilters = {}): Promise<IPendingReceiptsListResponse> {
  const params = toQueryParams(filters);
  const { data } = await axios.get<IPendingReceiptsListResponse>(`${API_URL}/api/receipts/pending?${params.toString()}`);
  return data;
}

export async function listWhatsappReceiptActivity(
  filters: ReceiptListFilters = {},
): Promise<IReceiptWhatsappActivityListResponse> {
  const params = toQueryParams(filters);
  const { data } = await axios.get<IReceiptWhatsappActivityListResponse>(
    `${API_URL}/api/receipts/whatsapp-activity?${params.toString()}`,
  );
  return data;
}

export async function uploadReceipt(formData: FormData): Promise<IReceiptUploadResponse> {
  const { data } = await axios.post<IReceiptUploadResponse>(`${API_URL}/api/receipts`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return data;
}

export async function getReceiptSignedUrl(
  receiptId: number,
  options: { download?: boolean; filename?: string; expiresIn?: number } = {},
): Promise<IReceiptSignedUrlResponse> {
  const params = new URLSearchParams();
  if (options.download) params.set('download', '1');
  if (options.filename) params.set('filename', options.filename);
  if (typeof options.expiresIn === 'number') params.set('expiresIn', String(options.expiresIn));

  const suffix = params.toString();
  const { data } = await axios.get<IReceiptSignedUrlResponse>(
    `${API_URL}/api/receipts/${receiptId}/url${suffix ? `?${suffix}` : ''}`,
  );

  return data;
}

export async function listDriversForReceiptFilters(): Promise<IDriver[]> {
  const { data } = await axios.get<IDriver[]>(`${API_URL}/drivers`);
  return Array.isArray(data) ? data : [];
}
