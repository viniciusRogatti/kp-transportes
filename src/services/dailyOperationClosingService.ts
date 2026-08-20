import axios from 'axios';
import { API_URL } from '../data';

export type DailyOperationSummary = {
  opening_pending: number;
  received_today: number;
  total_notes_assigned: number;
  delivered: number;
  redelivery: number;
  returned: number;
  cancelled: number;
  retained: number;
  pending_route_completion: number;
  pending_receipts: number;
  pending_delivery: number;
  open_occurrences: number;
  routes: number;
  vehicles_used: number;
  total_weight: number;
  total_boxes: number;
  loading_minutes: number;
  loadings_informed: number;
};

export type DailyOperationRoute = {
  trip_id: number;
  run_number: number;
  company_name: string;
  driver_name: string;
  vehicle: string;
  license_plate: string;
  total_notes: number;
  total_weight: number;
  total_boxes: number;
  delivered: number;
  pending: number;
  duration_minutes: number | null;
  loading_notes: string;
  loading_updated_by: string | null;
};

export type PendingDelivery = {
  company_id: number;
  company_name: string;
  invoice_number: string;
  customer_name: string;
  city: string;
  status: string;
  invoice_date: string;
  pending_days: number;
  gross_weight: number;
  box_quantity: number;
};

export type CompanyOperationSummary = {
  company_id: number;
  company_name: string;
  total: number;
  delivered?: number;
  completed?: number;
  delivered_pending_receipt?: number;
  redelivery?: number;
  returned?: number;
  cancelled?: number;
  retained?: number;
  pending_delivery?: number;
};

export type DailyOperationReport = {
  operation_date: string;
  generated_at: string;
  status: 'draft' | 'closed';
  notes: string;
  closed_at: string | null;
  closed_by_name: string | null;
  summary: DailyOperationSummary;
  routes: DailyOperationRoute[];
  pending_deliveries: PendingDelivery[];
  companies: CompanyOperationSummary[];
};

export const getDailyOperationReport = async (date: string) => (
  await axios.get<DailyOperationReport>(`${API_URL}/api/daily-operation-closings`, { params: { date } })
).data;

export const saveLoadingDuration = async (date: string, tripId: number, durationMinutes: number, notes: string) => (
  await axios.put<DailyOperationReport>(`${API_URL}/api/daily-operation-closings/${date}/loadings/${tripId}`, {
    duration_minutes: durationMinutes,
    notes,
  })
).data;

export const saveDailyOperationNotes = async (date: string, notes: string) => (
  await axios.put<DailyOperationReport>(`${API_URL}/api/daily-operation-closings/${date}/notes`, { notes })
).data;

export const closeDailyOperation = async (date: string, notes: string) => (
  await axios.post<DailyOperationReport>(`${API_URL}/api/daily-operation-closings/${date}/close`, { notes })
).data;

export const reopenDailyOperation = async (date: string, reason: string) => (
  await axios.post<DailyOperationReport>(`${API_URL}/api/daily-operation-closings/${date}/reopen`, { reason })
).data;
