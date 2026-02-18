export type PeriodPreset = 'today' | '7d' | '30d' | 'custom';

export type BacklogStatus = 'PENDENTE' | 'SOLICITADA' | 'EM_ROTA' | 'COLETADA' | 'CANCELADA';
export type ReturnSourceType = 'total' | 'partial' | 'coleta' | 'sobra';
export type ReturnTypeFilter = 'all' | ReturnSourceType;

export interface ControlTowerFilters {
  search: string;
  periodPreset: PeriodPreset;
  startDate: string;
  endDate: string;
  returnStatus: 'all' | 'confirmed' | 'pending';
  returnType: ReturnTypeFilter;
  pickupStatus: 'all' | BacklogStatus;
  city: string;
  route: string;
  customer: string;
  product: string;
}

export interface KpiMetric {
  id: 'confirmedReturns' | 'requestedPickups' | 'shortages' | 'surpluses';
  label: string;
  value: number;
  unit: 'count' | 'kg' | 'currency' | 'hours';
  variationPct: number;
  sparkline: number[];
  helpText: string;
}

export interface DashboardSummary {
  updatedAt: string;
  metrics: KpiMetric[];
}

export interface FlowSeriesPoint {
  date: string;
  confirmed: number;
  requested: number;
  completed: number;
}

export interface BacklogByStatus {
  status: BacklogStatus;
  count: number;
}

export interface TopDimension {
  name: string;
  quantity: number;
  weightKg: number;
  valueAmount: number;
}

export interface ReasonDistribution {
  reason: string;
  count: number;
}

export interface DashboardCharts {
  flowSeries: FlowSeriesPoint[];
  backlog: BacklogByStatus[];
  topProducts: TopDimension[];
  topClients: TopDimension[];
  reasons: ReasonDistribution[];
}

export interface EventLog {
  at: string;
  actor: string;
  action: string;
  note?: string;
}

export interface ReturnItem {
  productId: string;
  productDescription: string;
  productType: string;
  quantity: number;
  weightKg: number;
  valueAmount: number;
}

export interface ReturnBatch {
  id: string;
  batchCode: string;
  invoiceNumber: string;
  sourceType?: ReturnSourceType;
  customer: string;
  city: string;
  route: string;
  reason: string;
  status: BacklogStatus;
  createdAt: string;
  confirmedAt: string;
  pickupRequestedAt?: string;
  pickupCompletedAt?: string;
  pickupPriority?: boolean;
  ageHours: number;
  items: ReturnItem[];
  events: EventLog[];
}

export interface PickupRequest {
  id: string;
  returnId: string;
  status: BacklogStatus;
  scheduledFor?: string;
  notes?: string;
  updatedAt: string;
}

export interface ActionQueueItem {
  id: string;
  priority: 'critical' | 'high' | 'medium';
  pickupPriority: boolean;
  issue: string;
  batchId: string;
  invoiceNumber: string;
  customer: string;
  city: string;
  route: string;
  status: BacklogStatus;
  ageHours: number;
}

export interface ReturnsTableRow {
  id: string;
  batchCode: string;
  invoiceNumber: string;
  returnType: ReturnSourceType | 'nao_informado';
  customer: string;
  city: string;
  route: string;
  productCount: number;
  quantity: number;
  weightKg: number;
  valueAmount: number;
  reason: string;
  status: BacklogStatus;
  confirmedAt: string;
  ageHours: number;
}

export interface PaginationInput {
  pageIndex: number;
  pageSize: number;
}

export interface SortingInput {
  id: keyof ReturnsTableRow;
  desc: boolean;
}

export interface ReturnsTableResponse {
  rows: ReturnsTableRow[];
  total: number;
}
