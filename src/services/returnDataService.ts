import axios from 'axios';
import { API_URL } from '../data';

export type ReturnDataApprovalStatus = 'approved' | 'rejected' | 'unknown';
export type ReturnDataType = 'total' | 'partial' | 'collection' | 'surplus' | 'weight_break' | 'unclassified';

export type ReturnRegistryItem = {
  id?: number;
  product_description: string;
  product_value: number | null;
};

export type ReturnRegistryOccurrence = {
  id: number;
  source_occurrence_id: string;
  invoice_number: string;
  invoice_number_normalized: string;
  invoice_total_value: number | null;
  invoice_issued_at: string | null;
  customer_name: string | null;
  customer_tax_id: string | null;
  seller_name: string | null;
  return_reason_raw: string | null;
  return_reason_category: string;
  return_justification: string | null;
  approval_justification: string | null;
  approval_status: ReturnDataApprovalStatus;
  carrier_name: string | null;
  redelivery_carrier_name: string | null;
  inferred_return_type: ReturnDataType;
  return_type_source: 'inferred' | 'unclassified' | string;
  first_seen_at: string;
  last_seen_at: string;
  linked_batch_code: string | null;
  internal_return_type?: string | null;
  items: ReturnRegistryItem[];
};

export type ReturnDataImport = {
  id: number;
  original_file_name: string;
  file_sha256: string;
  file_size: number;
  import_status: string;
  imported_by_username: string | null;
  imported_at: string;
  confirmed_at: string | null;
  detected_start_date: string | null;
  detected_end_date: string | null;
  total_rows: number;
  total_occurrences: number;
  created_occurrences: number;
  updated_occurrences: number;
  unchanged_occurrences: number;
  invalid_occurrences: number;
  warnings_count: number;
  errors_count: number;
  summary_json?: ReturnDataImportPreview | null;
};

export type ReturnDataImportIssue = {
  row?: number;
  code: string;
  message: string;
  source_occurrence_id?: string;
};

export type ReturnDataImportPreview = {
  duplicate_file: boolean;
  message?: string;
  file_name?: string;
  file_size?: number;
  file_sha256: string;
  existing_import?: ReturnDataImport;
  worksheet_name?: string;
  missing_columns?: string[];
  total_rows?: number;
  total_occurrences?: number;
  approved_count?: number;
  rejected_count?: number;
  unknown_status_count?: number;
  created_occurrences?: number;
  updated_occurrences?: number;
  unchanged_occurrences?: number;
  invalid_occurrences?: number;
  warnings_count?: number;
  errors_count?: number;
  detected_start_date?: string | null;
  detected_end_date?: string | null;
  repeated_invoices?: Array<{ invoice_number: string; occurrences: number }>;
  other_carriers?: string[];
  formulas_count?: number;
  warnings?: ReturnDataImportIssue[];
  errors?: ReturnDataImportIssue[];
  sample_occurrences?: Array<{
    source_occurrence_id: string;
    invoice_number: string;
    approval_status: ReturnDataApprovalStatus;
    customer_name: string | null;
    return_reason_category: string;
    items_count: number;
  }>;
};

export type ReturnDataFilters = {
  invoice_number?: string;
  source_occurrence_id?: string;
  customer?: string;
  seller?: string;
  product?: string;
  reason?: string;
  approval_status?: string;
  return_type?: string;
  carrier?: string;
  start_date?: string;
  end_date?: string;
  linked?: string;
  page?: number;
  limit?: number;
};

export type ReturnDataOverview = {
  metrics: {
    total_occurrences: number;
    distinct_invoices: number;
    approved_occurrences: number;
    rejected_occurrences: number;
    unknown_occurrences: number;
    approval_rate: number;
    involved_value: number;
    distinct_customers: number;
    unlinked_occurrences: number;
  };
  charts: Record<string, Array<{ label: string; count: number }>>;
  latest_import: ReturnDataImport | null;
};

export type InvoiceReturnDataLookup = {
  invoice_number: string;
  invoice_number_normalized: string;
  consolidated_status: 'approved' | 'registered_without_approval' | 'not_found';
  total_occurrences: number;
  approved_count: number;
  rejected_count: number;
  latest_base_update: string | null;
  occurrences: ReturnRegistryOccurrence[];
};

const compactParams = (filters: ReturnDataFilters) => Object.fromEntries(
  Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined && value !== null),
);

export const previewReturnDataImport = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await axios.post<ReturnDataImportPreview>(
    `${API_URL}/return-data/imports/preview`,
    formData,
  );
  return data;
};

export const confirmReturnDataImport = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await axios.post(
    `${API_URL}/return-data/imports/confirm`,
    formData,
  );
  return data;
};

export const listReturnDataImports = async () => {
  const { data } = await axios.get<ReturnDataImport[]>(`${API_URL}/return-data/imports`);
  return data;
};

export const listReturnRegistryOccurrences = async (filters: ReturnDataFilters) => {
  const { data } = await axios.get<{
    rows: ReturnRegistryOccurrence[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>(`${API_URL}/return-data/occurrences`, { params: compactParams(filters) });
  return data;
};

export const getReturnDataOverview = async (filters: ReturnDataFilters = {}) => {
  const { data } = await axios.get<ReturnDataOverview>(
    `${API_URL}/return-data/occurrences/overview`,
    { params: compactParams(filters) },
  );
  return data;
};

export const getReturnDataByInvoice = async (invoiceNumber: string) => {
  const { data } = await axios.get<InvoiceReturnDataLookup>(
    `${API_URL}/return-data/occurrences/by-invoice/${encodeURIComponent(invoiceNumber)}`,
  );
  return data;
};

export const getReturnRegistryOccurrenceHistory = async (id: number) => {
  const { data } = await axios.get(`${API_URL}/return-data/occurrences/${id}/history`);
  return data;
};

export const exportReturnRegistryOccurrences = async (filters: ReturnDataFilters) => {
  const response = await axios.get(`${API_URL}/return-data/occurrences/export`, {
    params: compactParams(filters),
    responseType: 'blob',
  });
  const disposition = String(response.headers['content-disposition'] || '');
  const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    || `base-de-devolucoes-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
