export type PeriodPreset = 'today' | '7d' | '30d' | 'custom';

export type BacklogStatus = 'PENDENTE' | 'SOLICITADA' | 'EM_ROTA' | 'COLETADA' | 'CANCELADA';
export type ReturnSourceType = 'total' | 'partial' | 'coleta' | 'sobra';
export type ReturnTypeFilter = 'all' | ReturnSourceType | 'faltante';
export type OccurrenceScope = 'invoice_total' | 'items';
export type OccurrenceReason = 'faltou_no_carregamento' | 'faltou_na_carga' | 'produto_avariado' | 'produto_invertido' | 'produto_sem_etiqueta_ou_data' | 'legacy_outros';

export interface ControlTowerFilters {
  search: string;
  invoiceNumber: string;
  periodPreset: PeriodPreset;
  startDate: string;
  endDate: string;
  returnStatus: 'all' | 'confirmed' | 'pending';
  returnType: ReturnTypeFilter;
  pickupStatus: 'all' | BacklogStatus;
  city: string;
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
  topProducts: TopDimension[];
  topClients: TopDimension[];
  topSurplusProducts: TopDimension[];
  topShortageProducts: TopDimension[];
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
  loadNumber?: string;
  isInversion?: boolean;
  inversionInvoiceNumber?: string;
  inversionMissingProductCode?: string;
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
  collectionRequestId?: string;
  collectionWorkflowStatus?: string;
  collectionDisplayStatus?: string;
  collectionQualityStatus?: string;
  relatedOccurrenceId?: number | null;
  ageHours: number;
  items: ReturnItem[];
  events: EventLog[];
}

export interface RegisterOccurrenceItemInput {
  product_id: string;
  product_description: string;
  product_type: string | null;
  quantity: number;
}

export interface RegisterControlTowerOccurrenceInput {
  collectionRequestId: string;
  reason: OccurrenceReason;
  scope: OccurrenceScope;
  items: RegisterOccurrenceItemInput[];
  description?: string;
  qualityNote?: string;
}

export interface ActionQueueItem {
  id: string;
  returnType: 'coleta';
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
  flowOrigin: 'devolucao' | 'ocorrencia';
  batchCode: string;
  invoiceNumber: string;
  returnType: ReturnSourceType | 'faltante' | 'nao_informado';
  loadNumber?: string;
  isInversion?: boolean;
  inversionInvoiceNumber?: string;
  inversionMissingProductCode?: string;
  customer: string;
  city: string;
  route: string;
  productCount: number;
  quantity: number;
  weightKg: number;
  valueAmount: number;
  reason: string;
  status: string;
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
