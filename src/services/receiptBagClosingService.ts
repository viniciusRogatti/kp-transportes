import axios from 'axios';
import { API_URL } from '../data';

export type ReceiptBagStatus = 'not_started' | 'in_progress' | 'completed' | 'completed_with_pending';
export type ReceiptBagItemStatus =
  | 'pending' | 'confirmed' | 'absent' | 'recovered' | 'resolved_elsewhere'
  | 'returned' | 'retained' | 'redelivery' | 'cancelled';

export type ReceiptBagCounts = {
  total: number;
  expected: number;
  confirmed: number;
  absent: number;
  pending: number;
  returned: number;
  recovered: number;
  extras: number;
};

export type ReceiptBagListRow = {
  bag_id: number | null;
  trip_id: number;
  company_id: number;
  operation_date: string;
  run_number: number;
  driver: { id: number; name: string } | null;
  car: { id: number; model: string; license_plate: string } | null;
  company: { id?: number; code?: string; name?: string } | null;
  status: ReceiptBagStatus;
  started_at: string | null;
  completed_at: string | null;
  counts: ReceiptBagCounts;
  is_overdue: boolean;
};

export type ReceiptBagItem = {
  id: number;
  origin_bag_id: number;
  confirmed_bag_id: number | null;
  trip_note_id: number | null;
  invoice_number: string;
  customer_name: string | null;
  city: string | null;
  route_order: number | null;
  status: ReceiptBagItemStatus;
  is_extra: boolean;
  is_suggested_extra: boolean;
  expected_driver_id: number;
  suggested_driver_id: number | null;
  suggested_driver_name: string | null;
  suggestion_source: string;
  suggestion_sender_name: string | null;
  suggestion_sender_phone: string | null;
  confirmed_at: string | null;
  absent_at: string | null;
  confirmed_elsewhere: boolean;
  confirmed_bag: {
    id: number;
    trip_id: number;
    driver_id: number;
    driver_name: string | null;
  } | null;
  origin_bag: {
    id: number;
    trip_id: number;
    driver_id: number;
    driver_name: string | null;
  } | null;
};

export type ReceiptBag = {
  id: number;
  company_id: number;
  trip_id: number;
  driver_id: number;
  operation_date: string;
  status: ReceiptBagStatus;
  started_at: string | null;
  completed_at: string | null;
  driver: { id: number; name: string } | null;
  car: { id: number; model: string; license_plate: string } | null;
  company: { id?: number; code?: string; name?: string } | null;
  run_number: number | null;
  counts: ReceiptBagCounts;
  items: ReceiptBagItem[];
};

export type ReceiptBagListResponse = {
  date: string;
  summary: {
    bags: number;
    expected: number;
    confirmed: number;
    pending_receipts: number;
    overdue_bags: number;
    completed_bags: number;
    divergent_bags: number;
  };
  rows: ReceiptBagListRow[];
};

export type ReceiptBagApiError = {
  error?: string;
  code?: string | null;
  details?: {
    bag_id?: number;
    trip_id?: number | null;
    driver_name?: string | null;
    confirmed_at?: string | null;
    unresolved?: number;
  } | null;
};

const authConfig = () => {
  const token = localStorage.getItem('token');
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const baseUrl = `${API_URL}/api/receipt-bag-closings`;

export const listReceiptBagClosings = async (date: string) => {
  const { data } = await axios.get<ReceiptBagListResponse>(
    `${baseUrl}?date=${encodeURIComponent(date)}`,
    authConfig(),
  );
  return data;
};

export const startReceiptBagClosing = async (tripId: number) => {
  const { data } = await axios.post<ReceiptBag>(`${baseUrl}/trips/${tripId}/start`, {}, authConfig());
  return data;
};

export const getReceiptBagClosing = async (bagId: number) => {
  const { data } = await axios.get<ReceiptBag>(`${baseUrl}/${bagId}`, authConfig());
  return data;
};

export const updateReceiptBagItem = async (
  bagId: number,
  itemId: number,
  action: 'confirm' | 'absent' | 'returned',
  options: { notes?: string; forceTransfer?: boolean } = {},
) => {
  const { data } = await axios.patch<ReceiptBag>(
    `${baseUrl}/${bagId}/items/${itemId}`,
    { action, ...options },
    authConfig(),
  );
  return data;
};

export const addExtraReceiptBagInvoice = async (
  bagId: number,
  invoiceNumber: string,
  forceTransfer = false,
) => {
  const { data } = await axios.post<ReceiptBag>(
    `${baseUrl}/${bagId}/items/extra`,
    { invoiceNumber, forceTransfer },
    authConfig(),
  );
  return data;
};

export const markRemainingReceiptBagItemsAbsent = async (bagId: number) => {
  const { data } = await axios.post<ReceiptBag>(
    `${baseUrl}/${bagId}/mark-remaining-absent`,
    {},
    authConfig(),
  );
  return data;
};

export const finishReceiptBagClosing = async (bagId: number) => {
  const { data } = await axios.post<ReceiptBag>(`${baseUrl}/${bagId}/finish`, {}, authConfig());
  return data;
};
