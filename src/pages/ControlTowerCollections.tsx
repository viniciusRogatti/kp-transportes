import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SortingState } from '@tanstack/react-table';
import { Bell, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';

import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import FiltersBar from '../components/ControlTower/FiltersBar';
import KpiCards from '../components/ControlTower/KpiCards';
import TopHorizontalChart, { TopMetric } from '../components/ControlTower/charts/TopHorizontalChart';
import ReasonsDonutChart from '../components/ControlTower/charts/ReasonsDonutChart';
import ActionQueue from '../components/ControlTower/ActionQueue';
import ReturnsTable from '../components/ControlTower/ReturnsTable';
import DetailsDrawer from '../components/ControlTower/DetailsDrawer';
import { exportRowsToCsv, getFilterOptions, getReturnsTable } from '../services/controlTowerService';
import { useControlTowerData, useControlTowerMutations } from '../hooks/useControlTower';
import { BacklogStatus, ControlTowerFilters, RegisterControlTowerOccurrenceInput } from '../types/controlTower';
import { API_URL } from '../data';
import { ICollectionRequest, IDanfe, IOccurrence, IReturnBatch } from '../types/types';
import { formatDateBR } from '../utils/dateDisplay';

const getTodayDateInput = () => new Date().toISOString().slice(0, 10);
const CONTROL_TOWER_OCCURRENCE_RESOLUTION = 'talao_mercadoria_faltante';
const CREDIT_MANAGERS = ['control_tower', 'admin', 'master'];
const TOWER_COLLECTION_MANAGERS = ['control_tower', 'admin', 'master'];
const CANCELLABLE_TRACKING_WORKFLOW_STATUSES = ['solicitada'];
const REQUEST_CANCELLATION_TRACKING_WORKFLOW_STATUSES = ['aceita_agendada'];
const CONFIRMED_COLLECTION_WORKFLOW_STATUSES = ['coletada', 'enviada_em_lote', 'recebida'];
const NF_NOT_FOUND_MESSAGE = 'NF nao encontrada no banco de dados. Entre em contato com a expedicao da transportadora e envie o XML para cadastro.';
const NOTIFICATIONS_STORAGE_KEY = 'ct_notifications_seen_at';
const SHOW_FILTERS_STORAGE_KEY = 'ct_show_filters';
const SHOW_KPIS_STORAGE_KEY = 'ct_show_kpis';

const buildDefaultFilters = (): ControlTowerFilters => ({
  search: '',
  invoiceNumber: '',
  periodPreset: '30d',
  startDate: '',
  endDate: getTodayDateInput(),
  returnStatus: 'all',
  returnType: 'all',
  pickupStatus: 'all',
  city: '',
  customer: '',
  product: '',
});

const buildDefaultFlowFilters = (): ControlTowerFilters => ({
  ...buildDefaultFilters(),
  periodPreset: '30d',
});

const COLLECTION_TRACKING_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'solicitada', label: 'Solicitada' },
  { value: 'aceita_agendada', label: 'Aceita / Agendada' },
  { value: 'coletada', label: 'Coletada' },
  { value: 'cancelamento_solicitado', label: 'Cancelamento solicitado' },
  { value: 'enviada_em_lote', label: 'Enviada em lote' },
  { value: 'recebida', label: 'Recebida' },
] as const;

type CollectionTrackingStatus = typeof COLLECTION_TRACKING_STATUS_OPTIONS[number]['value'];
type RegisterCollectionScope = 'invoice_total' | 'items';

const COLLECTION_WORKFLOW_LABELS: Record<Exclude<CollectionTrackingStatus, 'all'>, string> = {
  solicitada: 'Solicitada',
  aceita_agendada: 'Aceita / Agendada',
  coletada: 'Coletada',
  cancelamento_solicitado: 'Cancelamento solicitado',
  enviada_em_lote: 'Enviada em lote',
  recebida: 'Recebida',
};

const COLLECTION_QUALITY_LABELS: Record<string, string> = {
  sem_ocorrencia: 'Sem ocorrência',
  em_tratativa: 'Em tratativa',
  aguardando_torre: 'Aguardando torre',
  resolvida: 'Resolvida',
};

type ManualCollectionRequestPayload = {
  invoice_number: string;
  request_code: string;
  customer_name: string;
  city: string;
  product_id: string | null;
  product_description: string;
  product_type: string | null;
  quantity: number;
  request_scope: 'invoice_total' | 'items';
  urgency_level: 'baixa' | 'media' | 'alta' | 'critica';
  notes?: string;
};

type RegisterCollectionProductRow = {
  key: string;
  productId: string;
  productDescription: string;
  productType: string;
  isKg: boolean;
  quantityOriginal: number;
  totalCollected: number;
  remainingCollectable: number;
};

type TowerNotificationEntry = {
  key: string;
  type: 'occurrence' | 'batch' | 'pickup';
  title: string;
  description: string;
  date: string;
  occurrenceId?: number;
  batchCode?: string;
  pickupId?: number;
  invoiceNumber?: string;
};

type CollectionCancellationDialogState = {
  mode: 'direct_cancel' | 'request_cancellation';
  request: ICollectionRequest;
};

function parseNumericInput(value: unknown): number {
  const normalized = String(value ?? '').trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatCollectionQuantity(value: number) {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/\.?0+$/, '');
}

function normalizeCollectionQuantity(value: number, isKg: boolean) {
  if (!Number.isFinite(value)) return 0;
  if (isKg) {
    return Math.round((value + Number.EPSILON) * 1000) / 1000;
  }
  return Math.round(value);
}

function normalizeProductType(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function isKgProductType(value: unknown) {
  return normalizeProductType(value).includes('KG');
}

function resolveCollectionRequestScope(request: ICollectionRequest): RegisterCollectionScope {
  return request.request_scope === 'invoice_total' ? 'invoice_total' : 'items';
}

function buildCollectionRequestCode(invoiceNumber: string, suffix = '') {
  const normalizedInvoice = String(invoiceNumber || '').trim().replace(/\D/g, '').slice(-6) || '000000';
  const normalizedSuffix = String(suffix || '').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
  return `CR-FE-${Date.now()}-${normalizedInvoice}${normalizedSuffix ? `-${normalizedSuffix}` : ''}`;
}

function buildManualCollectionPayloads(danfe: IDanfe, fallbackInvoice: string): ManualCollectionRequestPayload[] {
  const invoiceNumber = String(danfe.invoice_number || fallbackInvoice || '').trim();
  const customerName = String(danfe.Customer?.name_or_legal_entity || '').trim();
  const city = String(danfe.Customer?.city || '').trim();
  const requestCode = buildCollectionRequestCode(invoiceNumber || fallbackInvoice);
  const products = Array.isArray(danfe.DanfeProducts) ? danfe.DanfeProducts : [];
  const sumItemsQuantity = products.reduce((sum, item) => {
    const quantity = parseNumericInput(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return sum;
    return sum + quantity;
  }, 0);
  const totalQuantity = parseNumericInput(danfe.total_quantity);
  const resolvedQuantity = Number.isFinite(totalQuantity) && totalQuantity > 0
    ? totalQuantity
    : sumItemsQuantity > 0
      ? sumItemsQuantity
      : 1;
  const firstProductDescription = String(products[0]?.Product?.description || '').trim();
  const resolvedInvoiceNumber = invoiceNumber || fallbackInvoice;
  const productDescription = firstProductDescription
    ? `NF ${resolvedInvoiceNumber} | ${firstProductDescription}`
    : `NF ${resolvedInvoiceNumber}`;

  return [{
    invoice_number: resolvedInvoiceNumber,
    request_code: requestCode,
    customer_name: customerName,
    city,
    product_id: null,
    product_description: productDescription,
    product_type: null,
    quantity: resolvedQuantity,
    request_scope: 'invoice_total',
    urgency_level: 'media',
    notes: 'Solicitacao manual consolidada por NF para evitar duplicidade de coleta.',
  }];
}

function formatDateTimeLabel(value?: string | null) {
  return formatDateBR(value);
}

function splitCollectionNotes(notes: unknown) {
  return String(notes || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

type CollectionNoteDetail = {
  rawLine: string;
  timestampLabel: string;
  actor: string;
  message: string;
};

function formatCollectionNoteTimestampSaoPaulo(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(parsed);

  const getPart = (type: string) => parts.find((item) => item.type === type)?.value || '';
  const day = getPart('day');
  const month = getPart('month');
  const year = getPart('year');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');

  if (!day || !month || !year || !hour || !minute || !second) return '';
  return `${day}-${month}-${year} as ${hour}:${minute}:${second}`;
}

function parseCollectionNoteLine(line: string): CollectionNoteDetail {
  const rawLine = String(line || '').trim();
  const match = rawLine.match(/^\[(.+?)\]\s+([^:]+):\s*(.+)$/);

  if (!match) {
    return {
      rawLine,
      timestampLabel: '',
      actor: '',
      message: rawLine,
    };
  }

  return {
    rawLine,
    timestampLabel: formatCollectionNoteTimestampSaoPaulo(String(match[1] || '').trim()),
    actor: String(match[2] || '').trim(),
    message: String(match[3] || '').trim(),
  };
}

function getCollectionNoteDetails(notes: unknown) {
  return splitCollectionNotes(notes).map(parseCollectionNoteLine);
}

function hasCollectionNotes(notes: unknown) {
  return splitCollectionNotes(notes).length > 0;
}

function getCollectionNotesCount(notes: unknown) {
  return splitCollectionNotes(notes).length;
}

function getLatestCollectionNote(notes: unknown) {
  const lines = getCollectionNoteDetails(notes);
  if (!lines.length) return '';
  const latestLine = lines[lines.length - 1];
  if (latestLine.actor && latestLine.message) return `${latestLine.actor}: ${latestLine.message}`;
  return latestLine.message || latestLine.rawLine;
}

function isCollectionInvalidStatusMessage(message: string) {
  return /status de coleta inv[aá]lido/i.test(String(message || ''));
}

function normalizeCollectionWorkflowStatus(request: ICollectionRequest) {
  const workflowStatus = String(request.workflow_status || '').trim().toLowerCase();
  if (workflowStatus) return workflowStatus;

  const legacyStatus = String(request.status || '').trim().toLowerCase();
  if (legacyStatus === 'cancelled') return 'cancelada';
  if (legacyStatus === 'completed') return 'coletada';
  return 'solicitada';
}

function formatCollectionWorkflowStatus(request: ICollectionRequest) {
  const normalized = normalizeCollectionWorkflowStatus(request) as Exclude<CollectionTrackingStatus, 'all'>;
  return COLLECTION_WORKFLOW_LABELS[normalized] || normalized || 'Nao informado';
}

function formatCollectionQualityStatus(request: ICollectionRequest) {
  const normalized = String(request.quality_status || '').trim().toLowerCase();
  if (!normalized) return 'Sem ocorrência';
  return COLLECTION_QUALITY_LABELS[normalized] || normalized;
}

function canOpenCollectionInFlow(request: ICollectionRequest) {
  const workflowStatus = normalizeCollectionWorkflowStatus(request);
  if (workflowStatus === 'enviada_em_lote' || workflowStatus === 'recebida') {
    return true;
  }

  return Boolean(
    String(request.sent_in_batch_code || '').trim()
    || String(request.sent_in_batch_at || '').trim()
    || String(request.received_at || '').trim(),
  );
}

function isConfirmedCollectionWorkflowStatus(status: string) {
  return CONFIRMED_COLLECTION_WORKFLOW_STATUSES.includes(status);
}

function buildRegisterCollectionProductRows(danfe: IDanfe | null, existingRows: ICollectionRequest[]) {
  if (!danfe) return [] as RegisterCollectionProductRow[];

  const products = Array.isArray(danfe.DanfeProducts) ? danfe.DanfeProducts : [];
  const byProduct = new Map<string, RegisterCollectionProductRow>();

  products.forEach((product, index) => {
    const productId = String(product.Product?.code || '').trim().toUpperCase();
    if (!productId) return;
    const rawQuantity = parseNumericInput(product.quantity);
    if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) return;

    const productDescription = String(product.Product?.description || '').trim() || `Produto ${productId}`;
    const productType = normalizeProductType(product.type || product.Product?.type);
    const isKg = isKgProductType(productType);
    const quantity = normalizeCollectionQuantity(rawQuantity, isKg);
    const key = productId || `PROD-${index + 1}`;
    const current = byProduct.get(key);

    if (current) {
      current.quantityOriginal = normalizeCollectionQuantity(current.quantityOriginal + quantity, current.isKg || isKg);
      if (!current.productDescription && productDescription) current.productDescription = productDescription;
      if (!current.productType && productType) current.productType = productType;
      current.isKg = current.isKg || isKg;
      return;
    }

    byProduct.set(key, {
      key,
      productId,
      productDescription,
      productType,
      isKg,
      quantityOriginal: quantity,
      totalCollected: 0,
      remainingCollectable: quantity,
    });
  });

  const confirmedCollectedByProduct = new Map<string, number>();
  existingRows.forEach((request) => {
    if (resolveCollectionRequestScope(request) !== 'items') return;
    const workflowStatus = normalizeCollectionWorkflowStatus(request);
    if (!isConfirmedCollectionWorkflowStatus(workflowStatus)) return;

    const productId = String(request.product_id || '').trim().toUpperCase();
    if (!productId) return;

    const row = byProduct.get(productId);
    const isKg = row ? row.isKg : isKgProductType(request.product_type);
    const quantity = normalizeCollectionQuantity(parseNumericInput(request.quantity), isKg);
    if (!Number.isFinite(quantity) || quantity <= 0) return;

    const current = confirmedCollectedByProduct.get(productId) || 0;
    confirmedCollectedByProduct.set(productId, normalizeCollectionQuantity(current + quantity, isKg));
  });

  byProduct.forEach((row) => {
    const totalCollected = normalizeCollectionQuantity(confirmedCollectedByProduct.get(row.productId) || 0, row.isKg);
    row.totalCollected = totalCollected;
    row.remainingCollectable = normalizeCollectionQuantity(
      Math.max(0, row.quantityOriginal - totalCollected),
      row.isKg,
    );
  });

  return Array.from(byProduct.values()).sort((left, right) => left.productId.localeCompare(right.productId));
}

function ControlTowerCollections() {
  const navigate = useNavigate();
  const userPermission = localStorage.getItem('user_permission') || '';
  const canManageStatus = ['admin', 'master', 'expedicao'].includes(userPermission);
  const canManageCollectionRequests = TOWER_COLLECTION_MANAGERS.includes(userPermission);
  const canConfirmTowerBatchReceipt = userPermission === 'control_tower';
  const canFinalizeOccurrenceCredit = CREDIT_MANAGERS.includes(userPermission);
  const [analyticsFilters, setAnalyticsFilters] = useState<ControlTowerFilters>(() => buildDefaultFilters());
  const [flowFilters, setFlowFilters] = useState<ControlTowerFilters>(() => buildDefaultFlowFilters());
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(12);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'confirmedAt', desc: true }]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topMetric, setTopMetric] = useState<TopMetric>('quantity');
  const [registerNf, setRegisterNf] = useState('');
  const [registerScope, setRegisterScope] = useState<RegisterCollectionScope>('invoice_total');
  const [registerDanfe, setRegisterDanfe] = useState<IDanfe | null>(null);
  const [registerExistingRows, setRegisterExistingRows] = useState<ICollectionRequest[]>([]);
  const [registerPartialQuantities, setRegisterPartialQuantities] = useState<Record<string, string>>({});
  const [loadingRegisterContext, setLoadingRegisterContext] = useState(false);
  const [registeringPickup, setRegisteringPickup] = useState(false);
  const [cancellingCollectionInvoice, setCancellingCollectionInvoice] = useState<string | null>(null);
  const [collectionCancellationDialog, setCollectionCancellationDialog] = useState<CollectionCancellationDialogState | null>(null);
  const [collectionCancellationReason, setCollectionCancellationReason] = useState('');
  const [collectionTrackingRows, setCollectionTrackingRows] = useState<ICollectionRequest[]>([]);
  const [collectionTrackingLoading, setCollectionTrackingLoading] = useState(false);
  const [collectionTrackingError, setCollectionTrackingError] = useState('');
  const [collectionTrackingNf, setCollectionTrackingNf] = useState('');
  const [collectionTrackingStatus, setCollectionTrackingStatus] = useState<CollectionTrackingStatus>('all');
  const [collectionTrackingOnlyWithNotes, setCollectionTrackingOnlyWithNotes] = useState(false);
  const [collectionOccurrenceDialog, setCollectionOccurrenceDialog] = useState<ICollectionRequest | null>(null);
  const [recentOccurrences, setRecentOccurrences] = useState<IOccurrence[]>([]);
  const [pendingBatches, setPendingBatches] = useState<IReturnBatch[]>([]);
  const [receivingBatchCode, setReceivingBatchCode] = useState<string | null>(null);
  const [receiptConfirmBatchCode, setReceiptConfirmBatchCode] = useState<string | null>(null);
  const [towerNotifications, setTowerNotifications] = useState<TowerNotificationEntry[]>([]);
  const [notificationTotals, setNotificationTotals] = useState({
    occurrences: 0,
    batches: 0,
    pickups: 0,
  });
  const [notificationsSeenAt, setNotificationsSeenAt] = useState(() => {
    const saved = Number(localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '0');
    return Number.isFinite(saved) ? saved : 0;
  });
  const [showFilters, setShowFilters] = useState(() => localStorage.getItem(SHOW_FILTERS_STORAGE_KEY) !== '0');
  const [showKpis, setShowKpis] = useState(() => localStorage.getItem(SHOW_KPIS_STORAGE_KEY) !== '0');
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [highlightedOccurrenceId, setHighlightedOccurrenceId] = useState<number | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const actionQueueSectionRef = useRef<HTMLDivElement | null>(null);
  const returnsTableSectionRef = useRef<HTMLDivElement | null>(null);
  const collectionTrackingSectionRef = useRef<HTMLDivElement | null>(null);
  const occurrenceSectionRef = useRef<HTMLDivElement | null>(null);
  const pendingBatchesSectionRef = useRef<HTMLDivElement | null>(null);
  const occurrenceItemRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  const sortingInput = sorting[0] ? { id: sorting[0].id as any, desc: sorting[0].desc ?? false } : undefined;
  const pagination = useMemo(() => ({ pageIndex, pageSize }), [pageIndex, pageSize]);
  const analyticsPagination = useMemo(() => ({ pageIndex: 0, pageSize: 1 }), []);

  const { summary, charts } = useControlTowerData(analyticsFilters, analyticsPagination, undefined, {
    includeSummary: true,
    includeCharts: true,
    includeQueue: false,
    includeTable: false,
  });
  const { queue, table } = useControlTowerData(flowFilters, pagination, sortingInput, {
    includeSummary: false,
    includeCharts: false,
    includeQueue: true,
    includeTable: true,
  });
  const { updateStatusMutation, addObservationMutation, prioritizePickupMutation, registerOccurrenceMutation, getSelectedFromCache } = useControlTowerMutations(flowFilters, pagination, sortingInput);

  const selectedRow = selectedId ? getSelectedFromCache(selectedId) : null;

  const options = getFilterOptions();

  const updatedAgoLabel = summary.data?.updatedAt
    ? formatDistanceToNow(new Date(summary.data.updatedAt), { addSuffix: false, locale: ptBR })
    : '-';

  const periodSubtitle = analyticsFilters.periodPreset === 'custom'
    ? `${formatDateBR(analyticsFilters.startDate)} até ${formatDateBR(analyticsFilters.endDate)}`
    : analyticsFilters.periodPreset === 'today'
      ? 'Hoje'
      : analyticsFilters.periodPreset === '7d'
        ? 'Últimos 7 dias'
        : 'Últimos 30 dias';
  const pendingSituationsCount = notificationTotals.occurrences + notificationTotals.batches + notificationTotals.pickups;
  const registerProductRows = useMemo(
    () => buildRegisterCollectionProductRows(registerDanfe, registerExistingRows),
    [registerDanfe, registerExistingRows],
  );
  const registerActiveRows = useMemo(
    () => registerExistingRows.filter((row) => normalizeCollectionWorkflowStatus(row) !== 'cancelada'),
    [registerExistingRows],
  );
  const registerHasActiveInvoiceTotal = useMemo(
    () => registerActiveRows.some((row) => resolveCollectionRequestScope(row) === 'invoice_total'),
    [registerActiveRows],
  );
  const registerHasActiveItems = useMemo(
    () => registerActiveRows.some((row) => resolveCollectionRequestScope(row) === 'items'),
    [registerActiveRows],
  );

  function handleAnalyticsFilterChange(next: Partial<ControlTowerFilters>) {
    setAnalyticsFilters((prev) => ({ ...prev, ...next }));
  }

  function handleFlowFilterChange(next: Partial<ControlTowerFilters>) {
    setPageIndex(0);
    setFlowFilters((prev) => ({ ...prev, ...next }));
  }

  const loadRecentOccurrences = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setRecentOccurrences([]);
      return;
    }

    try {
      const params = new URLSearchParams({
        workflow_status: 'awaiting_control_tower',
        status: 'resolved',
        resolution_type: CONTROL_TOWER_OCCURRENCE_RESOLUTION,
      });
      const { data } = await axios.get(`${API_URL}/occurrences/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const normalizedRows = Array.isArray(data) ? data : [];
      const talaoOnlyRows = normalizedRows.filter((occurrence) => (
        occurrence?.status === 'resolved'
        && occurrence?.resolution_type === CONTROL_TOWER_OCCURRENCE_RESOLUTION
        && occurrence?.credit_status !== 'completed'
      ));
      setRecentOccurrences(talaoOnlyRows.slice(0, 20));
    } catch {
      setRecentOccurrences([]);
    }
  }, []);

  const loadCollectionTracking = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCollectionTrackingRows([]);
      setCollectionTrackingError('');
      return;
    }

    setCollectionTrackingLoading(true);
    setCollectionTrackingError('');

    try {
      const params: Record<string, string | number> = {
        status: 'all',
        limit: 260,
      };
      const normalizedNf = collectionTrackingNf.trim();

      if (normalizedNf) {
        params.invoice_number = normalizedNf;
      }
      if (collectionTrackingStatus !== 'all') {
        params.workflow_status = collectionTrackingStatus;
      }

      const { data } = await axios.get<ICollectionRequest[]>(`${API_URL}/collection-requests/search`, {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      const rows = Array.isArray(data) ? data : [];
      const activeTrackingRows = rows.filter((row) => normalizeCollectionWorkflowStatus(row) !== 'cancelada');
      setCollectionTrackingRows(activeTrackingRows);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setCollectionTrackingError(error.response?.data?.error || 'Erro ao carregar coletas.');
      } else {
        setCollectionTrackingError('Erro ao carregar coletas.');
      }
      setCollectionTrackingRows([]);
    } finally {
      setCollectionTrackingLoading(false);
    }
  }, [collectionTrackingNf, collectionTrackingStatus]);

  const loadTowerNotifications = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setTowerNotifications([]);
      setPendingBatches([]);
      setNotificationTotals({ occurrences: 0, batches: 0, pickups: 0 });
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    const [occurrenceResult, batchResult, pickupResult] = await Promise.allSettled([
      axios.get<IOccurrence[]>(`${API_URL}/occurrences/search`, {
        params: {
          workflow_status: 'awaiting_control_tower',
          status: 'resolved',
          resolution_type: CONTROL_TOWER_OCCURRENCE_RESOLUTION,
        },
        headers,
      }),
      axios.get<IReturnBatch[]>(`${API_URL}/returns/batches/search`, {
        params: { workflow_status: 'awaiting_control_tower' },
        headers,
      }),
      axios.get<ICollectionRequest[]>(`${API_URL}/collection-requests/search`, {
        params: { workflow_status: 'aceita_agendada', limit: 80 },
        headers,
      }),
    ]);

    const occurrenceRows = occurrenceResult.status === 'fulfilled' && Array.isArray(occurrenceResult.value.data)
      ? occurrenceResult.value.data
      : [];
    const pendingOccurrenceRows = occurrenceRows.filter((occurrence) => (
      occurrence?.status === 'resolved'
      && occurrence?.resolution_type === CONTROL_TOWER_OCCURRENCE_RESOLUTION
      && occurrence?.credit_status !== 'completed'
    ));
    const occurrenceNotifications: TowerNotificationEntry[] = pendingOccurrenceRows.slice(0, 8).map((occurrence) => ({
      key: `occ-${occurrence.id}`,
      type: 'occurrence',
      title: `Ocorrencia pendente de credito | NF ${occurrence.invoice_number}`,
      description: `Motivo: ${occurrence.reason || 'legacy_outros'}`,
      date: occurrence.resolved_at || occurrence.created_at,
      occurrenceId: occurrence.id,
      invoiceNumber: occurrence.invoice_number,
    }));

    const batchRows = batchResult.status === 'fulfilled' && Array.isArray(batchResult.value.data)
      ? batchResult.value.data
      : [];
    const pendingBatchRows = batchRows.filter((batch) => (
      batch?.workflow_status === 'awaiting_control_tower'
      || (Boolean(batch?.sent_to_control_tower_at) && !batch?.received_by_control_tower_at)
    ));
    const sortedPendingBatchRows = [...pendingBatchRows].sort((left, right) => {
      const leftDate = new Date(left.sent_to_control_tower_at || `${left.return_date}T12:00:00.000Z`).getTime();
      const rightDate = new Date(right.sent_to_control_tower_at || `${right.return_date}T12:00:00.000Z`).getTime();
      return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
    });
    setPendingBatches(sortedPendingBatchRows);
    const batchNotifications: TowerNotificationEntry[] = pendingBatchRows.slice(0, 8).map((batch) => ({
      key: `batch-${batch.batch_code}`,
      type: 'batch',
      title: `Lote pendente de recebimento | ${batch.batch_code}`,
      description: `NFs no lote: ${batch.notes?.length || 0}`,
      date: batch.sent_to_control_tower_at || `${batch.return_date}T12:00:00.000Z`,
      batchCode: batch.batch_code,
    }));

    const pickupRows = pickupResult.status === 'fulfilled' && Array.isArray(pickupResult.value.data)
      ? pickupResult.value.data
      : [];
    const scheduledPickupRows = pickupRows.filter((pickup) => (
      String(pickup.workflow_status || '').toLowerCase() === 'aceita_agendada'
      && Boolean(pickup.scheduled_for)
    ));
    const pickupNotifications: TowerNotificationEntry[] = scheduledPickupRows.slice(0, 8).map((pickup) => ({
      key: `pickup-${pickup.id}`,
      type: 'pickup',
      title: `Coleta com data confirmada | NF ${pickup.invoice_number || '-'}`,
      description: `${`Prevista para ${formatDateBR(pickup.scheduled_for)} | Cliente: ${pickup.customer_name || '-'}`}${getLatestCollectionNote(pickup.notes) ? ` | Obs: ${getLatestCollectionNote(pickup.notes)}` : ''}`,
      date: pickup.accepted_at || `${pickup.scheduled_for}T12:00:00.000Z`,
      pickupId: pickup.id,
      invoiceNumber: pickup.invoice_number || undefined,
    }));
    const pickupNotificationsLimited: TowerNotificationEntry[] = pickupNotifications.map((entry) => ({
      ...entry,
      description: entry.description.length > 160 ? `${entry.description.slice(0, 157)}...` : entry.description,
    }));

    const merged = [...occurrenceNotifications, ...batchNotifications, ...pickupNotificationsLimited]
      .sort((left, right) => {
        const leftDate = new Date(left.date).getTime();
        const rightDate = new Date(right.date).getTime();
        return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
      })
      .slice(0, 18);

    setNotificationTotals({
      occurrences: pendingOccurrenceRows.length,
      batches: pendingBatchRows.length,
      pickups: scheduledPickupRows.length,
    });
    setTowerNotifications(merged);
  }, []);

  useEffect(() => {
    loadRecentOccurrences();
  }, [loadRecentOccurrences]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadCollectionTracking();
    }, 280);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadCollectionTracking]);

  useEffect(() => {
    loadTowerNotifications();
    const intervalId = window.setInterval(() => {
      loadTowerNotifications();
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadTowerNotifications]);

  useEffect(() => {
    localStorage.setItem(SHOW_FILTERS_STORAGE_KEY, showFilters ? '1' : '0');
  }, [showFilters]);

  useEffect(() => {
    localStorage.setItem(SHOW_KPIS_STORAGE_KEY, showKpis ? '1' : '0');
  }, [showKpis]);

  useEffect(() => {
    if (!isNotificationMenuOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationMenuRef.current?.contains(event.target as Node)) {
        setIsNotificationMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotificationMenuOpen]);

  useEffect(() => {
    if (!highlightedOccurrenceId) return undefined;

    const timeoutId = window.setTimeout(() => {
      setHighlightedOccurrenceId(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [highlightedOccurrenceId]);

  useEffect(() => {
    if (!receiptConfirmBatchCode) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !receivingBatchCode) {
        setReceiptConfirmBatchCode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [receiptConfirmBatchCode, receivingBatchCode]);

  useEffect(() => {
    if (!collectionCancellationDialog) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !cancellingCollectionInvoice) {
        setCollectionCancellationDialog(null);
        setCollectionCancellationReason('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [collectionCancellationDialog, cancellingCollectionInvoice]);

  useEffect(() => {
    if (!collectionOccurrenceDialog) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCollectionOccurrenceDialog(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [collectionOccurrenceDialog]);

  async function applyFlowFilterAndOpen(next: Partial<ControlTowerFilters>) {
    const merged = { ...flowFilters, ...next };
    setPageIndex(0);
    setFlowFilters(merged);
    const firstRow = await getReturnsTable(merged, { pageIndex: 0, pageSize: 1 }, sortingInput);
    setSelectedId(firstRow.rows[0]?.id || null);
  }

  function applyAnalyticsFilter(next: Partial<ControlTowerFilters>) {
    setAnalyticsFilters((prev) => ({ ...prev, ...next }));
  }

  async function handleExport() {
    const response = await getReturnsTable(analyticsFilters, { pageIndex: 0, pageSize: 3000 }, sortingInput);
    const csv = exportRowsToCsv(response.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `control-tower-${getTodayDateInput()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetAnalyticsFilters() {
    setAnalyticsFilters(buildDefaultFilters());
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user_permission');
    delete axios.defaults.headers.common.Authorization;
    navigate('/');
  }

  async function refreshAll() {
    await Promise.all([
      summary.refetch(),
      charts.refetch(),
      queue.refetch(),
      table.refetch(),
      loadRecentOccurrences(),
      loadTowerNotifications(),
      loadCollectionTracking(),
    ]);
  }

  async function refreshAnalytics() {
    await Promise.all([
      summary.refetch(),
      charts.refetch(),
    ]);
  }

  function markNotificationsAsRead() {
    const now = Date.now();
    setNotificationsSeenAt(now);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, String(now));
  }

  function markNotificationAsRead(date: string) {
    const notificationDate = new Date(date).getTime();
    if (Number.isNaN(notificationDate)) return;

    setNotificationsSeenAt((previous) => {
      const next = Math.max(previous, notificationDate);
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, String(next));
      return next;
    });
  }

  function handleNotificationClick(notification: TowerNotificationEntry) {
    markNotificationAsRead(notification.date);
    setIsNotificationMenuOpen(false);

    if (notification.type === 'occurrence' && notification.occurrenceId) {
      const occurrenceId = notification.occurrenceId;
      occurrenceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      window.setTimeout(() => {
        const target = occurrenceItemRefs.current.get(occurrenceId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedOccurrenceId(occurrenceId);
        }
      }, 180);
      return;
    }

    if (notification.type === 'pickup') {
      const invoiceDigits = String(notification.invoiceNumber || '').replace(/\D/g, '').slice(0, 9);
      if (invoiceDigits) {
        setCollectionTrackingNf(invoiceDigits);
      }
      collectionTrackingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (notification.type === 'batch') {
      pendingBatchesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleOpenBatchInvoice(batch: IReturnBatch, invoiceNumber: string) {
    const normalizedInvoice = String(invoiceNumber || '').trim();
    const invoiceDigits = normalizedInvoice.replace(/\D/g, '').slice(0, 9);
    const firstInvoice = String(batch.notes?.[0]?.invoice_number || '').trim();
    const firstInvoiceDigits = firstInvoice.replace(/\D/g, '').slice(0, 9);
    const normalizeInvoiceDigits = (value: string) => String(value || '').replace(/\D/g, '').slice(0, 9);
    const matchedNote = (batch.notes || []).find((note) => (
      normalizeInvoiceDigits(note.invoice_number) === invoiceDigits
      || String(note.invoice_number || '').trim() === normalizedInvoice
    ));
    const firstBatchNote = (batch.notes || [])[0];
    const nextReturnType = (matchedNote?.return_type || firstBatchNote?.return_type || 'all') as ControlTowerFilters['returnType'];

    if (invoiceDigits) {
      applyFlowFilterAndOpen({ search: invoiceDigits, invoiceNumber: '', returnType: nextReturnType });
      return;
    }

    if (firstInvoiceDigits) {
      applyFlowFilterAndOpen({
        search: firstInvoiceDigits,
        invoiceNumber: '',
        returnType: (firstBatchNote?.return_type || 'all') as ControlTowerFilters['returnType'],
      });
      return;
    }

    applyFlowFilterAndOpen({
      search: normalizedInvoice || firstInvoice,
      invoiceNumber: '',
      returnType: nextReturnType,
    });
  }

  function handleOpenCollectionInvoice(invoiceNumber?: string | null) {
    const invoiceDigits = String(invoiceNumber || '').replace(/\D/g, '').slice(0, 9);
    if (!invoiceDigits) return;
    applyFlowFilterAndOpen({ search: invoiceDigits, invoiceNumber: '', returnType: 'all' });
    returnsTableSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleConfirmBatchReceipt(batchCode: string) {
    if (!canConfirmTowerBatchReceipt) {
      alert('Somente a Torre de Controle pode confirmar o recebimento do lote.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Sessão inválida. Faça login novamente.');
      return;
    }

    setReceiptConfirmBatchCode(batchCode);
  }

  function closeReceiptConfirmModal() {
    if (receivingBatchCode) return;
    setReceiptConfirmBatchCode(null);
  }

  async function confirmBatchReceiptWithModal() {
    const batchCode = receiptConfirmBatchCode;
    if (!batchCode) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setReceiptConfirmBatchCode(null);
      alert('Sessão inválida. Faça login novamente.');
      return;
    }

    setReceivingBatchCode(batchCode);
    try {
      await axios.put(`${API_URL}/returns/batches/${encodeURIComponent(batchCode)}/confirm-receipt`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshAll();
      alert(`Lote ${batchCode} marcado como recebido.`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao confirmar recebimento do lote.');
      } else {
        alert('Erro ao confirmar recebimento do lote.');
      }
    } finally {
      setReceivingBatchCode(null);
      setReceiptConfirmBatchCode(null);
    }
  }

  function openById(id: string) {
    setSelectedId(id);
  }

  function quickUpdateStatus(id: string, status: BacklogStatus) {
    if (!canManageStatus) return;
    updateStatusMutation.mutate({ pickupId: id, status });
  }

  function quickCancelPickup(id: string) {
    const row = getSelectedFromCache(id);
    if (row?.status === 'COLETADA') return;
    updateStatusMutation.mutate({ pickupId: id, status: 'CANCELADA' });
  }

  function quickTogglePriority(id: string, pickupPriority: boolean) {
    prioritizePickupMutation.mutate({ returnId: id, pickupPriority });
  }

  async function handleRegisterOccurrenceFromDrawer(payload: RegisterControlTowerOccurrenceInput) {
    try {
      await registerOccurrenceMutation.mutateAsync(payload);
      await refreshAll();
      alert('Ocorrência registrada e enviada para a transportadora.');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao registrar ocorrência.');
        return;
      }

      alert('Erro ao registrar ocorrência.');
    }
  }

  async function handleFinalizeOccurrenceCredit(occurrenceId: number) {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Sessão inválida. Faça login novamente.');
      return;
    }

    try {
      await axios.put(`${API_URL}/occurrences/credit/${occurrenceId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await refreshAll();
      alert(`Crédito da ocorrência #${occurrenceId} finalizado com sucesso.`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao finalizar crédito da ocorrência.');
      } else {
        alert('Erro ao finalizar crédito da ocorrência.');
      }
    }
  }

  function handleRegisterNfInputChange(value: string) {
    const normalizedNf = value.replace(/\D/g, '').slice(0, 9);
    setRegisterNf(normalizedNf);
    setRegisterDanfe(null);
    setRegisterExistingRows([]);
    setRegisterPartialQuantities({});
  }

  function handleRegisterPartialQuantityChange(productKey: string, value: string) {
    setRegisterPartialQuantities((previous) => ({
      ...previous,
      [productKey]: value.replace(',', '.'),
    }));
  }

  function clearRegisterPartialQuantities() {
    setRegisterPartialQuantities((previous) => {
      const next: Record<string, string> = {};
      Object.keys(previous).forEach((key) => {
        next[key] = '';
      });
      return next;
    });
  }

  async function loadRegisterContextByNf(nf: string) {
    const normalizedNf = nf.trim();
    const [existingResponse, danfeResponse] = await Promise.all([
      axios.get<ICollectionRequest[]>(`${API_URL}/collection-requests/search`, {
        params: {
          invoice_number: normalizedNf,
          status: 'all',
          limit: 260,
        },
      }),
      axios.get<IDanfe | null>(`${API_URL}/danfes/nf/${normalizedNf}`),
    ]);

    const existingRows = Array.isArray(existingResponse.data) ? existingResponse.data : [];
    const danfe = danfeResponse?.data;

    if (!danfe) {
      throw new Error(NF_NOT_FOUND_MESSAGE);
    }

    const hasCustomerData = String(danfe.Customer?.name_or_legal_entity || '').trim();
    const hasCityData = String(danfe.Customer?.city || '').trim();
    if (!hasCustomerData || !hasCityData) {
      throw new Error(
        'A NF foi localizada, mas os dados estao incompletos. Entre em contato com a expedicao da transportadora para revisar o XML.',
      );
    }

    const nextProductRows = buildRegisterCollectionProductRows(danfe, existingRows);
    setRegisterDanfe(danfe);
    setRegisterExistingRows(existingRows);
    setRegisterPartialQuantities((previous) => {
      const next: Record<string, string> = {};
      nextProductRows.forEach((row) => {
        next[row.key] = previous[row.key] || '';
      });
      return next;
    });

    return {
      danfe,
      existingRows,
      productRows: nextProductRows,
    };
  }

  async function handleLoadRegisterContext() {
    if (!canManageCollectionRequests) {
      alert('Somente a Torre de Controle pode validar NF para coleta manual.');
      return;
    }

    const nf = registerNf.trim();
    if (!nf) {
      alert('Informe a NF para validar os dados da coleta.');
      return;
    }

    setLoadingRegisterContext(true);
    try {
      const { existingRows } = await loadRegisterContextByNf(nf);
      const activeCount = existingRows.filter((row) => normalizeCollectionWorkflowStatus(row) !== 'cancelada').length;
      alert(
        activeCount
          ? `NF ${nf} validada. Existem ${activeCount} coleta(s) ativa(s) para acompanhamento.`
          : `NF ${nf} validada. Pronta para registrar nova coleta.`,
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          alert(NF_NOT_FOUND_MESSAGE);
          return;
        }
        alert(error.response?.data?.error || 'Erro ao validar NF para coleta.');
        return;
      }

      if (error instanceof Error) {
        alert(error.message || 'Erro ao validar NF para coleta.');
        return;
      }

      alert('Erro ao validar NF para coleta.');
    } finally {
      setLoadingRegisterContext(false);
    }
  }

  async function handleRegisterPickupByNf() {
    const nf = registerNf.trim();
    if (!nf) {
      alert('Informe a NF para registrar a coleta.');
      return;
    }

    if (!canManageCollectionRequests) {
      alert('Somente a Torre de Controle pode registrar coleta manual por NF.');
      return;
    }

    setRegisteringPickup(true);
    try {
      const registerContextIsLoaded = Boolean(registerDanfe) && String(registerDanfe?.invoice_number || '').trim() === nf;
      const context = registerContextIsLoaded
        ? {
          danfe: registerDanfe as IDanfe,
          existingRows: registerExistingRows,
          productRows: registerProductRows,
        }
        : await loadRegisterContextByNf(nf);

      const activeRows = context.existingRows.filter((row) => normalizeCollectionWorkflowStatus(row) !== 'cancelada');
      const hasActiveInvoiceTotal = activeRows.some((row) => resolveCollectionRequestScope(row) === 'invoice_total');

      if (registerScope === 'invoice_total') {
        if (hasActiveInvoiceTotal || activeRows.some((row) => resolveCollectionRequestScope(row) === 'items')) {
          const activeRow = activeRows[0];
          setCollectionTrackingNf(nf);
          collectionTrackingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          alert(
            `Ja existe coleta ativa para NF ${nf} (ID ${activeRow?.id || '-'} | ${activeRow ? formatCollectionWorkflowStatus(activeRow) : 'Solicitada'}). `
            + 'Cancele/conclua a coleta atual antes de registrar NF total novamente.',
          );
          return;
        }

        const payloads = buildManualCollectionPayloads(context.danfe, nf);
        await Promise.all(payloads.map((payload) => axios.post(`${API_URL}/collection-requests`, payload)));

        setCollectionTrackingNf(nf);
        await refreshAll();
        handleRegisterNfInputChange('');
        alert(`Coleta total registrada para a NF ${nf}.`);
        return;
      }

      if (hasActiveInvoiceTotal) {
        setCollectionTrackingNf(nf);
        collectionTrackingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        alert(`A NF ${nf} possui coleta total ativa. Cancele ou conclua a coleta total antes de registrar itens parciais.`);
        return;
      }

      if (!context.productRows.length) {
        alert('Nao foi possivel carregar itens da NF para coleta parcial.');
        return;
      }

      const selectedPayloads: ManualCollectionRequestPayload[] = [];
      for (const productRow of context.productRows) {
        const rawInput = String(registerPartialQuantities[productRow.key] || '').trim();
        if (!rawInput) continue;

        const parsedQuantity = parseNumericInput(rawInput);
        if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
          alert(`Quantidade invalida para o produto ${productRow.productId}.`);
          return;
        }

        if (!productRow.isKg && !Number.isInteger(parsedQuantity)) {
          alert(`A quantidade do produto ${productRow.productId} deve ser inteira.`);
          return;
        }

        const normalizedQuantity = normalizeCollectionQuantity(parsedQuantity, productRow.isKg);
        if (normalizedQuantity - productRow.remainingCollectable > 0.000001) {
          alert(
            `Quantidade excede o saldo da NF para o produto ${productRow.productId}. `
            + `Restante coletavel: ${formatCollectionQuantity(productRow.remainingCollectable)}.`,
          );
          return;
        }

        selectedPayloads.push({
          invoice_number: nf,
          request_code: buildCollectionRequestCode(nf, productRow.productId),
          customer_name: String(context.danfe.Customer?.name_or_legal_entity || '').trim(),
          city: String(context.danfe.Customer?.city || '').trim(),
          product_id: productRow.productId,
          product_description: productRow.productDescription || `Produto ${productRow.productId}`,
          product_type: productRow.productType || null,
          quantity: normalizedQuantity,
          request_scope: 'items',
          urgency_level: 'media',
          notes: 'Solicitacao manual parcial registrada pela Torre de Controle.',
        });
      }

      if (!selectedPayloads.length) {
        alert('Informe ao menos uma quantidade de produto para registrar coleta parcial.');
        return;
      }

      await Promise.all(selectedPayloads.map((payload) => axios.post(`${API_URL}/collection-requests`, payload)));
      await refreshAll();
      handleRegisterNfInputChange('');
      setCollectionTrackingNf(nf);
      alert(`Coleta parcial registrada para a NF ${nf} (${selectedPayloads.length} item(ns)).`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          alert(NF_NOT_FOUND_MESSAGE);
          return;
        }

        alert(error.response?.data?.error || 'Erro ao validar NF e registrar coleta.');
        return;
      }

      if (error instanceof Error) {
        alert(error.message || 'Erro ao validar NF e registrar coleta.');
        return;
      }

      alert('Erro ao validar NF e registrar coleta.');
    } finally {
      setRegisteringPickup(false);
    }
  }

  function closeCollectionCancellationDialog() {
    if (cancellingCollectionInvoice) return;
    setCollectionCancellationDialog(null);
    setCollectionCancellationReason('');
  }

  function handleCancelCollectionRequest(request: ICollectionRequest) {
    if (!canManageCollectionRequests) {
      alert('Somente a Torre de Controle pode cancelar coleta manual.');
      return;
    }

    const workflowStatus = normalizeCollectionWorkflowStatus(request);
    if (!CANCELLABLE_TRACKING_WORKFLOW_STATUSES.includes(workflowStatus)) {
      alert('Cancelamento direto so e permitido enquanto a coleta ainda nao foi agendada.');
      return;
    }

    setCollectionCancellationReason('');
    setCollectionCancellationDialog({
      mode: 'direct_cancel',
      request,
    });
  }

  function handleRequestCollectionCancellation(request: ICollectionRequest) {
    if (!canManageCollectionRequests) {
      alert('Somente a Torre de Controle pode solicitar cancelamento de coleta.');
      return;
    }

    const workflowStatus = normalizeCollectionWorkflowStatus(request);
    if (!REQUEST_CANCELLATION_TRACKING_WORKFLOW_STATUSES.includes(workflowStatus)) {
      alert('Solicitacao de cancelamento so pode ser feita para coletas agendadas.');
      return;
    }

    setCollectionCancellationReason('');
    setCollectionCancellationDialog({
      mode: 'request_cancellation',
      request,
    });
  }

  async function confirmCollectionCancellationDialog() {
    if (!collectionCancellationDialog) return;

    const { request, mode } = collectionCancellationDialog;
    const reasonText = String(collectionCancellationReason || '').trim();

    if (mode === 'request_cancellation' && !reasonText) {
      alert('Informe o motivo da solicitacao de cancelamento.');
      return;
    }

    setCancellingCollectionInvoice(String(request.id));
    try {
      if (mode === 'direct_cancel') {
        await axios.patch(`${API_URL}/collection-requests/${request.id}/status`, {
          workflow_status: 'cancelada',
        });
      } else {
        const requestCancellationPayloads = [
          { workflow_status: 'cancelamento_solicitado', reason: reasonText },
          { workflow_status: 'cancellation_requested', reason: reasonText },
        ];
        let sentCancellationRequest = false;
        let lastError: unknown = null;

        for (const payload of requestCancellationPayloads) {
          try {
            // Compat fallback: some environments may still recognize the legacy english alias.
            // eslint-disable-next-line no-await-in-loop
            await axios.patch(`${API_URL}/collection-requests/${request.id}/status`, payload);
            sentCancellationRequest = true;
            break;
          } catch (error) {
            lastError = error;
            if (!axios.isAxiosError(error)) {
              throw error;
            }

            const apiMessage = String(error.response?.data?.error || '');
            if (!isCollectionInvalidStatusMessage(apiMessage)) {
              throw error;
            }
          }
        }

        if (!sentCancellationRequest) {
          throw lastError || new Error('Falha ao solicitar cancelamento da coleta.');
        }
      }

      await refreshAll();

      const registerNfValue = registerNf.trim();
      const requestInvoice = String(request.invoice_number || '').trim();
      if (registerNfValue && requestInvoice && registerNfValue === requestInvoice) {
        await loadRegisterContextByNf(registerNfValue);
      }

      if (mode === 'direct_cancel') {
        alert(`Coleta #${request.id} cancelada com sucesso.`);
      } else {
        alert(`Solicitacao de cancelamento enviada para a transportadora na coleta #${request.id}.`);
      }

      closeCollectionCancellationDialog();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiMessage = String(error.response?.data?.error || '');
        if (isCollectionInvalidStatusMessage(apiMessage)) {
          alert(
            'Nao foi possivel solicitar o cancelamento da coleta agora. '
            + 'O status enviado nao foi reconhecido pelo backend. '
            + 'Tente novamente em alguns instantes e, se persistir, acione o suporte para atualizar a API.',
          );
        } else {
          alert(apiMessage || 'Erro ao processar cancelamento da coleta.');
        }
      } else {
        alert('Erro ao processar cancelamento da coleta.');
      }
    } finally {
      setCancellingCollectionInvoice(null);
    }
  }

  const filteredCollectionTrackingRows = useMemo(
    () => (
      collectionTrackingOnlyWithNotes
        ? collectionTrackingRows.filter((row) => hasCollectionNotes(row.notes))
        : collectionTrackingRows
    ),
    [collectionTrackingOnlyWithNotes, collectionTrackingRows],
  );
  const visibleCollectionTrackingRows = filteredCollectionTrackingRows.slice(0, 80);
  const collectionOccurrenceNotes = collectionOccurrenceDialog
    ? getCollectionNoteDetails(collectionOccurrenceDialog.notes)
    : [];
  const collectionOccurrenceHasNotes = collectionOccurrenceNotes.length > 0;
  const collectionOccurrenceLatestNote = collectionOccurrenceHasNotes
    ? collectionOccurrenceNotes[collectionOccurrenceNotes.length - 1]
    : null;

  return (
    <div className="min-h-screen bg-[#070f1a] px-3 py-3 text-slate-100 lg:px-4">
      <div className="mx-auto max-w-[1550px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Control Tower | KP Transportes + Mar e Rio</h1>
            <p className="text-sm text-slate-400">Visão ampla de volume, tendência, gargalo e ação imediata.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div ref={notificationMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationMenuOpen((current) => !current)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                title="Abrir notificações"
                aria-label="Abrir notificações"
                aria-expanded={isNotificationMenuOpen}
              >
                <Bell className="h-5 w-5" />
                {pendingSituationsCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full border border-amber-300/70 bg-amber-500 px-1 py-0.5 text-[10px] font-bold leading-none text-slate-950">
                    {pendingSituationsCount > 99 ? '99+' : pendingSituationsCount}
                  </span>
                ) : null}
              </button>

              {isNotificationMenuOpen ? (
                <div className="absolute right-0 top-11 z-50 w-[360px] max-w-[calc(100vw-1.5rem)] rounded-lg border border-slate-700 bg-[#0b1624] shadow-[0_16px_36px_rgba(2,6,23,0.65)]">
                  <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">Notificações</span>
                    <button
                      type="button"
                      onClick={markNotificationsAsRead}
                      className="text-[11px] font-semibold text-sky-300 hover:text-sky-200"
                    >
                      Marcar lidas
                    </button>
                  </div>
                  {!towerNotifications.length ? (
                    <p className="px-3 py-3 text-xs text-slate-400">Sem notificações no momento.</p>
                  ) : (
                    <ul className="max-h-[320px] space-y-1 overflow-auto p-2">
                      {towerNotifications.map((notification) => {
                        const notificationDateMs = new Date(notification.date).getTime();
                        const isUnread = !Number.isNaN(notificationDateMs) && notificationDateMs > notificationsSeenAt;
                        const typeLabel = notification.type === 'occurrence'
                          ? 'Ocorrência'
                          : notification.type === 'batch'
                            ? 'Lote'
                            : 'Coleta';

                        return (
                          <li key={`menu-${notification.key}`}>
                            <button
                              type="button"
                              onClick={() => handleNotificationClick(notification)}
                              className={`w-full rounded-md border px-2.5 py-2 text-left transition ${isUnread
                                ? 'border-sky-500/60 bg-sky-900/20 hover:bg-sky-900/30'
                                : 'border-slate-700 bg-slate-900/50 hover:bg-slate-900/80'
                                }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-semibold text-slate-100">{typeLabel}</span>
                                {isUnread ? (
                                  <span className="rounded-full border border-sky-400/60 px-2 py-0.5 font-semibold text-sky-200">
                                    Novo
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 text-xs font-medium text-slate-100">{notification.title}</div>
                              <div className="mt-0.5 text-xs text-slate-300">{notification.description}</div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
            <Button tone="outline" className="border-slate-600 bg-slate-900 text-slate-100" onClick={logout}>Sair</Button>
          </div>
        </div>

        <Card className="border-amber-500/60 bg-gradient-to-br from-amber-900/25 to-[#101b2b] shadow-[0_0_0_1px_rgba(245,158,11,0.18)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-amber-100">Registrar Coleta</h3>
              <p className="text-xs text-amber-200/80">Selecione NF total ou parcial por itens, com controle de saldo por produto.</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="grid gap-2 md:grid-cols-[minmax(0,220px)_minmax(0,190px)_auto]">
              <label htmlFor="register-pickup-nf" className="text-xs font-medium text-slate-200">
                NF para coleta
                <input
                  id="register-pickup-nf"
                  value={registerNf}
                  onChange={(event) => handleRegisterNfInputChange(event.target.value)}
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="Digite a NF"
                  className="mt-1 h-10 w-full rounded-sm border border-amber-500/35 bg-slate-900 px-3 text-sm text-slate-100"
                />
              </label>
              <label className="text-xs font-medium text-slate-200">
                Escopo
                <select
                  value={registerScope}
                  onChange={(event) => setRegisterScope(event.target.value as RegisterCollectionScope)}
                  className="mt-1 h-10 w-full rounded-sm border border-amber-500/35 bg-slate-900 px-3 text-sm text-slate-100"
                >
                  <option value="invoice_total">NF total</option>
                  <option value="items">Parcial por itens</option>
                </select>
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  tone="outline"
                  className="h-10 border-amber-500/45 bg-slate-900 text-amber-100 hover:bg-slate-800 disabled:opacity-60"
                  onClick={handleLoadRegisterContext}
                  disabled={!canManageCollectionRequests || loadingRegisterContext || registeringPickup}
                >
                  {loadingRegisterContext ? 'Validando...' : 'Validar NF'}
                </Button>
                <Button
                  tone="secondary"
                  className="h-10 bg-amber-700/80 text-amber-50 hover:bg-amber-600 disabled:opacity-60"
                  onClick={handleRegisterPickupByNf}
                  disabled={!canManageCollectionRequests || loadingRegisterContext || registeringPickup}
                >
                  {registeringPickup ? 'Registrando...' : 'Registrar coleta'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              A coleta parcial respeita o saldo por item da NF (qtd original - total já coletado em status confirmado).
            </p>

            {!canManageCollectionRequests ? (
              <p className="rounded-sm border border-rose-500/50 bg-rose-900/25 px-2 py-1 text-xs text-rose-100">
                Seu perfil não possui permissão para registrar/cancelar coleta manual.
              </p>
            ) : null}

            {registerDanfe ? (
              <div className="rounded-sm border border-amber-500/35 bg-slate-900/55 px-3 py-2 text-xs text-slate-200">
                <div>
                  <strong>{`NF ${registerDanfe.invoice_number || registerNf}`}</strong>
                  {` | Cliente: ${registerDanfe.Customer?.name_or_legal_entity || '-'}`}
                  {` | Cidade: ${registerDanfe.Customer?.city || '-'}`}
                </div>
                <div className="mt-1 text-slate-300">
                  {`Coletas ativas na NF: ${registerActiveRows.length}`}
                  {registerHasActiveInvoiceTotal ? ' | Existe coleta NF total ativa' : ''}
                  {registerHasActiveItems ? ' | Existe coleta parcial ativa' : ''}
                </div>
              </div>
            ) : null}

            {registerScope === 'items' && registerDanfe ? (
              <div className="rounded-sm border border-slate-700 bg-slate-900/50 px-3 py-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-100">Itens da NF para coleta parcial</p>
                  <button
                    type="button"
                    onClick={clearRegisterPartialQuantities}
                    className="rounded-md border border-slate-600 bg-slate-800/70 px-2 py-0.5 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-700"
                  >
                    Limpar quantidades
                  </button>
                </div>

                {!registerProductRows.length ? (
                  <p className="text-xs text-slate-300">Nenhum item da NF disponível para coleta parcial.</p>
                ) : (
                  <ul className="max-h-[260px] space-y-2 overflow-auto pr-1">
                    {registerProductRows.map((productRow) => (
                      <li key={`register-product-${productRow.key}`} className="rounded-sm border border-slate-700 bg-slate-900/70 px-2 py-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-100">
                              {`${productRow.productId} - ${productRow.productDescription}`}
                            </div>
                            <div className="text-[11px] text-slate-300">
                              {`Tipo: ${productRow.productType || 'N/A'}`}
                              {` | Original: ${formatCollectionQuantity(productRow.quantityOriginal)}`}
                              {` | Coletado: ${formatCollectionQuantity(productRow.totalCollected)}`}
                              {` | Restante: ${formatCollectionQuantity(productRow.remainingCollectable)}`}
                            </div>
                          </div>
                          <label className="text-[11px] text-slate-300">
                            Qtd a coletar
                            <input
                              value={registerPartialQuantities[productRow.key] || ''}
                              onChange={(event) => handleRegisterPartialQuantityChange(productRow.key, event.target.value)}
                              inputMode={productRow.isKg ? 'decimal' : 'numeric'}
                              step={productRow.isKg ? '0.001' : '1'}
                              min={productRow.isKg ? '0.001' : '1'}
                              placeholder="0"
                              disabled={productRow.remainingCollectable <= 0 || registerHasActiveInvoiceTotal}
                              className="mt-1 h-8 w-[110px] rounded-sm border border-slate-600 bg-slate-950 px-2 text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </label>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {registerHasActiveInvoiceTotal ? (
                  <p className="mt-2 rounded-sm border border-rose-500/40 bg-rose-900/20 px-2 py-1 text-xs text-rose-200">
                    Existe uma coleta NF total ativa. Para registrar parcial, cancele/conclua a coleta total primeiro.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <div ref={collectionTrackingSectionRef}>
          <Card className="border-slate-700 bg-[#101b2b]">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Acompanhamento de coletas</h3>
                <p className="text-xs text-slate-400">Visualize qualquer coleta por NF e acompanhe o status em toda a esteira.</p>
              </div>
              <Button
                tone="outline"
                className="h-8 border-slate-600 bg-slate-900 text-[11px] text-slate-100 hover:bg-slate-800"
                onClick={loadCollectionTracking}
                disabled={collectionTrackingLoading}
              >
                {collectionTrackingLoading ? 'Atualizando...' : 'Atualizar'}
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,220px)_1fr]">
              <label className="text-xs text-slate-300">
                NF
                <input
                  value={collectionTrackingNf}
                  onChange={(event) => setCollectionTrackingNf(event.target.value.replace(/\D/g, '').slice(0, 9))}
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="Buscar por NF"
                  className="mt-1 h-9 w-full rounded-sm border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100"
                />
              </label>

              <label className="text-xs text-slate-300">
                Status
                <select
                  value={collectionTrackingStatus}
                  onChange={(event) => setCollectionTrackingStatus(event.target.value as CollectionTrackingStatus)}
                  className="mt-1 h-9 w-full rounded-sm border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100"
                >
                  {COLLECTION_TRACKING_STATUS_OPTIONS.map((option) => (
                    <option key={`tracking-status-${option.value}`} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-end gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={collectionTrackingOnlyWithNotes}
                  onChange={(event) => setCollectionTrackingOnlyWithNotes(event.target.checked)}
                  className="h-4 w-4 rounded border border-slate-600 bg-slate-900"
                />
                Somente com ocorrência
              </label>

              <div className="flex items-end">
                <p className="text-xs text-slate-300">
                  {collectionTrackingLoading
                    ? 'Carregando coletas...'
                    : `${filteredCollectionTrackingRows.length} coleta(s) encontrada(s).`}
                </p>
              </div>
            </div>

            {collectionTrackingError ? (
              <p className="mt-2 rounded-sm border border-red-500/40 bg-red-900/20 px-2 py-1 text-xs text-red-200">
                {collectionTrackingError}
              </p>
            ) : null}

            {!collectionTrackingLoading && !collectionTrackingError && !filteredCollectionTrackingRows.length ? (
              <p className="mt-2 text-xs text-slate-400">
                {collectionTrackingOnlyWithNotes
                  ? 'Nenhuma coleta com ocorrência encontrada para os filtros informados.'
                  : 'Nenhuma coleta encontrada para os filtros informados.'}
              </p>
            ) : null}

            {!collectionTrackingLoading && !collectionTrackingError && !!visibleCollectionTrackingRows.length ? (
              <ul className="mt-2 max-h-[340px] space-y-2 overflow-auto pr-1">
                {visibleCollectionTrackingRows.map((request) => {
                  const canOpenFlow = canOpenCollectionInFlow(request);
                  const workflowStatus = normalizeCollectionWorkflowStatus(request);
                  const canCancelCollectionDirectly = canManageCollectionRequests
                    && CANCELLABLE_TRACKING_WORKFLOW_STATUSES.includes(workflowStatus);
                  const canRequestCollectionCancellation = canManageCollectionRequests
                    && REQUEST_CANCELLATION_TRACKING_WORKFLOW_STATUSES.includes(workflowStatus);
                  const notesCount = getCollectionNotesCount(request.notes);
                  const hasNotes = notesCount > 0;
                  const occurrenceLabel = hasNotes
                    ? `Com ocorrência${notesCount > 1 ? ` (${notesCount})` : ''}`
                    : 'Sem ocorrência';
                  const quantityWithType = `${formatCollectionQuantity(Number(request.quantity || 0))}${normalizeProductType(request.product_type) || ''}`;
                  const scopeLabel = resolveCollectionRequestScope(request) === 'invoice_total'
                    ? 'NF total'
                    : 'Parcial (itens)';

                  return (
                    <li key={`tracking-collection-${request.id}`} className="rounded-sm border border-slate-700 bg-slate-900/55 px-3 py-2 text-xs text-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <strong>{`#${request.id}`}</strong>
                          {` | NF ${request.invoice_number || '-'}`}
                          {` | ${request.customer_name || '-'}`}
                          {` | ${request.city || '-'}`}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="rounded-md border border-sky-500/40 bg-sky-900/25 px-2 py-0.5 text-[11px] font-semibold text-sky-100">
                            {formatCollectionWorkflowStatus(request)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCollectionOccurrenceDialog(request)}
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition ${
                              hasNotes
                                ? 'border-amber-400/60 bg-amber-700/25 text-amber-100 hover:bg-amber-700/35'
                                : 'border-slate-600 bg-slate-800/70 text-slate-200 hover:bg-slate-700/80'
                            }`}
                          >
                            {occurrenceLabel}
                          </button>
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
                        <span>
                          {`Produto: ${request.product_id ? `${request.product_id} - ` : ''}${request.product_description || '-'}`}
                          {` | Qtd: ${quantityWithType}`}
                          {` | Escopo: ${scopeLabel}`}
                        </span>
                        {request.scheduled_for ? (
                          <span className="rounded-md border border-emerald-400/70 bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-100">
                            {`Agendada para ${formatDateBR(request.scheduled_for)}`}
                          </span>
                        ) : null}
                        {request.sent_in_batch_code ? (
                          <span className="rounded-md border border-slate-600 bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                            {`Lote: ${request.sent_in_batch_code}`}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>{`Criada: ${formatDateTimeLabel(request.created_at)}`}</span>
                        <span>{`Atualizada: ${formatDateTimeLabel(request.updated_at)}`}</span>
                        {request.invoice_number && canOpenFlow ? (
                          <button
                            type="button"
                            onClick={() => handleOpenCollectionInvoice(request.invoice_number)}
                            className="rounded-md border border-amber-500/40 bg-amber-900/20 px-2 py-0.5 font-semibold text-amber-100 transition hover:bg-amber-900/35"
                          >
                            Abrir NF no fluxo
                          </button>
                        ) : null}
                        {request.invoice_number && !canOpenFlow ? (
                          <span className="rounded-md border border-slate-600 bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                            Vai para o fluxo após envio em lote
                          </span>
                        ) : null}
                        {canCancelCollectionDirectly ? (
                          <button
                            type="button"
                            onClick={() => handleCancelCollectionRequest(request)}
                            disabled={cancellingCollectionInvoice === String(request.id)}
                            className="inline-flex h-7 items-center rounded-md border border-rose-400/70 bg-gradient-to-r from-rose-700/80 to-rose-600/75 px-2.5 text-[11px] font-bold tracking-wide text-rose-50 shadow-[0_8px_16px_rgba(190,24,93,0.28)] transition hover:from-rose-600 hover:to-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cancellingCollectionInvoice === String(request.id) ? 'Cancelando...' : 'Cancelar coleta'}
                          </button>
                        ) : null}
                        {canRequestCollectionCancellation ? (
                          <button
                            type="button"
                            onClick={() => handleRequestCollectionCancellation(request)}
                            disabled={cancellingCollectionInvoice === String(request.id)}
                            className="inline-flex h-7 items-center rounded-md border border-amber-300/70 bg-gradient-to-r from-amber-700/85 to-amber-600/80 px-2.5 text-[11px] font-bold tracking-wide text-amber-50 shadow-[0_8px_16px_rgba(217,119,6,0.26)] transition hover:from-amber-600 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cancellingCollectionInvoice === String(request.id) ? 'Enviando...' : 'Solicitar cancelamento'}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {!collectionTrackingLoading && !collectionTrackingError && filteredCollectionTrackingRows.length > visibleCollectionTrackingRows.length ? (
              <p className="mt-2 text-[11px] text-slate-400">
                {`Mostrando 80 de ${filteredCollectionTrackingRows.length} coleta(s). Refine por NF/status para reduzir a lista.`}
              </p>
            ) : null}
          </Card>
        </div>

        <div ref={actionQueueSectionRef}>
          <ActionQueue
            rows={queue.data || []}
            loading={queue.isLoading}
            canManageStatus={canManageStatus}
            onTogglePriority={quickTogglePriority}
            onCancelPickup={quickCancelPickup}
            onMarkInRoute={(id) => quickUpdateStatus(id, 'EM_ROTA')}
            onMarkCollected={(id) => quickUpdateStatus(id, 'COLETADA')}
            onOpen={openById}
          />
        </div>

        <div ref={occurrenceSectionRef}>
          <Card className="border-slate-800 bg-[#101b2b]">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Ocorrências com talão (pendentes de crédito)</h3>
              <span className="text-xs text-slate-400">Pendências até confirmação do crédito</span>
            </div>
            {!recentOccurrences.length ? (
              <p className="text-xs text-slate-400">Nenhuma ocorrência com talão pendente de crédito.</p>
            ) : (
              <ul className="space-y-2">
                {recentOccurrences.map((occurrence) => (
                  <li
                    key={occurrence.id}
                    ref={(element) => {
                      if (element) occurrenceItemRefs.current.set(occurrence.id, element);
                      else occurrenceItemRefs.current.delete(occurrence.id);
                    }}
                    className={`rounded-sm border px-3 py-2 text-xs text-slate-200 transition ${highlightedOccurrenceId === occurrence.id
                      ? 'border-amber-400/70 bg-amber-900/25 ring-1 ring-amber-300/40'
                      : 'border-slate-700 bg-slate-900/50'
                      }`}
                  >
                    <div>
                      <strong>NF {occurrence.invoice_number}</strong>
                      {` | Motivo: ${occurrence.reason || 'legacy_outros'}`}
                      {` | Escopo: ${occurrence.scope === 'invoice_total' ? 'NF total' : 'itens'}`}
                      {' | Status Torre: pendente de crédito'}
                    </div>
                    {occurrence.scope === 'items' && !!occurrence.items?.length ? (
                      <div className="mt-1 space-y-1 text-slate-300">
                        <div className="font-medium text-slate-200">Itens:</div>
                        {occurrence.items.map((item, index) => {
                          const itemCode = String(item.product_id || '').trim();
                          const itemDescription = String(item.product_description || '').trim();
                          const itemType = String(item.product_type || '').trim().toUpperCase();
                          const itemLabel = itemCode && itemDescription
                            ? `${itemCode} - ${itemDescription}`
                            : itemCode || itemDescription || 'Item';

                          return (
                            <div key={`ct-occ-item-${occurrence.id}-${itemCode}-${index}`} className="pl-2">
                              {itemLabel} | <strong>{`Qtd: ${Number(item.quantity || 0)}${itemType}`}</strong>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-1 text-slate-300">Itens: NF total</div>
                    )}
                    {occurrence.resolution_type === CONTROL_TOWER_OCCURRENCE_RESOLUTION ? (
                      <div className="mt-1 text-slate-300">
                        Resolução: Transportadora identificou a falta e solicita o crédito do valor para o cliente.
                        {occurrence.resolution_note ? ` | ${occurrence.resolution_note}` : ''}
                      </div>
                    ) : null}
                    {canFinalizeOccurrenceCredit ? (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => handleFinalizeOccurrenceCredit(occurrence.id)}
                          className="rounded-md border border-emerald-500/60 bg-emerald-700/25 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-700/40"
                        >
                          Confirmar crédito para o cliente
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div ref={pendingBatchesSectionRef}>
          <Card className="border-slate-800 bg-[#101b2b]">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Lotes de devolução pendentes de aprovação</h3>
              <span className="text-xs text-slate-400">{pendingBatches.length} pendente(s)</span>
            </div>
            <p className="mb-2 text-xs text-slate-400">
              Abra a NF do lote para registrar ocorrência, se necessário. Depois disso, confirme o recebimento do lote.
            </p>
            {!pendingBatches.length ? (
              <p className="text-xs text-slate-400">Nenhum lote aguardando recebimento pela Torre de Controle.</p>
            ) : (
              <ul className="space-y-2">
                {pendingBatches.map((batch) => (
                  <li key={`pending-batch-${batch.batch_code}`} className="rounded-sm border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong>{batch.batch_code}</strong>
                        {` | Enviado em: ${formatDateTimeLabel(batch.sent_to_control_tower_at)}`}
                        {` | NFs: ${batch.notes?.length || 0}`}
                      </div>
                      {canConfirmTowerBatchReceipt ? (
                        <Button
                          tone="secondary"
                          className="h-8 bg-emerald-700/80 px-3 text-[11px] font-semibold text-emerald-50 hover:bg-emerald-600 disabled:opacity-60"
                          onClick={() => handleConfirmBatchReceipt(batch.batch_code)}
                          disabled={receivingBatchCode === batch.batch_code}
                        >
                          {receivingBatchCode === batch.batch_code ? 'Confirmando...' : 'Marcar como recebido'}
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(batch.notes || []).slice(0, 10).map((note) => (
                        <button
                          key={`pending-batch-note-${batch.batch_code}-${note.id}`}
                          type="button"
                          onClick={() => handleOpenBatchInvoice(batch, note.invoice_number)}
                          className="rounded-md border border-amber-500/40 bg-amber-900/20 px-2 py-1 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-900/35"
                        >
                          {`Abrir NF ${note.invoice_number}`}
                        </button>
                      ))}
                      {(batch.notes?.length || 0) > 10 ? (
                        <span className="self-center text-[11px] text-slate-400">
                          {`+${(batch.notes?.length || 0) - 10} NF(s)`}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div ref={returnsTableSectionRef}>
          <ReturnsTable
            rows={table.data?.rows || []}
            total={table.data?.total || 0}
            loading={table.isLoading}
            returnTypeFilter={flowFilters.returnType}
            search={flowFilters.search}
            pageIndex={pageIndex}
            pageSize={pageSize}
            sorting={sorting}
            onPaginationChange={setPageIndex}
            onSortingChange={setSorting}
            onSearchChange={(search) => handleFlowFilterChange({ search, invoiceNumber: '' })}
            onFilterByReturnType={(returnType) => handleFlowFilterChange({ returnType })}
            onOpenDetails={openById}
          />
        </div>

        <section className="group rounded-lg border border-slate-800 bg-[#0b1624]/60">
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Filtros analíticos (KPIs e gráficos)</span>
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900/75 text-slate-300 transition ${showFilters ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                }`}
            >
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>
          {showFilters ? (
            <div className="border-t border-slate-800 p-2">
              <FiltersBar
                filters={analyticsFilters}
                options={options}
                updatedAgoLabel={updatedAgoLabel}
                onChange={handleAnalyticsFilterChange}
                onRefresh={refreshAnalytics}
                onReset={resetAnalyticsFilters}
                onExport={handleExport}
              />
            </div>
          ) : null}
        </section>

        <section className="group rounded-lg border border-slate-800 bg-[#101b2b]/60">
          <button
            type="button"
            onClick={() => setShowKpis((current) => !current)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Indicadores (KPIs)</span>
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900/75 text-slate-300 transition ${showKpis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                }`}
            >
              {showKpis ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>
          {showKpis ? (
            <div className="border-t border-slate-800 p-3">
              <KpiCards summary={summary.data} />
            </div>
          ) : null}
        </section>

        <div className="grid gap-3 xl:grid-cols-3">
          <Card className="border-slate-800 bg-[#101b2b]">
            <div className="mb-2 flex items-center justify-end">
              <select
                value={topMetric}
                onChange={(event) => setTopMetric(event.target.value as TopMetric)}
                className="h-8 rounded-sm border border-slate-700 bg-slate-900 px-2 text-xs"
              >
                <option value="quantity">Quantidade</option>
                <option value="weightKg">Peso (kg)</option>
                <option value="valueAmount">Valor (R$)</option>
              </select>
            </div>
            <TopHorizontalChart
              title="Top produtos devolvidos"
              subtitle={periodSubtitle}
              data={charts.data?.topProducts || []}
              metric={topMetric}
              color="#60a5fa"
              onBarClick={(name) => applyAnalyticsFilter({ product: name })}
            />
          </Card>

          <Card className="border-slate-800 bg-[#101b2b]">
            <TopHorizontalChart
              title="Top clientes que devolvem"
              subtitle={periodSubtitle}
              data={charts.data?.topClients || []}
              metric={topMetric}
              color="#f59e0b"
              onBarClick={(name) => applyAnalyticsFilter({ customer: name })}
            />
          </Card>

          <Card className="border-slate-800 bg-[#101b2b]">
            <ReasonsDonutChart
              data={charts.data}
              subtitle={periodSubtitle}
              onSliceClick={(reason) => applyAnalyticsFilter({ search: reason })}
            />
          </Card>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Card className="border-slate-800 bg-[#101b2b]">
            <TopHorizontalChart
              title="Produtos com mais sobras"
              subtitle={periodSubtitle}
              data={charts.data?.topSurplusProducts || []}
              metric="quantity"
              color="#34d399"
              onBarClick={(name) => applyAnalyticsFilter({ product: name, returnType: 'sobra' })}
            />
          </Card>

          <Card className="border-slate-800 bg-[#101b2b]">
            <TopHorizontalChart
              title="Produtos com mais faltas (talão)"
              subtitle={periodSubtitle}
              data={charts.data?.topShortageProducts || []}
              metric="quantity"
              color="#f87171"
              onBarClick={(name) => applyAnalyticsFilter({ product: name })}
            />
          </Card>
        </div>

        {collectionCancellationDialog ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-3">
            <button
              type="button"
              aria-label="Fechar confirmação de cancelamento"
              className="absolute inset-0 bg-slate-950/75"
              onClick={closeCollectionCancellationDialog}
            />
            <div className="relative z-[81] w-full max-w-[580px] rounded-lg border border-slate-700 bg-[#101b2b] p-4 text-slate-100 shadow-2xl">
              <h3 className="text-base font-semibold">
                {collectionCancellationDialog.mode === 'direct_cancel'
                  ? 'Confirmar cancelamento da coleta'
                  : 'Solicitar cancelamento da coleta'}
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                {`Coleta #${collectionCancellationDialog.request.id} | NF ${collectionCancellationDialog.request.invoice_number || '-'}`}
              </p>
              <p className="mt-0.5 text-sm text-slate-300">
                {`Cliente: ${collectionCancellationDialog.request.customer_name || '-'} | Cidade: ${collectionCancellationDialog.request.city || '-'}`}
              </p>

              {collectionCancellationDialog.mode === 'request_cancellation' ? (
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-amber-200">
                  Motivo da solicitação (obrigatório)
                  <textarea
                    value={collectionCancellationReason}
                    onChange={(event) => setCollectionCancellationReason(event.target.value)}
                    placeholder="Ex.: Cliente solicitou reagendamento para outra transportadora."
                    className="mt-1 min-h-[92px] w-full rounded-md border border-amber-500/45 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    disabled={Boolean(cancellingCollectionInvoice)}
                  />
                </label>
              ) : (
                <p className="mt-3 rounded-md border border-rose-500/45 bg-rose-900/20 px-3 py-2 text-xs font-semibold text-rose-100">
                  Esta ação cancela a coleta e estorna a contagem de saldo da NF.
                </p>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  tone="secondary"
                  className="h-9 bg-slate-800 text-slate-100"
                  onClick={closeCollectionCancellationDialog}
                  disabled={Boolean(cancellingCollectionInvoice)}
                >
                  Fechar
                </Button>
                <Button
                  tone="primary"
                  className={`${collectionCancellationDialog.mode === 'direct_cancel'
                    ? 'h-9 bg-rose-700/90 text-rose-50 hover:bg-rose-600'
                    : 'h-9 bg-amber-700/90 text-amber-50 hover:bg-amber-600'
                    } disabled:opacity-60`}
                  onClick={confirmCollectionCancellationDialog}
                  disabled={Boolean(cancellingCollectionInvoice)}
                >
                  {cancellingCollectionInvoice
                    ? (collectionCancellationDialog.mode === 'direct_cancel' ? 'Cancelando...' : 'Enviando...')
                    : (collectionCancellationDialog.mode === 'direct_cancel' ? 'Confirmar cancelamento' : 'Enviar solicitação')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {collectionOccurrenceDialog ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-3">
            <button
              type="button"
              aria-label="Fechar detalhes de ocorrência da coleta"
              className="absolute inset-0 bg-slate-950/75"
              onClick={() => setCollectionOccurrenceDialog(null)}
            />
            <div className="relative z-[81] w-full max-w-[640px] rounded-lg border border-slate-700 bg-[#101b2b] p-4 text-slate-100 shadow-2xl">
              <h3 className="text-base font-semibold">Detalhes da ocorrência da coleta</h3>
              <p className="mt-2 text-sm text-slate-300">
                {`Coleta #${collectionOccurrenceDialog.id} | NF ${collectionOccurrenceDialog.invoice_number || '-'}`}
              </p>
              <p className="mt-0.5 text-sm text-slate-300">
                {`Cliente: ${collectionOccurrenceDialog.customer_name || '-'} | Cidade: ${collectionOccurrenceDialog.city || '-'}`}
              </p>
              <p className="mt-0.5 text-sm text-slate-300">
                {`Status da coleta: ${formatCollectionWorkflowStatus(collectionOccurrenceDialog)}`}
                {` | Qualidade: ${formatCollectionQualityStatus(collectionOccurrenceDialog)}`}
              </p>

              {collectionOccurrenceHasNotes ? (
                <div className="mt-3 rounded-md border border-amber-500/45 bg-amber-900/20 px-3 py-2 text-xs text-amber-100">
                  <p className="font-semibold">
                    {collectionOccurrenceNotes.length === 1
                      ? '1 observação registrada'
                      : `${collectionOccurrenceNotes.length} observações registradas`}
                  </p>
                  <p className="mt-1 text-amber-200/90">
                    {collectionOccurrenceLatestNote
                      ? `Última: ${collectionOccurrenceLatestNote.timestampLabel ? `${collectionOccurrenceLatestNote.timestampLabel} | ` : ''}${collectionOccurrenceLatestNote.actor ? `${collectionOccurrenceLatestNote.actor}: ` : ''}${collectionOccurrenceLatestNote.message || collectionOccurrenceLatestNote.rawLine}`
                      : 'Última: -'}
                  </p>
                  <ul className="mt-2 max-h-[220px] space-y-1.5 overflow-auto rounded border border-amber-400/35 bg-slate-950/60 p-2">
                    {collectionOccurrenceNotes.map((note, index) => (
                      <li key={`collection-note-${collectionOccurrenceDialog.id}-${index}`} className="rounded border border-amber-500/20 bg-slate-900/55 px-2 py-1">
                        <p className="text-[10px] font-semibold text-amber-200/95">
                          {note.timestampLabel ? `${note.timestampLabel} | ` : ''}
                          {note.actor || 'usuario'}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-amber-100/95">
                          {note.message || note.rawLine}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 rounded-md border border-slate-600 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                  Sem observações registradas para esta coleta até o momento.
                </p>
              )}

              <div className="mt-4 flex justify-end">
                <Button
                  tone="secondary"
                  className="h-9 bg-slate-800 text-slate-100"
                  onClick={() => setCollectionOccurrenceDialog(null)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {receiptConfirmBatchCode ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-3">
            <button
              type="button"
              aria-label="Fechar confirmação de recebimento"
              className="absolute inset-0 bg-slate-950/75"
              onClick={closeReceiptConfirmModal}
            />
            <div className="relative z-[81] w-full max-w-[560px] rounded-lg border border-slate-700 bg-[#101b2b] p-4 text-slate-100 shadow-2xl">
              <h3 className="text-base font-semibold">Confirmar recebimento do lote</h3>
              <p className="mt-2 text-sm text-slate-300">
                {`Confirma o recebimento do lote ${receiptConfirmBatchCode}?`}
              </p>
              <p className="mt-2 rounded-md border border-amber-500/45 bg-amber-900/20 px-3 py-2 text-xs font-medium text-amber-200">
                Se houver divergência em alguma NF, registre a ocorrência antes de confirmar.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  tone="secondary"
                  className="h-9 bg-slate-800 text-slate-100"
                  onClick={closeReceiptConfirmModal}
                  disabled={Boolean(receivingBatchCode)}
                >
                  Cancelar
                </Button>
                <Button
                  tone="primary"
                  className="h-9 bg-emerald-700/90 text-emerald-50 hover:bg-emerald-600 disabled:opacity-60"
                  onClick={confirmBatchReceiptWithModal}
                  disabled={Boolean(receivingBatchCode)}
                >
                  {receivingBatchCode === receiptConfirmBatchCode ? 'Confirmando...' : 'Confirmar recebimento'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {selectedRow ? (
          <DetailsDrawer
            row={selectedRow}
            onClose={() => setSelectedId(null)}
            onAddObservation={(id, note) => addObservationMutation.mutate({ returnId: id, note })}
            onRegisterOccurrence={handleRegisterOccurrenceFromDrawer}
            registeringOccurrence={registerOccurrenceMutation.isPending}
          />
        ) : null}
      </div>
    </div>
  );
}

export default ControlTowerCollections;
