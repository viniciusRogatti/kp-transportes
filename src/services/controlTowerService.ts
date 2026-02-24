import axios from 'axios';
import {
  addDays,
  differenceInHours,
  eachDayOfInterval,
  endOfDay,
  format,
  startOfDay,
  subDays,
} from 'date-fns';
import {
  ActionQueueItem,
  BacklogStatus,
  ControlTowerFilters,
  DashboardCharts,
  DashboardSummary,
  EventLog,
  PaginationInput,
  RegisterControlTowerOccurrenceInput,
  ReasonDistribution,
  ReturnBatch,
  ReturnItem,
  ReturnSourceType,
  ReturnsTableRow,
  ReturnsTableResponse,
  SortingInput,
  TopDimension,
} from '../types/controlTower';
import { API_URL } from '../data';
import { ICollectionRequest, IControlTowerReturn, IOccurrence } from '../types/types';
import { formatDateBR } from '../utils/dateDisplay';
import { normalizeTextValue } from '../utils/textNormalization';

const STATUS_ORDER: BacklogStatus[] = ['PENDENTE', 'SOLICITADA', 'EM_ROTA', 'COLETADA', 'CANCELADA'];
const RETURN_TYPES: ReturnSourceType[] = ['total', 'partial', 'coleta', 'sobra'];
const CONTROL_TOWER_OCCURRENCE_RESOLUTION = 'talao_mercadoria_faltante';
const PRODUCT_TYPES = ['CX', 'UN', 'PCT', 'KG'];
const CITIES = ['Sao Paulo', 'Santos', 'Campinas', 'Guarulhos', 'Sorocaba', 'Ribeirao Preto'];
const ROUTES = ['SP-CAPITAL', 'SP-LITORAL', 'SP-INTERIOR', 'SP-METRO'];
const PRODUCTS = [
  'Camarao Rosa 30/40',
  'Salmao em Posta',
  'Tilapia File Premium',
  'Cream Cheese 1,5kg',
  'Gyoza Suino 490g',
  'Lula em Aneis',
  'Atum Lombo',
  'Bacalhau Dessalgado',
  'Pescada Branca',
  'Polvo Congelado',
];
const CUSTOMERS = [
  'Mercado Atlantico',
  'Supermar Azul',
  'Distribuidora Costa Sul',
  'Emporio do Mar',
  'Rede Bom Peixe',
  'Atacado Oceano',
  'Mercantil Rota Fria',
  'Comercial Porto Norte',
  'Casa dos Pescados',
  'Varejo Mare Alta',
];

const CONTROL_TOWER_DATA_MODE = String(process.env.REACT_APP_CONTROL_TOWER_DATA_MODE || '').trim().toLowerCase() === 'mock'
  ? 'mock'
  : 'api';

type FilterOptions = {
  customers: string[];
  cities: string[];
  products: string[];
};

interface LocalReturnOverlay {
  status?: BacklogStatus;
  pickupRequestedAt?: string;
  pickupCompletedAt?: string;
  pickupPriority?: boolean;
  events: EventLog[];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pick<T>(arr: T[], seed: number) {
  return arr[Math.floor(seededRandom(seed) * arr.length) % arr.length];
}

function buildEvents(baseDate: Date, status: BacklogStatus): EventLog[] {
  const events: EventLog[] = [
    {
      at: baseDate.toISOString(),
      actor: 'Sistema',
      action: 'Devolucao confirmada',
      note: 'Lote registrado na torre de controle',
    },
  ];

  if (status !== 'PENDENTE') {
    events.push({
      at: addDays(baseDate, 0).toISOString(),
      actor: 'Torre',
      action: 'Coleta solicitada',
    });
  }

  if (status === 'EM_ROTA' || status === 'COLETADA') {
    events.push({
      at: addDays(baseDate, 1).toISOString(),
      actor: 'Expedicao',
      action: 'Marcado em rota',
    });
  }

  if (status === 'COLETADA') {
    events.push({
      at: addDays(baseDate, 2).toISOString(),
      actor: 'Conferente',
      action: 'Coleta concluida',
    });
  }

  if (status === 'CANCELADA') {
    events.push({
      at: addDays(baseDate, 1).toISOString(),
      actor: 'Torre',
      action: 'Solicitacao cancelada',
      note: 'Cliente reabastecido',
    });
  }

  return events;
}

function buildItems(seedBase: number): ReturnItem[] {
  const count = 1 + Math.floor(seededRandom(seedBase) * 4);
  const items: ReturnItem[] = [];

  for (let i = 0; i < count; i += 1) {
    const product = pick(PRODUCTS, seedBase + i * 5);
    const quantity = Math.max(1, Math.floor(seededRandom(seedBase + i * 11) * 24));
    const weightKg = Number((quantity * (0.6 + seededRandom(seedBase + i * 17) * 2.5)).toFixed(2));
    const valueAmount = Number((weightKg * (18 + seededRandom(seedBase + i * 23) * 24)).toFixed(2));
    items.push({
      productId: `PR${String(1000 + ((seedBase + i) % 9000))}`,
      productDescription: product,
      productType: pick(PRODUCT_TYPES, seedBase + i * 13),
      quantity,
      weightKg,
      valueAmount,
    });
  }

  return items;
}

function generateMockData(total = 320): ReturnBatch[] {
  const now = new Date();
  const rows: ReturnBatch[] = [];

  for (let i = 0; i < total; i += 1) {
    const dayOffset = Math.floor(seededRandom(i + 1) * 45);
    const created = subDays(now, dayOffset);
    const status = pick(STATUS_ORDER, i * 7 + 3);
    const items = buildItems(i + 31);
    const sourceType = pick(RETURN_TYPES, i * 19 + 2);
    const reason = mapReturnTypeReason(sourceType);
    const customer = pick(CUSTOMERS, i * 17 + 5);
    const city = pick(CITIES, i * 29 + 9);
    const route = pick(ROUTES, i * 37 + 1);
    const pickupRequestedAt = status === 'PENDENTE' ? undefined : addDays(created, 0.2).toISOString();
    const pickupCompletedAt = status === 'COLETADA' ? addDays(created, 1.5).toISOString() : undefined;
    const ageHours = Math.max(1, differenceInHours(now, created));

    rows.push({
      id: `ret-${i + 1}`,
      batchCode: `RET-${format(created, 'yyyyMMdd')}-${String((i % 90) + 10).padStart(2, '0')}`,
      invoiceNumber: String(400000 + (i * 13) % 99999),
      sourceType,
      customer,
      city,
      route,
      reason,
      status,
      createdAt: created.toISOString(),
      confirmedAt: addDays(created, 0.1).toISOString(),
      pickupRequestedAt,
      pickupCompletedAt,
      ageHours,
      items,
      events: buildEvents(created, status),
    });
  }

  return rows;
}

const MOCK_FILTER_OPTIONS: FilterOptions = {
  customers: CUSTOMERS,
  cities: CITIES,
  products: PRODUCTS,
};

let returnsStore: ReturnBatch[] = CONTROL_TOWER_DATA_MODE === 'mock' ? generateMockData() : [];
let lastBaseRows: ReturnBatch[] = CONTROL_TOWER_DATA_MODE === 'mock' ? returnsStore : [];
let lastResolvedRows: ReturnBatch[] = CONTROL_TOWER_DATA_MODE === 'mock' ? returnsStore : [];
let filterOptionsStore: FilterOptions = CONTROL_TOWER_DATA_MODE === 'mock'
  ? MOCK_FILTER_OPTIONS
  : { customers: [], cities: [], products: [] };

const localOverlayStore = new Map<string, LocalReturnOverlay>();
const inflightApiLoads = new Map<string, Promise<ReturnBatch[]>>();
let shortagesStore: IOccurrence[] = [];
let inflightShortagesLoad: Promise<IOccurrence[]> | null = null;
let shortagesFetchedAt = 0;
const SHORTAGES_CACHE_MS = 30 * 1000;
const occurrenceCacheStore = new Map<string, IOccurrence[]>();
const occurrenceCacheFetchedAt = new Map<string, number>();
const inflightOccurrenceLoads = new Map<string, Promise<IOccurrence[]>>();
const OCCURRENCES_CACHE_MS = 30 * 1000;

function getInterval(filters: ControlTowerFilters) {
  const now = new Date();
  const isCustomPreset = filters.periodPreset === 'custom';
  const end = isCustomPreset && filters.endDate ? endOfDay(new Date(filters.endDate)) : endOfDay(now);
  const start = isCustomPreset
    ? filters.startDate
      ? startOfDay(new Date(filters.startDate))
      : startOfDay(subDays(end, 6))
    : filters.periodPreset === 'today'
      ? startOfDay(now)
      : filters.periodPreset === '7d'
        ? startOfDay(subDays(now, 6))
        : filters.periodPreset === '30d'
          ? startOfDay(subDays(now, 29))
          : startOfDay(subDays(now, 6));

  return { start, end };
}

function normalizeText(value: unknown) {
  return normalizeTextValue(value);
}

function normalizeInvoiceNumber(value: unknown) {
  return normalizeText(value).replace(/\D/g, '');
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoDateTime(value: unknown, fallbackIso = new Date().toISOString()) {
  const raw = normalizeText(value);
  if (!raw) return fallbackIso;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T12:00:00.000Z`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return fallbackIso;
  return parsed.toISOString();
}

function inferRoute(city: string) {
  const normalized = normalizeText(city).toUpperCase();
  if (!normalized || normalized === 'N/A' || normalized === 'NAO INFORMADO') return 'SEM ROTA';
  if (normalized.includes('SANTOS') || normalized.includes('GUARUJA') || normalized.includes('SAO VICENTE') || normalized.includes('PRAIA GRANDE')) {
    return 'SP-LITORAL';
  }
  if (normalized.includes('SAO PAULO')) return 'SP-CAPITAL';
  if (normalized.includes('GUARULHOS') || normalized.includes('OSASCO') || normalized.includes('SANTO ANDRE') || normalized.includes('SAO BERNARDO')) {
    return 'SP-METRO';
  }
  return 'SP-INTERIOR';
}

function mapReturnTypeReason(returnType: ReturnSourceType) {
  const labels: Record<ReturnSourceType, string> = {
    total: 'Devolucao total',
    partial: 'Devolucao parcial',
    sobra: 'Sobra',
    coleta: 'Coleta',
  };

  return labels[returnType] || 'Nao informado';
}

function mapOccurrenceReasonLabel(reason?: string | null) {
  const normalized = normalizeText(reason).toLowerCase();
  if (normalized === 'faltou_no_carregamento') return 'Faltou no carregamento';
  if (normalized === 'faltou_na_carga') return 'Faltou na carga';
  if (normalized === 'produto_avariado') return 'Produto avariado';
  if (normalized === 'produto_invertido') return 'Produto invertido';
  if (normalized === 'produto_sem_etiqueta_ou_data') return 'Produto sem etiqueta ou data';
  if (normalized === 'legacy_outros') return 'Outros';
  return normalizeText(reason) || 'Ocorrência';
}

function mapOccurrenceTableStatus(occurrence: IOccurrence) {
  const status = normalizeText(occurrence.status).toLowerCase();
  const resolutionType = normalizeText(occurrence.resolution_type).toLowerCase();
  const creditStatus = normalizeText(occurrence.credit_status).toLowerCase();

  if (status !== 'resolved') {
    return 'PENDENTE_TRANSPORTADORA';
  }

  if (resolutionType === 'talao_mercadoria_faltante') {
    if (creditStatus === 'completed') {
      return 'CREDITO_CONCLUIDO';
    }
    return 'PENDENTE_CREDITO';
  }

  return 'FINALIZADA';
}

function isControlTowerOccurrence(occurrence: IOccurrence) {
  const status = normalizeText(occurrence.status).toLowerCase();
  const resolutionType = normalizeText(occurrence.resolution_type).toLowerCase();
  return status === 'resolved' && resolutionType === CONTROL_TOWER_OCCURRENCE_RESOLUTION;
}

function mapCollectionStatus(collection: ICollectionRequest): BacklogStatus {
  const normalizedWorkflow = normalizeText(
    collection.display_status === 'em_tratativa'
      ? 'recebida'
      : collection.workflow_status || collection.status,
  ).toLowerCase();

  if (normalizedWorkflow === 'cancelada' || normalizedWorkflow === 'cancelled') {
    return 'CANCELADA';
  }

  if (normalizedWorkflow === 'aceita_agendada') {
    return 'EM_ROTA';
  }

  if (['coletada', 'enviada_em_lote', 'recebida', 'completed'].includes(normalizedWorkflow)) {
    return 'COLETADA';
  }

  return 'SOLICITADA';
}

function mapCollectionQueueIssue(status: BacklogStatus) {
  if (status === 'SOLICITADA') {
    return 'Coleta solicitada aguardando aceite/agendamento';
  }
  if (status === 'EM_ROTA') {
    return 'Coleta agendada aguardando retirada';
  }
  return 'Coletada (nao enviada)';
}

function isCollectionInActionQueue(collection: ICollectionRequest) {
  const workflowStatus = normalizeText(collection.workflow_status || collection.status).toLowerCase();
  return ['solicitada', 'aceita_agendada', 'coletada'].includes(workflowStatus);
}

function mapReturnStatusWithoutCollection(note: IControlTowerReturn): BacklogStatus {
  const normalizedWorkflow = normalizeText(note.workflow_status).toLowerCase();

  if (normalizedWorkflow === 'finalized' || normalizeText(note.received_by_control_tower_at)) {
    return 'COLETADA';
  }

  if (normalizedWorkflow === 'awaiting_control_tower' || normalizeText(note.sent_to_control_tower_at)) {
    return 'SOLICITADA';
  }

  return 'PENDENTE';
}

function parseOccurrenceDate(occurrence: IOccurrence): Date | null {
  const raw = normalizeText(occurrence.resolved_at || occurrence.created_at);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isSurplusRow(row: ReturnBatch) {
  const reason = normalizeText(row.reason).toLowerCase();
  return row.sourceType === 'sobra' || reason === 'sobra' || reason.includes('sobra');
}

function occurrenceContainsProduct(occurrence: IOccurrence, productTerm: string) {
  const term = productTerm.toLowerCase();
  const direct = `${normalizeText(occurrence.product_id)} ${normalizeText(occurrence.product_description)} ${normalizeText(occurrence.product_type)}`.toLowerCase();
  if (direct.includes(term)) return true;

  const items = Array.isArray(occurrence.items) ? occurrence.items : [];
  return items.some((item) => {
    const haystack = `${normalizeText(item.product_id)} ${normalizeText(item.product_description)} ${normalizeText(item.product_type)}`.toLowerCase();
    return haystack.includes(term);
  });
}

function filterShortageOccurrences(
  occurrences: IOccurrence[],
  filters: ControlTowerFilters,
  start: Date,
  end: Date,
  options?: { ignoreDateRange?: boolean },
) {
  const exactInvoice = extractExactInvoiceFilter(filters.search, filters.invoiceNumber);
  const term = exactInvoice ? '' : normalizeText(filters.search).toLowerCase();
  const product = normalizeText(filters.product).toLowerCase();
  const ignoreDateRange = Boolean(options?.ignoreDateRange || exactInvoice);

  return occurrences.filter((occurrence) => {
    const occurrenceDate = parseOccurrenceDate(occurrence);
    if (!occurrenceDate) return false;
    if (!ignoreDateRange && (occurrenceDate < start || occurrenceDate > end)) return false;

    if (exactInvoice && normalizeInvoiceNumber(occurrence.invoice_number) !== exactInvoice) return false;

    if (filters.city && normalizeText(occurrence.city).toUpperCase() !== normalizeText(filters.city).toUpperCase()) return false;
    if (filters.customer && normalizeText(occurrence.customer_name).toUpperCase() !== normalizeText(filters.customer).toUpperCase()) return false;
    if (product && !occurrenceContainsProduct(occurrence, product)) return false;

    if (term) {
      const itemTerms = (Array.isArray(occurrence.items) ? occurrence.items : [])
        .map((item) => `${normalizeText(item.product_id)} ${normalizeText(item.product_description)}`)
        .join(' ');
      const haystack = `${normalizeText(occurrence.invoice_number)} ${normalizeText(occurrence.customer_name)} ${normalizeText(occurrence.city)} ${normalizeText(occurrence.reason)} ${normalizeText(occurrence.resolution_type)} ${normalizeText(occurrence.resolution_note)} ${normalizeText(occurrence.product_id)} ${normalizeText(occurrence.product_description)} ${itemTerms}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    return true;
  });
}

function buildDailyCountMap<T>(rows: T[], getDate: (row: T) => Date | null) {
  const map = new Map<string, number>();

  rows.forEach((row) => {
    const date = getDate(row);
    if (!date || Number.isNaN(date.getTime())) return;
    const dayKey = format(date, 'yyyy-MM-dd');
    map.set(dayKey, (map.get(dayKey) || 0) + 1);
  });

  return map;
}

async function loadShortageOccurrences(): Promise<IOccurrence[]> {
  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    return [];
  }

  const now = Date.now();
  if (shortagesStore.length && now - shortagesFetchedAt < SHORTAGES_CACHE_MS) {
    return shortagesStore;
  }

  if (inflightShortagesLoad) {
    return inflightShortagesLoad;
  }

  inflightShortagesLoad = axios.get<IOccurrence[]>(`${API_URL}/occurrences/search`, {
    params: {
      status: 'resolved',
      resolution_type: 'talao_mercadoria_faltante',
    },
    headers: getAuthHeaders(),
  }).then((response) => {
    shortagesStore = Array.isArray(response.data) ? response.data : [];
    shortagesFetchedAt = Date.now();
    return shortagesStore;
  }).catch(() => {
    shortagesStore = [];
    shortagesFetchedAt = Date.now();
    return shortagesStore;
  }).finally(() => {
    inflightShortagesLoad = null;
  });

  return inflightShortagesLoad;
}

function buildOccurrenceLoadKey(filters: ControlTowerFilters) {
  const invoiceHint = extractInvoiceSearchHint(filters.search, filters.invoiceNumber);
  return invoiceHint ? `invoice:${invoiceHint}` : 'all';
}

async function loadApiOccurrences(filters: ControlTowerFilters): Promise<IOccurrence[]> {
  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    return [];
  }

  const key = buildOccurrenceLoadKey(filters);
  const now = Date.now();
  const cached = occurrenceCacheStore.get(key);
  const fetchedAt = occurrenceCacheFetchedAt.get(key) || 0;
  if (cached && now - fetchedAt < OCCURRENCES_CACHE_MS) {
    return cached;
  }

  const inFlight = inflightOccurrenceLoads.get(key);
  if (inFlight) {
    return inFlight;
  }

  const headers = getAuthHeaders();
  const invoiceHint = extractInvoiceSearchHint(filters.search, filters.invoiceNumber);
  const params: Record<string, string> = {};
  params.status = 'resolved';
  params.resolution_type = CONTROL_TOWER_OCCURRENCE_RESOLUTION;
  if (invoiceHint) {
    params.invoice_number = invoiceHint;
  }

  const request = axios.get<IOccurrence[]>(`${API_URL}/occurrences/search`, {
    params,
    headers,
  }).then((response) => {
    const normalizedRows = Array.isArray(response.data)
      ? response.data.filter((occurrence) => isControlTowerOccurrence(occurrence))
      : [];
    occurrenceCacheStore.set(key, normalizedRows);
    occurrenceCacheFetchedAt.set(key, Date.now());
    return normalizedRows;
  }).catch((error) => {
    console.error('Falha ao carregar ocorrencias para o fluxo da torre de controle.', error);
    occurrenceCacheStore.set(key, []);
    occurrenceCacheFetchedAt.set(key, Date.now());
    return [];
  }).finally(() => {
    inflightOccurrenceLoads.delete(key);
  });

  inflightOccurrenceLoads.set(key, request);
  return request;
}

function toUniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function extractExactInvoiceFilter(search: string, invoiceNumber?: string) {
  const explicitInvoice = normalizeInvoiceNumber(invoiceNumber);
  if (explicitInvoice) return explicitInvoice;

  const term = normalizeText(search);
  if (!term) return '';
  if (/^\d{3,}$/.test(term)) return term;

  const nfMatch = term.match(/^NF\D*(\d{3,})$/i);
  if (nfMatch?.[1]) return nfMatch[1];

  return '';
}

function extractInvoiceSearchHint(search: string, invoiceNumber?: string) {
  const exactInvoice = extractExactInvoiceFilter(search, invoiceNumber);
  if (exactInvoice) return exactInvoice;

  const term = normalizeText(search);
  if (!term) return '';
  if (/^SOBRA-/i.test(term)) return term.toUpperCase();
  return '';
}

function buildApiLoadKey(filters: ControlTowerFilters) {
  return JSON.stringify({
    customer: normalizeText(filters.customer).toLowerCase(),
    city: normalizeText(filters.city).toLowerCase(),
    invoiceHint: extractInvoiceSearchHint(filters.search, filters.invoiceNumber),
  });
}

function groupCollectionsByInvoice(rows: ICollectionRequest[]) {
  return rows.reduce<Map<string, ICollectionRequest[]>>((accumulator, row) => {
    const key = normalizeText(row.invoice_number);
    if (!key) return accumulator;

    const current = accumulator.get(key) || [];
    current.push(row);
    accumulator.set(key, current);
    return accumulator;
  }, new Map());
}

function sortByNewestCreatedAt(rows: ICollectionRequest[]) {
  return [...rows].sort((left, right) => {
    const leftTime = new Date(left.created_at || 0).getTime();
    const rightTime = new Date(right.created_at || 0).getTime();
    return rightTime - leftTime;
  });
}

const EVENT_ACTORS = {
  KP_TRANSPORTES: 'KP Transportes (Transportadora)',
  MAR_E_RIO_TOWER: 'Torre de Controle Mar e Rio',
  OPERACAO_KP: 'Operacao KP Transportes',
};

function buildApiEvents(note: IControlTowerReturn, latestCollection?: ICollectionRequest): EventLog[] {
  const createdAt = toIsoDateTime(note.created_at, toIsoDateTime(note.return_date));
  const events: EventLog[] = [
    {
      at: createdAt,
      actor: EVENT_ACTORS.KP_TRANSPORTES,
      action: 'Devolucao registrada pela transportadora',
      note: `Tipo: ${mapReturnTypeReason(note.return_type)}`,
    },
  ];

  if (note.return_type === 'sobra' && note.is_inversion) {
    const inversionInvoice = normalizeText(note.inversion?.invoice_number || note.inversion_invoice_number);
    const missingProduct = normalizeText(note.inversion?.missing_product_code || note.inversion_missing_product_code).toUpperCase();
    events.push({
      at: createdAt,
      actor: EVENT_ACTORS.KP_TRANSPORTES,
      action: 'Sobra registrada por inversao de produto',
      note: `NF ${inversionInvoice || '-'} | Produto faltante: ${missingProduct || '-'}`,
    });
  }

  if (normalizeText(note.sent_to_control_tower_at)) {
    events.push({
      at: toIsoDateTime(note.sent_to_control_tower_at, createdAt),
      actor: normalizeText(note.sent_to_control_tower_by_username) || EVENT_ACTORS.KP_TRANSPORTES,
      action: 'Devolucao enviada para a Torre de Controle Mar e Rio',
    });
  }

  if (normalizeText(note.received_by_control_tower_at)) {
    events.push({
      at: toIsoDateTime(note.received_by_control_tower_at, createdAt),
      actor: normalizeText(note.received_by_control_tower_username) || EVENT_ACTORS.MAR_E_RIO_TOWER,
      action: 'Devolucao recebida e finalizada pela Torre de Controle Mar e Rio',
    });
  }

  if (!latestCollection) {
    return events;
  }

  events.push({
    at: toIsoDateTime(latestCollection.created_at, createdAt),
    actor: EVENT_ACTORS.MAR_E_RIO_TOWER,
    action: 'Solicitacao de coleta registrada pela Torre',
    note: latestCollection.notes || undefined,
  });

  const workflowStatus = normalizeText(latestCollection.workflow_status || latestCollection.status).toLowerCase();

  if (normalizeText(latestCollection.scheduled_for)) {
    events.push({
      at: toIsoDateTime(latestCollection.accepted_at, toIsoDateTime(latestCollection.updated_at, createdAt)),
      actor: latestCollection.acceptedByUser?.username || EVENT_ACTORS.KP_TRANSPORTES,
      action: `Coleta aceita e agendada para ${formatDateBR(latestCollection.scheduled_for)}`,
    });
  }

  if (['coletada', 'enviada_em_lote', 'recebida', 'completed'].includes(workflowStatus)) {
    events.push({
      at: toIsoDateTime(
        latestCollection.collected_at,
        toIsoDateTime(latestCollection.completed_at, toIsoDateTime(latestCollection.updated_at, createdAt)),
      ),
      actor: latestCollection.collectedByUser?.username || EVENT_ACTORS.OPERACAO_KP,
      action: 'Coleta realizada pela transportadora',
    });
  }

  if (workflowStatus === 'enviada_em_lote') {
    events.push({
      at: toIsoDateTime(latestCollection.sent_in_batch_at, toIsoDateTime(latestCollection.updated_at, createdAt)),
      actor: EVENT_ACTORS.KP_TRANSPORTES,
      action: `Devolucao enviada para a Torre no lote ${latestCollection.sent_in_batch_code || '-'}`,
    });
  }

  if (workflowStatus === 'recebida') {
    events.push({
      at: toIsoDateTime(latestCollection.received_at, toIsoDateTime(latestCollection.updated_at, createdAt)),
      actor: EVENT_ACTORS.MAR_E_RIO_TOWER,
      action: 'Recebimento da devolucao confirmado pela Torre',
    });
  }

  if (latestCollection.display_status === 'em_tratativa') {
    events.push({
      at: toIsoDateTime(latestCollection.updated_at, createdAt),
      actor: EVENT_ACTORS.MAR_E_RIO_TOWER,
      action: 'Ocorrencia vinculada (em tratativa)',
      note: latestCollection.quality_note || undefined,
    });
  }

  if (workflowStatus === 'cancelada' || workflowStatus === 'cancelled') {
    events.push({
      at: toIsoDateTime(latestCollection.updated_at, createdAt),
      actor: EVENT_ACTORS.KP_TRANSPORTES,
      action: 'Coleta cancelada',
    });
  }

  return events;
}

function mapApiItem(item: IControlTowerReturn['items'][number]): ReturnItem {
  const quantity = toNumber(item.quantity, 0);
  const totalPrice = toNumber(item.total_price, 0);
  const unitPrice = toNumber(item.unit_price, 0);

  return {
    productId: normalizeText(item.product_id) || 'NAO_INFORMADO',
    productDescription: normalizeText(item.product_description) || 'Item sem descricao',
    productType: normalizeText(item.product_type).toUpperCase() || 'UN',
    quantity,
    weightKg: 0,
    valueAmount: totalPrice > 0 ? totalPrice : Number((unitPrice * quantity).toFixed(2)),
  };
}

function mapApiReturnRow(note: IControlTowerReturn, collectionsByInvoice: Map<string, ICollectionRequest[]>): ReturnBatch {
  const nowIso = new Date().toISOString();
  const createdAt = toIsoDateTime(note.created_at, nowIso);
  const confirmedAt = toIsoDateTime(note.return_date, createdAt);
  const invoice = normalizeText(note.invoice_number);
  const loadNumber = normalizeText(note.load_number);
  const isInversion = Boolean(note.is_inversion);
  const inversionInvoiceNumber = normalizeText(note.inversion?.invoice_number || note.inversion_invoice_number);
  const inversionMissingProductCode = normalizeText(note.inversion?.missing_product_code || note.inversion_missing_product_code).toUpperCase();
  const city = normalizeText(note.city) || 'NAO INFORMADO';
  const collectionRows = sortByNewestCreatedAt(collectionsByInvoice.get(invoice) || []);
  const latestCollection = collectionRows[0];
  const collectionWorkflowStatus = latestCollection
    ? normalizeText(latestCollection.workflow_status || latestCollection.status).toLowerCase()
    : '';
  const collectionDisplayStatus = latestCollection
    ? normalizeText(latestCollection.display_status).toLowerCase()
    : '';
  const collectionQualityStatus = latestCollection
    ? normalizeText(latestCollection.quality_status).toLowerCase()
    : '';

  const baseStatus: BacklogStatus = latestCollection
    ? mapCollectionStatus(latestCollection)
    : mapReturnStatusWithoutCollection(note);

  const parsedConfirmed = new Date(confirmedAt);
  const ageHours = Number.isNaN(parsedConfirmed.getTime())
    ? 0
    : Math.max(0, differenceInHours(new Date(), parsedConfirmed));

  return {
    id: String(note.id),
    batchCode: normalizeText(note.batch_code) || `RET-SEM-LOTE-${note.id}`,
    invoiceNumber: invoice || 'SEM_NF',
    sourceType: note.return_type,
    loadNumber: loadNumber || undefined,
    isInversion,
    inversionInvoiceNumber: inversionInvoiceNumber || undefined,
    inversionMissingProductCode: inversionMissingProductCode || undefined,
    customer: normalizeText(note.customer_name) || 'NAO INFORMADO',
    city,
    route: inferRoute(city),
    reason: note.return_type === 'sobra' && isInversion
      ? 'Sobra (Inversao)'
      : mapReturnTypeReason(note.return_type),
    status: baseStatus,
    createdAt,
    confirmedAt,
    pickupRequestedAt: latestCollection ? toIsoDateTime(latestCollection.created_at, createdAt) : undefined,
    pickupCompletedAt: latestCollection && ['coletada', 'enviada_em_lote', 'recebida', 'completed']
      .includes(normalizeText(latestCollection.workflow_status || latestCollection.status).toLowerCase())
      ? toIsoDateTime(latestCollection.completed_at, toIsoDateTime(latestCollection.updated_at, createdAt))
      : undefined,
    ageHours,
    collectionRequestId: latestCollection ? String(latestCollection.id) : undefined,
    collectionWorkflowStatus: collectionWorkflowStatus || undefined,
    collectionDisplayStatus: collectionDisplayStatus || undefined,
    collectionQualityStatus: collectionQualityStatus || undefined,
    relatedOccurrenceId: latestCollection?.related_occurrence_id ?? null,
    items: (note.items || []).map(mapApiItem),
    events: buildApiEvents(note, latestCollection),
  };
}

function sortEvents(events: EventLog[]) {
  return [...events].sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
}

function applyLocalOverlay(row: ReturnBatch): ReturnBatch {
  const overlay = localOverlayStore.get(row.id);
  if (!overlay) return row;

  return {
    ...row,
    status: overlay.status ?? row.status,
    pickupRequestedAt: overlay.pickupRequestedAt ?? row.pickupRequestedAt,
    pickupCompletedAt: overlay.pickupCompletedAt ?? row.pickupCompletedAt,
    pickupPriority: overlay.pickupPriority ?? row.pickupPriority,
    events: sortEvents([...row.events, ...overlay.events]),
  };
}

function refreshResolvedRowsFromBase() {
  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    lastBaseRows = returnsStore;
    lastResolvedRows = returnsStore;
    filterOptionsStore = MOCK_FILTER_OPTIONS;
    return;
  }

  lastResolvedRows = lastBaseRows.map(applyLocalOverlay);

  if (!lastResolvedRows.length) {
    return;
  }

  filterOptionsStore = {
    customers: toUniqueSorted(lastResolvedRows.map((row) => row.customer)),
    cities: toUniqueSorted(lastResolvedRows.map((row) => row.city)),
    products: toUniqueSorted(lastResolvedRows.flatMap((row) => row.items.map((item) => item.productDescription))),
  };
}

async function loadApiRows(filters: ControlTowerFilters): Promise<ReturnBatch[]> {
  const key = buildApiLoadKey(filters);
  const inFlight = inflightApiLoads.get(key);
  if (inFlight) return inFlight;

  const requestPromise = (async () => {
    const headers = getAuthHeaders();
    const params: Record<string, string | number> = {
      limit: 300,
      batch_workflow_status: 'sent_to_control_tower',
    };
    const permission = localStorage.getItem('user_permission') || '';

    const customer = normalizeText(filters.customer);
    const city = normalizeText(filters.city);
    const invoiceHint = extractInvoiceSearchHint(filters.search, filters.invoiceNumber);

    if (customer) params.customer_name = customer;
    if (city) params.city = city;
    if (invoiceHint) params.invoice_number = invoiceHint;

    let apiRows: IControlTowerReturn[] = [];
    let collectionRows: ICollectionRequest[] = [];

    try {
      const response = await axios.get<IControlTowerReturn[]>(`${API_URL}/returns/control-tower/search`, {
        params,
        headers,
      });
      apiRows = Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Falha ao carregar devolucoes da torre de controle.', error);
      apiRows = [];
    }

    if (['control_tower', 'admin', 'master'].includes(permission)) {
      try {
        const response = await axios.get<ICollectionRequest[]>(`${API_URL}/collection-requests/search`, {
          params: { status: 'all', limit: 200 },
          headers,
        });
        collectionRows = Array.isArray(response.data) ? response.data : [];
      } catch {
        collectionRows = [];
      }
    }

    const collectionsByInvoice = groupCollectionsByInvoice(collectionRows);

    const mappedRows = apiRows
      .map((row) => mapApiReturnRow(row, collectionsByInvoice))
      .sort((left, right) => new Date(right.confirmedAt).getTime() - new Date(left.confirmedAt).getTime());

    lastBaseRows = mappedRows;
    refreshResolvedRowsFromBase();
    return lastResolvedRows;
  })().finally(() => {
    inflightApiLoads.delete(key);
  });

  inflightApiLoads.set(key, requestPromise);
  return requestPromise;
}

async function getAllRows(filters: ControlTowerFilters): Promise<ReturnBatch[]> {
  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    lastBaseRows = returnsStore;
    lastResolvedRows = returnsStore;
    return returnsStore;
  }

  return loadApiRows(filters);
}

function applyFilters(rows: ReturnBatch[], filters: ControlTowerFilters): ReturnBatch[] {
  const { start, end } = getInterval(filters);
  const exactInvoice = extractExactInvoiceFilter(filters.search, filters.invoiceNumber);
  const term = exactInvoice ? '' : filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.returnType === 'faltante') return false;

    if (exactInvoice && normalizeInvoiceNumber(row.invoiceNumber) !== exactInvoice) return false;

    const rowDate = new Date(row.confirmedAt);
    if (Number.isNaN(rowDate.getTime())) return false;
    if (!exactInvoice && (rowDate < start || rowDate > end)) return false;

    if (filters.returnStatus === 'pending' && row.status === 'COLETADA') return false;
    if (filters.returnStatus === 'confirmed' && row.status !== 'COLETADA') return false;
    if (filters.returnType !== 'all' && row.sourceType !== filters.returnType) return false;

    if (filters.pickupStatus !== 'all' && row.status !== filters.pickupStatus) return false;
    if (filters.city && row.city !== filters.city) return false;
    if (filters.customer && row.customer !== filters.customer) return false;

    const hasProduct = !filters.product
      || row.items.some((item) => item.productDescription.toLowerCase().includes(filters.product.toLowerCase()));
    if (!hasProduct) return false;

    if (term) {
      const haystack = `${row.invoiceNumber} ${row.customer} ${row.city} ${row.batchCode} ${row.reason} ${row.sourceType || ''} ${row.loadNumber || ''} ${row.isInversion ? 'inversao' : ''} ${row.inversionInvoiceNumber || ''} ${row.inversionMissingProductCode || ''} ${row.items.map((item) => item.productDescription).join(' ')}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    return true;
  });
}

function filterFlowOccurrences(occurrences: IOccurrence[], filters: ControlTowerFilters): IOccurrence[] {
  const { start, end } = getInterval(filters);
  const exactInvoice = extractExactInvoiceFilter(filters.search, filters.invoiceNumber);
  const term = exactInvoice ? '' : normalizeText(filters.search).toLowerCase();
  const product = normalizeText(filters.product).toLowerCase();

  return occurrences.filter((occurrence) => {
    if (!isControlTowerOccurrence(occurrence)) return false;

    const occurrenceDate = parseOccurrenceDate(occurrence);
    if (!occurrenceDate) return false;
    if (!exactInvoice && (occurrenceDate < start || occurrenceDate > end)) return false;
    if (exactInvoice && normalizeInvoiceNumber(occurrence.invoice_number) !== exactInvoice) return false;

    if (filters.returnType !== 'all' && filters.returnType !== 'faltante') return false;

    if (filters.city && normalizeText(occurrence.city).toUpperCase() !== normalizeText(filters.city).toUpperCase()) return false;
    if (filters.customer && normalizeText(occurrence.customer_name).toUpperCase() !== normalizeText(filters.customer).toUpperCase()) return false;
    if (product && !occurrenceContainsProduct(occurrence, product)) return false;

    if (term) {
      const itemTerms = (Array.isArray(occurrence.items) ? occurrence.items : [])
        .map((item) => `${normalizeText(item.product_id)} ${normalizeText(item.product_description)}`)
        .join(' ');
      const haystack = `${normalizeText(occurrence.invoice_number)} ${normalizeText(occurrence.customer_name)} ${normalizeText(occurrence.city)} ${normalizeText(occurrence.reason)} ${normalizeText(occurrence.resolution_type)} ${normalizeText(occurrence.resolution_note)} ${normalizeText(occurrence.product_id)} ${normalizeText(occurrence.product_description)} ${itemTerms}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    return true;
  });
}

function aggregateTop(rows: ReturnBatch[], by: 'product' | 'customer'): TopDimension[] {
  const map = new Map<string, TopDimension>();

  rows.forEach((row) => {
    if (by === 'customer') {
      const current = map.get(row.customer) || { name: row.customer, quantity: 0, weightKg: 0, valueAmount: 0 };
      current.quantity += 1;
      current.weightKg += row.items.reduce((acc, item) => acc + item.weightKg, 0);
      current.valueAmount += row.items.reduce((acc, item) => acc + item.valueAmount, 0);
      map.set(row.customer, current);
      return;
    }

    row.items.forEach((item) => {
      const key = item.productDescription;
      const current = map.get(key) || { name: key, quantity: 0, weightKg: 0, valueAmount: 0 };
      current.quantity += item.quantity;
      current.weightKg += item.weightKg;
      current.valueAmount += item.valueAmount;
      map.set(key, current);
    });
  });

  return Array.from(map.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8)
    .map((item) => ({
      ...item,
      weightKg: Number(item.weightKg.toFixed(2)),
      valueAmount: Number(item.valueAmount.toFixed(2)),
    }));
}

function aggregateShortageTop(occurrences: IOccurrence[]): TopDimension[] {
  const map = new Map<string, TopDimension>();

  occurrences.forEach((occurrence) => {
    const items = Array.isArray(occurrence.items) ? occurrence.items : [];

    if (items.length) {
      items.forEach((item) => {
        const name = normalizeText(item.product_description || item.product_id || 'Item sem descricao');
        const quantity = toNumber(item.quantity, 0);
        if (!name || quantity <= 0) return;

        const current = map.get(name) || { name, quantity: 0, weightKg: 0, valueAmount: 0 };
        current.quantity += quantity;
        map.set(name, current);
      });
      return;
    }

    const fallbackName = normalizeText(occurrence.product_description || occurrence.product_id || 'Item sem descricao');
    const fallbackQty = toNumber(occurrence.quantity, 0);
    if (!fallbackName || fallbackQty <= 0) return;

    const current = map.get(fallbackName) || { name: fallbackName, quantity: 0, weightKg: 0, valueAmount: 0 };
    current.quantity += fallbackQty;
    map.set(fallbackName, current);
  });

  return Array.from(map.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);
}

function reasonDistribution(rows: ReturnBatch[]): ReasonDistribution[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.reason, (counts.get(row.reason) || 0) + 1));
  return Array.from(counts.entries()).map(([reason, count]) => ({ reason, count }));
}

function variation(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function normalizeReturnType(returnType?: ReturnBatch['sourceType']): ReturnsTableRow['returnType'] {
  if (returnType === 'total' || returnType === 'partial' || returnType === 'coleta' || returnType === 'sobra') {
    return returnType;
  }

  return 'nao_informado';
}

export async function getControlTowerSummary(filters: ControlTowerFilters): Promise<DashboardSummary> {
  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    await wait(350);
  }

  const rows = await getAllRows(filters);
  const filtered = applyFilters(rows, filters);

  const { start, end } = getInterval(filters);
  const periodDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const prevStart = subDays(start, periodDays);
  const prevEnd = subDays(end, periodDays);

  const prevRows = rows.filter((row) => {
    const date = new Date(row.confirmedAt);
    if (Number.isNaN(date.getTime())) return false;
    return date >= prevStart && date <= prevEnd;
  });

  const allShortages = await loadShortageOccurrences();
  const currentShortages = filterShortageOccurrences(allShortages, filters, start, end);
  const prevShortages = filterShortageOccurrences(allShortages, filters, prevStart, prevEnd);

  const currentConfirmed = filtered.length;
  const currentRequested = filtered.filter((row) => row.status !== 'PENDENTE').length;
  const currentSurpluses = filtered.filter((row) => isSurplusRow(row)).length;
  const currentShortagesCount = currentShortages.length;

  const prevConfirmed = prevRows.length;
  const prevRequested = prevRows.filter((row) => row.status !== 'PENDENTE').length;
  const prevSurpluses = prevRows.filter((row) => isSurplusRow(row)).length;
  const prevShortagesCount = prevShortages.length;

  const dailyRange = eachDayOfInterval({ start, end });
  const sparkFrom = (predicate: (row: ReturnBatch) => boolean) => dailyRange.map((day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    return filtered.filter((row) => format(new Date(row.confirmedAt), 'yyyy-MM-dd') === dayKey && predicate(row)).length;
  });
  const shortageByDay = buildDailyCountMap(currentShortages, parseOccurrenceDate);
  const surplusByDay = buildDailyCountMap(filtered.filter((row) => isSurplusRow(row)), (row) => {
    const parsed = new Date(row.confirmedAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });

  const shortagesSparkline = dailyRange.map((day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    return shortageByDay.get(dayKey) || 0;
  });

  const surplusesSparkline = dailyRange.map((day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    return surplusByDay.get(dayKey) || 0;
  });

  return {
    updatedAt: new Date().toISOString(),
    metrics: [
      {
        id: 'confirmedReturns',
        label: 'Devolucoes confirmadas',
        value: currentConfirmed,
        unit: 'count',
        variationPct: variation(currentConfirmed, prevConfirmed),
        sparkline: sparkFrom(() => true),
        helpText: 'Total de lotes confirmados dentro do período filtrado. A % ao lado mostra a variação em relação ao período anterior equivalente.',
      },
      {
        id: 'requestedPickups',
        label: 'Coletas recebidas',
        value: currentRequested,
        unit: 'count',
        variationPct: variation(currentRequested, prevRequested),
        sparkline: sparkFrom((row) => row.status !== 'PENDENTE'),
        helpText: 'Devolucoes que já foram recebidas. A % ao lado mostra a variação em relação ao período anterior equivalente.',
      },
      {
        id: 'shortages',
        label: 'Faltas',
        value: currentShortagesCount,
        unit: 'count',
        variationPct: variation(currentShortagesCount, prevShortagesCount),
        sparkline: shortagesSparkline,
        helpText: 'Ocorrencias resolvidas com talao de mercadoria faltante dentro do período filtrado.',
      },
      {
        id: 'surpluses',
        label: 'Sobras',
        value: currentSurpluses,
        unit: 'count',
        variationPct: variation(currentSurpluses, prevSurpluses),
        sparkline: surplusesSparkline,
        helpText: 'Devolucoes do tipo sobra registradas dentro do período filtrado.',
      },
    ],
  };
}

export async function getControlTowerCharts(filters: ControlTowerFilters): Promise<DashboardCharts> {
  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    await wait(420);
  }

  const rows = await getAllRows(filters);
  const filtered = applyFilters(rows, filters);
  const { start, end } = getInterval(filters);
  const allShortages = await loadShortageOccurrences();
  const filteredShortages = filterShortageOccurrences(allShortages, filters, start, end);
  const shortageProductsSource = filterShortageOccurrences(
    allShortages,
    filters,
    new Date('1970-01-01T00:00:00.000Z'),
    end,
    { ignoreDateRange: true },
  );
  const surplusRows = filtered.filter((row) => isSurplusRow(row));

  return {
    topProducts: aggregateTop(filtered, 'product'),
    topClients: aggregateTop(filtered, 'customer'),
    topSurplusProducts: aggregateTop(surplusRows, 'product'),
    topShortageProducts: aggregateShortageTop(shortageProductsSource.length ? shortageProductsSource : filteredShortages),
    reasons: reasonDistribution(filtered),
  };
}

export async function getActionQueue(filters: ControlTowerFilters): Promise<ActionQueueItem[]> {
  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    await wait(280);
  }

  if (filters.returnType !== 'all' && filters.returnType !== 'coleta') {
    return [];
  }

  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    const rows = applyFilters(await getAllRows(filters), filters);

    return rows
      .filter((row) => row.sourceType === 'coleta')
      .filter((row) => row.status === 'SOLICITADA' || row.status === 'EM_ROTA' || row.status === 'COLETADA')
      .map<ActionQueueItem>((row) => ({
        id: row.id,
        returnType: 'coleta',
        priority: row.pickupPriority ? 'critical' : row.ageHours > 48 ? 'critical' : row.ageHours > 24 ? 'high' : 'medium',
        pickupPriority: Boolean(row.pickupPriority),
        issue: mapCollectionQueueIssue(row.status),
        batchId: row.batchCode,
        invoiceNumber: row.invoiceNumber,
        customer: row.customer,
        city: row.city,
        route: row.route,
        status: row.status,
        ageHours: row.ageHours,
      }))
      .sort((a, b) => {
        if (a.pickupPriority && !b.pickupPriority) return -1;
        if (!a.pickupPriority && b.pickupPriority) return 1;
        return b.ageHours - a.ageHours;
      })
      .slice(0, 30);
  }

  const headers = getAuthHeaders();
  const exactInvoice = extractExactInvoiceFilter(filters.search, filters.invoiceNumber);
  const { start, end } = getInterval(filters);
  const searchTerm = exactInvoice ? '' : normalizeText(filters.search).toLowerCase();
  const productTerm = normalizeText(filters.product).toLowerCase();
  const params: Record<string, string | number> = {
    limit: 260,
  };

  if (exactInvoice) {
    params.invoice_number = exactInvoice;
  } else if (normalizeText(filters.invoiceNumber)) {
    params.invoice_number = normalizeText(filters.invoiceNumber);
  }

  if (normalizeText(filters.customer)) {
    params.customer_name = normalizeText(filters.customer);
  }

  if (normalizeText(filters.city)) {
    params.city = normalizeText(filters.city);
  }

  let queueRows: ICollectionRequest[] = [];
  try {
    const response = await axios.get<ICollectionRequest[]>(`${API_URL}/collection-requests/action-queue`, {
      params,
      headers,
    });
    queueRows = Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Falha ao carregar fila de acao de coletas.', error);
    return [];
  }

  return queueRows
    .filter((row) => isCollectionInActionQueue(row))
    .filter((row) => {
      const normalizedInvoice = normalizeInvoiceNumber(row.invoice_number);
      if (exactInvoice && normalizedInvoice !== exactInvoice) return false;
      const createdAt = new Date(toIsoDateTime(row.created_at, new Date().toISOString()));
      if (!exactInvoice && (createdAt < start || createdAt > end)) return false;
      if (productTerm) {
        const productHaystack = `${normalizeText(row.product_id)} ${normalizeText(row.product_description)}`.toLowerCase();
        if (!productHaystack.includes(productTerm)) return false;
      }
      if (searchTerm) {
        const haystack = `${normalizeText(row.invoice_number)} ${normalizeText(row.customer_name)} ${normalizeText(row.city)} ${normalizeText(row.request_code)} ${normalizeText(row.product_description)}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    })
    .map<ActionQueueItem | null>((row) => {
      const id = `collection-${row.id}`;
      const overlay = localOverlayStore.get(id);
      const baseStatus = mapCollectionStatus(row);
      const resolvedStatus = overlay?.status || baseStatus;
      if (!['SOLICITADA', 'EM_ROTA', 'COLETADA'].includes(resolvedStatus)) {
        return null;
      }

      const createdAt = toIsoDateTime(row.created_at, new Date().toISOString());
      const ageHours = Math.max(0, differenceInHours(new Date(), new Date(createdAt)));
      const pickupPriority = Boolean(overlay?.pickupPriority);

      return {
        id,
        returnType: 'coleta',
        priority: pickupPriority ? 'critical' : ageHours > 48 ? 'critical' : ageHours > 24 ? 'high' : 'medium',
        pickupPriority,
        issue: mapCollectionQueueIssue(resolvedStatus),
        batchId: normalizeText(row.sent_in_batch_code) || normalizeText(row.request_code) || `COL-${row.id}`,
        invoiceNumber: normalizeText(row.invoice_number) || 'SEM_NF',
        customer: normalizeText(row.customer_name) || 'NAO INFORMADO',
        city: normalizeText(row.city) || 'NAO INFORMADO',
        route: inferRoute(normalizeText(row.city) || 'NAO INFORMADO'),
        status: resolvedStatus,
        ageHours,
      };
    })
    .filter((row): row is ActionQueueItem => Boolean(row))
    .filter((row) => (filters.pickupStatus === 'all' ? true : row.status === filters.pickupStatus))
    .sort((a, b) => {
      if (a.pickupPriority && !b.pickupPriority) return -1;
      if (!a.pickupPriority && b.pickupPriority) return 1;
      return b.ageHours - a.ageHours;
    })
    .slice(0, 30);
}

function toTableRow(row: ReturnBatch): ReturnsTableRow {
  const quantity = row.items.reduce((acc, item) => acc + item.quantity, 0);
  const weightKg = row.items.reduce((acc, item) => acc + item.weightKg, 0);
  const valueAmount = row.items.reduce((acc, item) => acc + item.valueAmount, 0);

  return {
    id: row.id,
    flowOrigin: 'devolucao',
    batchCode: row.batchCode,
    invoiceNumber: row.invoiceNumber,
    returnType: normalizeReturnType(row.sourceType),
    loadNumber: row.loadNumber,
    isInversion: Boolean(row.isInversion),
    inversionInvoiceNumber: row.inversionInvoiceNumber,
    inversionMissingProductCode: row.inversionMissingProductCode,
    customer: row.customer,
    city: row.city,
    route: row.route,
    productCount: row.items.length,
    quantity,
    weightKg: Number(weightKg.toFixed(2)),
    valueAmount: Number(valueAmount.toFixed(2)),
    reason: row.reason,
    status: row.status,
    confirmedAt: row.confirmedAt,
    ageHours: row.ageHours,
  };
}

function occurrenceToTableRow(occurrence: IOccurrence): ReturnsTableRow {
  const occurrenceDate = parseOccurrenceDate(occurrence) || new Date();
  const confirmedAt = occurrenceDate.toISOString();
  const items = Array.isArray(occurrence.items) ? occurrence.items : [];
  const fallbackQty = toNumber(occurrence.quantity, 0);
  const quantity = items.length
    ? items.reduce((sum, item) => sum + toNumber(item.quantity, 0), 0)
    : fallbackQty;
  const productCount = items.length || (occurrence.product_id || occurrence.product_description ? 1 : 0);
  const valueAmount = items.length
    ? items.reduce((sum, item) => {
      const itemQuantity = toNumber(item.quantity, 0);
      const itemTotal = toNumber(item.total_price, 0);
      const itemUnit = toNumber(item.unit_price, 0);
      if (itemTotal > 0) return sum + itemTotal;
      return sum + (itemUnit * itemQuantity);
    }, 0)
    : (() => {
      const total = toNumber(occurrence.total_price, 0);
      if (total > 0) return total;
      const unit = toNumber(occurrence.unit_price, 0);
      return unit * fallbackQty;
    })();

  return {
    id: `occ-${occurrence.id}`,
    flowOrigin: 'ocorrencia',
    batchCode: 'OCORRENCIA',
    invoiceNumber: normalizeText(occurrence.invoice_number) || 'SEM_NF',
    returnType: 'faltante',
    loadNumber: undefined,
    isInversion: false,
    inversionInvoiceNumber: undefined,
    inversionMissingProductCode: undefined,
    customer: normalizeText(occurrence.customer_name) || 'NAO INFORMADO',
    city: normalizeText(occurrence.city) || 'NAO INFORMADO',
    route: inferRoute(normalizeText(occurrence.city) || 'NAO INFORMADO'),
    productCount,
    quantity,
    weightKg: 0,
    valueAmount: Number(valueAmount.toFixed(2)),
    reason: `Ocorrencia - ${mapOccurrenceReasonLabel(occurrence.reason)}`,
    status: mapOccurrenceTableStatus(occurrence),
    confirmedAt,
    ageHours: Math.max(0, differenceInHours(new Date(), occurrenceDate)),
  };
}

export async function getReturnsTable(
  filters: ControlTowerFilters,
  pagination: PaginationInput,
  sorting?: SortingInput,
): Promise<ReturnsTableResponse> {
  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    await wait(360);
  }

  const [returnRows, occurrenceRows] = await Promise.all([
    getAllRows(filters),
    loadApiOccurrences(filters),
  ]);

  const rows = [
    ...applyFilters(returnRows, filters).map(toTableRow),
    ...filterFlowOccurrences(occurrenceRows, filters).map(occurrenceToTableRow),
  ];

  const sorted = sorting
    ? [...rows].sort((a, b) => {
      const left = a[sorting.id] ?? '';
      const right = b[sorting.id] ?? '';
      if (left < right) return sorting.desc ? 1 : -1;
      if (left > right) return sorting.desc ? -1 : 1;
      return 0;
    })
    : rows;

  const start = pagination.pageIndex * pagination.pageSize;
  const end = start + pagination.pageSize;

  return {
    rows: sorted.slice(start, end),
    total: rows.length,
  };
}

export function getReturnById(id: string): ReturnBatch | null {
  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    return returnsStore.find((row) => row.id === id) || null;
  }

  return lastResolvedRows.find((row) => row.id === id) || null;
}

function saveOverlay(returnId: string, patch: Partial<LocalReturnOverlay>, event?: EventLog) {
  const current = localOverlayStore.get(returnId) || { events: [] };

  localOverlayStore.set(returnId, {
    ...current,
    ...patch,
    events: event ? [...current.events, event] : current.events,
  });

  refreshResolvedRowsFromBase();
}

function updateMockStore(mapper: (row: ReturnBatch) => ReturnBatch) {
  returnsStore = returnsStore.map(mapper);
  lastBaseRows = returnsStore;
  lastResolvedRows = returnsStore;
}

export async function updatePickupStatus(pickupId: string, status: BacklogStatus): Promise<{ id: string; returnId: string; status: BacklogStatus; updatedAt: string; }> {
  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    await wait(220);

    updateMockStore((row) => {
      if (`pick-${row.id}` !== pickupId && row.id !== pickupId) return row;
      const nowIso = new Date().toISOString();
      return {
        ...row,
        status,
        pickupCompletedAt: status === 'COLETADA' ? nowIso : row.pickupCompletedAt,
        events: [
          ...row.events,
          {
            at: nowIso,
            actor: 'Operador',
            action: `Status da coleta atualizado para ${status}`,
          },
        ],
      };
    });

    return {
      id: pickupId.startsWith('pick-') ? pickupId : `pick-${pickupId}`,
      returnId: pickupId.replace('pick-', ''),
      status,
      updatedAt: new Date().toISOString(),
    };
  }

  const returnId = pickupId.replace('pick-', '');
  const nowIso = new Date().toISOString();

  saveOverlay(returnId, {
    status,
    pickupCompletedAt: status === 'COLETADA' ? nowIso : undefined,
  }, {
    at: nowIso,
    actor: 'Operador',
    action: `Status da coleta atualizado para ${status}`,
  });

  return {
    id: pickupId.startsWith('pick-') ? pickupId : `pick-${pickupId}`,
    returnId,
    status,
    updatedAt: nowIso,
  };
}

export async function addReturnObservation(returnId: string, note: string): Promise<{ ok: true }> {
  const trimmed = note.trim();
  if (!trimmed) return { ok: true };

  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    await wait(180);

    updateMockStore((row) => (
      row.id === returnId
        ? {
          ...row,
          events: [
            ...row.events,
            {
              at: new Date().toISOString(),
              actor: 'Operador',
              action: 'Observacao adicionada',
              note: trimmed,
            },
          ],
        }
        : row
    ));

    return { ok: true };
  }

  saveOverlay(returnId, {}, {
    at: new Date().toISOString(),
    actor: 'Operador',
    action: 'Observacao adicionada',
    note: trimmed,
  });

  return { ok: true };
}

export async function setPickupPriority(returnId: string, pickupPriority: boolean): Promise<{ ok: true }> {
  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    await wait(150);

    updateMockStore((row) => (
      row.id === returnId
        ? {
          ...row,
          pickupPriority,
          events: [
            ...row.events,
            {
              at: new Date().toISOString(),
              actor: 'Operador',
              action: pickupPriority ? 'Coleta marcada como prioritaria' : 'Prioridade da coleta removida',
            },
          ],
        }
        : row
    ));

    return { ok: true };
  }

  saveOverlay(returnId, { pickupPriority }, {
    at: new Date().toISOString(),
    actor: 'Operador',
    action: pickupPriority ? 'Coleta marcada como prioritaria' : 'Prioridade da coleta removida',
  });

  return { ok: true };
}

export async function registerControlTowerOccurrence(input: RegisterControlTowerOccurrenceInput): Promise<{ ok: true }> {
  const collectionRequestId = normalizeText(input.collectionRequestId);
  if (!collectionRequestId) {
    throw new Error('Solicitacao de coleta invalida para registrar ocorrencia.');
  }

  const scope = input.scope === 'invoice_total' ? 'invoice_total' : 'items';
  const normalizedItems = scope === 'items'
    ? (input.items || [])
      .map((item) => ({
        product_id: normalizeText(item.product_id),
        product_description: normalizeText(item.product_description),
        product_type: normalizeText(item.product_type).toUpperCase() || null,
        quantity: toNumber(item.quantity, 0),
      }))
      .filter((item) => item.product_id && item.quantity > 0)
    : [];

  if (scope === 'items' && !normalizedItems.length) {
    throw new Error('Selecione ao menos um item com quantidade para registrar a ocorrencia.');
  }

  if (CONTROL_TOWER_DATA_MODE === 'mock') {
    await wait(180);
    return { ok: true };
  }

  await axios.post(
    `${API_URL}/collection-requests/${collectionRequestId}/occurrences`,
    {
      reason: input.reason,
      scope,
      items: normalizedItems,
      description: normalizeText(input.description) || 'Divergencia identificada no recebimento do lote.',
      quality_note: normalizeText(input.qualityNote || input.description) || undefined,
    },
    { headers: getAuthHeaders() },
  );

  return { ok: true };
}

export function exportRowsToCsv<T extends object>(rows: T[]) {
  if (!rows.length) return '';

  const headers = Object.keys(rows[0]) as Array<keyof T>;
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csv;
}

export function getFilterOptions() {
  return filterOptionsStore;
}
