import axios from 'axios';
import { API_URL } from '../../data';

export const exclusionReasons = { not_taken: 'Não foi nesta viagem', photo_unknown: 'Não consegui confirmar na foto' } as const;
export type ExclusionReason = keyof typeof exclusionReasons;
export type TrainingStop = { id: string; key: string; customer: string; address: string; invoice: string; companyId: number; weightKg: number | null; baseKey?: string; separateDelivery?: boolean };
export type ExampleSummary = { id: number; tripId: number; companyId: number; driverId: number; driverName: string; operationDate: string; routeName: string; version: number; updatedAt: string; includedCount: number; excludedCount: number };
export type TrainingTrip = {
  trip: { id: number; companyId: number; driverId: number; driverName: string; operationDate: string };
  sourceRevision: string; stops: TrainingStop[];
  example: (ExampleSummary & { sourceChanged: boolean; snapshot: { stopIds: number[]; separatedStopIds: number[]; exclusions: { stopId: number; reason: ExclusionReason }[]; note: string } }) | null;
};
export type TrainingPayload = { clientEventId: string; expectedVersion: number; sourceRevision: string; routeName: string; stopIds: number[]; separatedStopIds: number[]; exclusions: { stopId: number; reason: ExclusionReason }[]; note: string };
export type CoverageVisit = { key: string; customer: string; customerId: string; companyId: number; address: string; invoices: string[]; stopIds: number[]; state: 'needs_sequence' | 'check_identity' };
export type CoverageItem = { tripId: number; companyId: number; driverId: number; driverName: string; operationDate: string; routeName: string; exampleVersion: number | null;
  totalVisits: number; referencedCount: number; missingCount: number; identityCount: number; missing: CoverageVisit[]; truncated: boolean; explanation: string;
  trainingExample: { id: number; tripId: number; version: number; routeName: string } | null;
};
export type CoveragePage = { items: CoverageItem[]; nextCursor: number | null; dateFrom: string; dateTo: string; referenceDate: string; generatedAt: string };
export type CoverageQuery = { dateFrom: string; dateTo: string; referenceDate: string; tripId?: string; before?: number };
const url = `${API_URL}/astro-training`;
export const trainingApi = {
  async coverage(params: CoverageQuery) {
    return (await axios.get<CoveragePage>(`${url}/coverage`, { params, timeout: 60000 })).data;
  },
  async trip(id: string): Promise<TrainingTrip> {
    const { data } = await axios.get<TrainingTrip>(`${url}/trips/${encodeURIComponent(id)}`);
    // The backend uses numeric IDs; the editor uses stable string IDs, as in the app.
    return { ...data, stops: data.stops.map(stop => ({ ...stop, id: String(stop.id) })), example: data.example ? { ...data.example, snapshot: { ...data.example.snapshot, separatedStopIds: data.example.snapshot.separatedStopIds || [] } } : null };
  },
  async list(before?: number) {
    return (await axios.get<{ items: ExampleSummary[]; nextCursor: number | null }>(`${url}/examples`, { params: before ? { before } : {} })).data;
  },
  async save(id: number, payload: TrainingPayload) {
    const { data } = await axios.put<{ accepted: boolean; version: number; exampleId: number }>(`${url}/trips/${id}/example`, payload, { timeout: 20000 });
    if (data.accepted !== true || !Number.isSafeInteger(data.version) || data.version < 1) throw new Error('A base não confirmou o salvamento. Tente novamente para conferir o mesmo pedido.');
    return data;
  },
};
export function trainingError(cause: unknown) {
  if (axios.isAxiosError(cause)) return cause.response?.data?.message || 'Não foi possível acessar a base. Confira a conexão e tente novamente.';
  return cause instanceof Error ? cause.message : 'Não foi possível concluir esta ação.';
}
