import { useEffect, useMemo, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { CalendarDays, CheckCircle2, History, Info, MessageSquare, Pencil, Printer, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import axios from 'axios';

import Header from '../components/Header';
import CollectionRequestPDF from '../components/CollectionRequestPDF';
import IconButton from '../components/ui/IconButton';
import SearchInput from '../components/ui/SearchInput';
import SlideToConfirm from '../components/ui/SlideToConfirm';
import { API_URL } from '../data';
import { HomeContent, HomeStyle } from '../style/Home';
import {
  Actions,
  Card,
  CardHeaderRow,
  Grid,
  InfoText,
  InlineText,
  List,
  ModalCard,
  ModalOverlay,
  OccurrenceActionsLeft,
  OccurrenceActionsRight,
  OccurrenceActionsRow,
  OccurrenceCardFooter,
  OccurrenceItemContent,
} from '../style/returnsOccurrences';
import { ICollectionRequest, IDanfe, IOccurrence } from '../types/types';
import verifyToken from '../utils/verifyToken';
import { formatDateBR } from '../utils/dateDisplay';

const OCCURRENCE_REASONS = [
  { value: 'faltou_no_carregamento', label: 'Faltou no carregamento' },
  { value: 'faltou_na_carga', label: 'Faltou na carga' },
  { value: 'produto_avariado', label: 'Produto avariado' },
  { value: 'produto_invertido', label: 'Produto invertido' },
  { value: 'produto_sem_etiqueta_ou_data', label: 'Produto sem etiqueta de identificacao ou data' },
] as const;

const OCCURRENCE_TOTAL_OPTION = '__INVOICE_TOTAL__';
const DEFAULT_OCCURRENCE_UNIT_TYPES = ['UN', 'CX', 'FD', 'KG', 'PCT'];
const KG_QUANTITY_MIN = 0.01;
const KG_QUANTITY_PRECISION = 1000;
const QUANTITY_EPSILON = 1e-6;

const RESOLUTION_LABELS: Record<string, string> = {
  enviado_posteriormente: 'Enviado posteriormente',
  talao_mercadoria_faltante: 'Talao de mercadoria faltante',
  motivo_corrigido: 'Motivo corrigido',
  motorista_pagou_cliente: 'Motorista pagou cliente',
  troca_realizada: 'Troca realizada',
  cliente_aceitou_invertido: 'Cliente aceitou produto invertido',
  legacy_outros: 'Legado / outros',
};

const RESOLUTION_OPTIONS_BY_REASON: Record<string, Array<{ value: string; label: string }>> = {
  faltou_no_carregamento: [
    { value: 'enviado_posteriormente', label: RESOLUTION_LABELS.enviado_posteriormente },
    { value: 'talao_mercadoria_faltante', label: RESOLUTION_LABELS.talao_mercadoria_faltante },
  ],
  faltou_na_carga: [
    { value: 'talao_mercadoria_faltante', label: RESOLUTION_LABELS.talao_mercadoria_faltante },
    { value: 'motivo_corrigido', label: RESOLUTION_LABELS.motivo_corrigido },
  ],
  produto_avariado: [
    { value: 'talao_mercadoria_faltante', label: RESOLUTION_LABELS.talao_mercadoria_faltante },
    { value: 'motorista_pagou_cliente', label: RESOLUTION_LABELS.motorista_pagou_cliente },
  ],
  produto_invertido: [
    { value: 'troca_realizada', label: RESOLUTION_LABELS.troca_realizada },
    { value: 'cliente_aceitou_invertido', label: RESOLUTION_LABELS.cliente_aceitou_invertido },
    { value: 'talao_mercadoria_faltante', label: RESOLUTION_LABELS.talao_mercadoria_faltante },
  ],
  produto_sem_etiqueta_ou_data: [
    { value: 'talao_mercadoria_faltante', label: RESOLUTION_LABELS.talao_mercadoria_faltante },
  ],
  legacy_outros: [
    { value: 'legacy_outros', label: RESOLUTION_LABELS.legacy_outros },
  ],
};

const OCCURRENCE_REASON_LABELS: Record<string, string> = OCCURRENCE_REASONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<string, string>);
OCCURRENCE_REASON_LABELS.legacy_outros = 'Legado / outros';
const SIMPLE_OCCURRENCE_REASON = 'faltou_na_carga';
const isSimpleOccurrenceReason = (reason?: string | null) => String(reason || '').trim().toLowerCase() === SIMPLE_OCCURRENCE_REASON;

type OccurrenceReasonValue = (typeof OCCURRENCE_REASONS)[number]['value'] | 'legacy_outros';
type OccurrenceDraftItem = {
  product_id: string;
  product_description: string;
  product_type: string | null;
  quantity: number;
};
type OccurrenceCardItemSummary = {
  label: string;
  quantityWithType: string;
};

const normalizeProductType = (value?: string | null) => String(value || '').trim().toUpperCase();
const normalizeDecimalInput = (value: string) => value.trim().replace(',', '.');
const normalizeQtyByType = (value: number, isKg: boolean) => (
  isKg ? Math.round(value * KG_QUANTITY_PRECISION) / KG_QUANTITY_PRECISION : value
);
const formatOccurrenceQtyWithType = (quantity: number, productType?: string | null) => {
  const normalizedType = normalizeProductType(productType);
  return `${Number(quantity || 0)}${normalizedType || ''}`;
};
const formatCollectionQuantityWithType = (quantity?: number | null, productType?: string | null) => {
  const normalizedType = normalizeProductType(productType);
  const parsed = Number(quantity || 0);
  const normalizedQty = Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(3).replace(/\.?0+$/, '');
  return `${normalizedQty}${normalizedType || ''}`;
};
const formatUrgencyLabel = (level?: string | null) => {
  const normalized = String(level || '').trim().toLowerCase();
  if (normalized === 'critica') return 'Crítica';
  if (normalized === 'alta') return 'Alta';
  if (normalized === 'baixa') return 'Baixa';
  return 'Média';
};
const resolveCollectionUrgencyTier = (level?: string | null) => {
  const normalized = String(level || '').trim().toLowerCase();
  if (normalized === 'alta' || normalized === 'critica') return 'prioritaria';
  return 'media';
};
const getCollectionUrgencyBadgeLabel = (level?: string | null) => (
  resolveCollectionUrgencyTier(level) === 'prioritaria' ? 'Prioritaria' : 'Media'
);
const getCollectionUrgencyBadgeClass = (level?: string | null) => (
  resolveCollectionUrgencyTier(level) === 'prioritaria'
    ? 'rounded-full border border-rose-300/35 bg-rose-300/15 px-2 py-0.5 text-[11px] font-semibold text-rose-100'
    : 'rounded-full border border-emerald-300/35 bg-emerald-300/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100'
);
const COLLECTION_STATUS_LABELS: Record<string, string> = {
  solicitada: 'Coleta solicitada',
  aceita_agendada: 'Coleta agendada',
  coletada: 'Coletada',
  cancelamento_solicitado: 'Cancelamento solicitado',
  enviada_em_lote: 'Enviada em lote',
  recebida: 'Recebida',
  cancelada: 'Cancelada',
};
const TRANSPORTADORA_COLLECTION_PERMISSIONS = ['admin', 'master', 'user', 'expedicao', 'conferente'];

type AuditHistoryEntry = {
  id: number;
  action: string;
  actor_user_id: number | null;
  actor_username: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};
type CollectionItemHistoryEntry = NonNullable<ICollectionRequest['collection_item_history']>[number];

const resolveCollectionStatus = (request: ICollectionRequest) => (
  String(request.workflow_status || request.display_status || request.status || '').trim().toLowerCase()
);
const resolveCollectionItemHistoryEventDate = (historyItem?: CollectionItemHistoryEntry) => (
  historyItem?.received_at
  || historyItem?.sent_in_batch_at
  || historyItem?.collected_at
  || historyItem?.created_at
  || ''
);

const getCollectionStatusLabel = (request: ICollectionRequest) => {
  const status = resolveCollectionStatus(request);
  return COLLECTION_STATUS_LABELS[status] || status || 'Status nao informado';
};

const XML_ENTITY_REGEX = /&(#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g;
const XML_ENTITY_FALLBACK_MAP: Record<string, string> = {
  amp: '&',
  apos: '\'',
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: ' ',
};
const CITY_LABEL_FIXES: Record<string, string> = {
  'santa barbara d\'oeste': 'Santa Bárbara d\'Oeste',
};
const buildCityFixKey = (value: string) => value.toLowerCase().replace(/[’`´]/g, '\'');
let xmlEntityDecoder: HTMLTextAreaElement | null = null;
const decodeXmlEntitiesOnce = (input: string) => {
  if (typeof document !== 'undefined') {
    if (!xmlEntityDecoder) {
      xmlEntityDecoder = document.createElement('textarea');
    }
    xmlEntityDecoder.innerHTML = input;
    return xmlEntityDecoder.value;
  }

  return input.replace(XML_ENTITY_REGEX, (fullMatch, entityRaw) => {
    const entity = String(entityRaw || '').trim();
    if (!entity) return fullMatch;

    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCharCode(codePoint) : fullMatch;
    }

    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCharCode(codePoint) : fullMatch;
    }

    const fallback = XML_ENTITY_FALLBACK_MAP[entity.toLowerCase()];
    return fallback ?? fullMatch;
  });
};
const decodeXmlEntitiesDeep = (value: string) => {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    const decoded = decodeXmlEntitiesOnce(current);
    if (decoded === current) break;
    current = decoded;
  }
  return current;
};
const normalizeTextValue = (value: unknown) => decodeXmlEntitiesDeep(String(value || '').trim());
const toNullableNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const normalizeCityLabel = (value: unknown) => {
  const normalized = normalizeTextValue(value);
  if (!normalized) return '';
  return CITY_LABEL_FIXES[buildCityFixKey(normalized)] || normalized;
};
const sanitizeOccurrenceRecord = (occurrence: IOccurrence): IOccurrence => ({
  ...occurrence,
  customer_name: normalizeTextValue(occurrence.customer_name) || null,
  city: normalizeCityLabel(occurrence.city) || null,
  product_description: normalizeTextValue(occurrence.product_description) || null,
  resolution_note: normalizeTextValue(occurrence.resolution_note) || null,
  items: Array.isArray(occurrence.items)
    ? occurrence.items.map((item) => ({
      ...item,
      product_description: normalizeTextValue(item.product_description) || null,
    }))
    : occurrence.items,
});
const sanitizeCollectionRequestRecord = (request: ICollectionRequest): ICollectionRequest => ({
  ...request,
  invoice_number: normalizeTextValue(request.invoice_number) || null,
  customer_name: normalizeTextValue(request.customer_name),
  city: normalizeCityLabel(request.city),
  product_id: normalizeTextValue(request.product_id) || null,
  product_description: normalizeTextValue(request.product_description),
  requested_by_company: normalizeTextValue(request.requested_by_company),
  notes: normalizeTextValue(request.notes) || null,
  quantity_original: toNullableNumber(request.quantity_original),
  total_collected: toNullableNumber(request.total_collected),
  remaining_collectable: toNullableNumber(request.remaining_collectable),
  collection_item_history: Array.isArray(request.collection_item_history)
    ? request.collection_item_history.map((entry) => ({
      ...entry,
      request_code: normalizeTextValue(entry.request_code) || null,
      quantity: Number(entry.quantity || 0),
    }))
    : [],
});
const sanitizeDanfeForDisplay = (danfe: IDanfe): IDanfe => ({
  ...danfe,
  Customer: {
    ...danfe.Customer,
    name_or_legal_entity: normalizeTextValue(danfe.Customer?.name_or_legal_entity),
    city: normalizeCityLabel(danfe.Customer?.city),
    address: normalizeTextValue(danfe.Customer?.address) || null,
    address_number: normalizeTextValue(danfe.Customer?.address_number) || null,
    neighborhood: normalizeTextValue(danfe.Customer?.neighborhood) || null,
    state: normalizeTextValue(danfe.Customer?.state) || null,
    zip_code: normalizeTextValue(danfe.Customer?.zip_code) || null,
  },
  DanfeProducts: Array.isArray(danfe.DanfeProducts)
    ? danfe.DanfeProducts.map((product) => ({
      ...product,
      type: normalizeTextValue(product.type),
      Product: {
        ...product.Product,
        description: normalizeTextValue(product.Product?.description),
      },
    }))
    : danfe.DanfeProducts,
});

const buildCustomerAddress = (customer?: Partial<IDanfe['Customer']> | null) => {
  const street = normalizeTextValue(customer?.address);
  const number = normalizeTextValue(customer?.address_number);
  const neighborhood = normalizeTextValue(customer?.neighborhood);
  const state = normalizeTextValue(customer?.state);
  const zipCode = normalizeTextValue(customer?.zip_code);

  const firstBlock = [street, number && `N ${number}`, neighborhood && `Bairro ${neighborhood}`]
    .filter(Boolean)
    .join(', ');
  const secondBlock = [state, zipCode && `CEP ${zipCode}`].filter(Boolean).join(' | ');

  return [firstBlock, secondBlock].filter(Boolean).join(' | ') || 'Endereco nao informado';
};

const summarizeHistoryMetadata = (entry: AuditHistoryEntry) => {
  const metadata = entry.metadata && typeof entry.metadata === 'object'
    ? entry.metadata as Record<string, unknown>
    : null;
  if (!metadata) return '';

  const details: string[] = [];
  const note = normalizeTextValue(metadata.note);
  const justification = normalizeTextValue(metadata.justification);
  const scheduledFor = normalizeTextValue(metadata.scheduled_for);
  const previousScheduledFor = normalizeTextValue(metadata.previous_scheduled_for);
  const workflowStatus = normalizeTextValue(metadata.workflow_status);
  const previousWorkflowStatus = normalizeTextValue(metadata.previous_workflow_status);
  const batchCode = normalizeTextValue(metadata.batch_code);

  if (note) details.push(`Obs: ${note}`);
  if (justification) details.push(`Justificativa: ${justification}`);
  if (previousScheduledFor) details.push(`Data anterior: ${formatDateBR(previousScheduledFor)}`);
  if (scheduledFor) details.push(`Data prevista: ${formatDateBR(scheduledFor)}`);
  if (previousWorkflowStatus) details.push(`Status anterior: ${previousWorkflowStatus}`);
  if (workflowStatus) details.push(`Status novo: ${workflowStatus}`);
  if (batchCode) details.push(`Lote: ${batchCode}`);

  return details.join(' | ');
};

const isPendingPickupRequest = (request: ICollectionRequest) => (
  ['solicitada', 'pending', 'aceita_agendada', 'coletada', 'cancelamento_solicitado'].includes(
    resolveCollectionStatus(request),
  )
);
const isScheduledCollectionRequest = (request: ICollectionRequest) => resolveCollectionStatus(request) === 'aceita_agendada';

function Home() {
  const navigate = useNavigate();

  const [pendingOccurrences, setPendingOccurrences] = useState<IOccurrence[]>([]);
  const [pendingCollectionRequests, setPendingCollectionRequests] = useState<ICollectionRequest[]>([]);
  const [userPermission, setUserPermission] = useState('');

  const [resolvingOccurrence, setResolvingOccurrence] = useState<IOccurrence | null>(null);
  const [resolutionType, setResolutionType] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  const [isOccurrenceEditOpen, setIsOccurrenceEditOpen] = useState(false);
  const [editingOccurrenceId, setEditingOccurrenceId] = useState<number | null>(null);
  const [occurrenceNf, setOccurrenceNf] = useState('');
  const [occurrenceDanfe, setOccurrenceDanfe] = useState<IDanfe | null>(null);
  const [occurrenceReason, setOccurrenceReason] = useState<OccurrenceReasonValue>('faltou_no_carregamento');
  const [occurrenceProductCode, setOccurrenceProductCode] = useState(OCCURRENCE_TOTAL_OPTION);
  const [occurrenceProductType, setOccurrenceProductType] = useState('');
  const [occurrenceQuantityInput, setOccurrenceQuantityInput] = useState('1');
  const [occurrenceItems, setOccurrenceItems] = useState<OccurrenceDraftItem[]>([]);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyModalTitle, setHistoryModalTitle] = useState('');
  const [historyEntries, setHistoryEntries] = useState<AuditHistoryEntry[]>([]);

  const [collectionScheduleModalOpen, setCollectionScheduleModalOpen] = useState(false);
  const [collectionScheduleRequest, setCollectionScheduleRequest] = useState<ICollectionRequest | null>(null);
  const [collectionScheduleDate, setCollectionScheduleDate] = useState('');
  const [collectionScheduleReason, setCollectionScheduleReason] = useState('');
  const [collectionScheduleSaving, setCollectionScheduleSaving] = useState(false);

  const [collectionNoteModalOpen, setCollectionNoteModalOpen] = useState(false);
  const [collectionNoteRequest, setCollectionNoteRequest] = useState<ICollectionRequest | null>(null);
  const [collectionNoteText, setCollectionNoteText] = useState('');
  const [collectionNoteSaving, setCollectionNoteSaving] = useState(false);
  const [collectionStatusUpdatingId, setCollectionStatusUpdatingId] = useState<number | null>(null);
  const [collectionDetailsRequest, setCollectionDetailsRequest] = useState<ICollectionRequest | null>(null);

  const [collectionPdfPrintingId, setCollectionPdfPrintingId] = useState<number | null>(null);

  const isAdminUser = userPermission === 'admin';
  const canManageOccurrenceStatus = userPermission !== 'control_tower';
  const canManageCollectionWorkflowStatus = TRANSPORTADORA_COLLECTION_PERMISSIONS.includes(userPermission);

  const occurrenceProducts = useMemo(() => occurrenceDanfe?.DanfeProducts || [], [occurrenceDanfe]);
  const selectedOccurrenceProduct = useMemo(() => (
    occurrenceProducts.find((item) => item.Product.code === occurrenceProductCode) || null
  ), [occurrenceProducts, occurrenceProductCode]);
  const occurrenceTypeOptions = useMemo(() => {
    const productType = normalizeProductType(selectedOccurrenceProduct?.type || selectedOccurrenceProduct?.Product.type);
    return Array.from(new Set([productType, ...DEFAULT_OCCURRENCE_UNIT_TYPES].filter(Boolean)));
  }, [selectedOccurrenceProduct]);
  const isOccurrenceTotal = occurrenceProductCode === OCCURRENCE_TOTAL_OPTION;
  const occurrenceScope = isOccurrenceTotal ? 'invoice_total' : 'items';
  const occurrenceProductIsKg = useMemo(() => {
    return normalizeProductType(occurrenceProductType).includes('KG');
  }, [occurrenceProductType]);
  const occurrenceQuantityMin = occurrenceProductIsKg ? KG_QUANTITY_MIN : 1;
  const occurrenceProductMaxQtyRaw = selectedOccurrenceProduct
    ? Number(normalizeDecimalInput(String(selectedOccurrenceProduct.quantity ?? '0')))
    : 0;
  const occurrenceProductMaxQty = Number.isFinite(occurrenceProductMaxQtyRaw) ? occurrenceProductMaxQtyRaw : 0;
  const occurrenceProductAlreadyAddedQty = occurrenceProductCode
    ? occurrenceItems
      .filter((item) => item.product_id === occurrenceProductCode)
      .reduce((sum, item) => sum + Number(item.quantity), 0)
    : 0;
  const occurrenceProductRemainingQty = Math.max(0, occurrenceProductMaxQty - occurrenceProductAlreadyAddedQty);
  const availableResolutionOptions = useMemo(() => {
    const key = resolvingOccurrence?.reason || 'legacy_outros';
    return RESOLUTION_OPTIONS_BY_REASON[key] || RESOLUTION_OPTIONS_BY_REASON.legacy_outros;
  }, [resolvingOccurrence]);
  const priorityLoadingOccurrences = useMemo(
    () => pendingOccurrences.filter((occurrence) => !isSimpleOccurrenceReason(occurrence.reason)),
    [pendingOccurrences],
  );
  const simpleFlowOccurrences = useMemo(
    () => pendingOccurrences.filter((occurrence) => isSimpleOccurrenceReason(occurrence.reason)),
    [pendingOccurrences],
  );
  const scheduledCollectionRequests = useMemo(
    () => pendingCollectionRequests.filter((request) => isScheduledCollectionRequest(request)),
    [pendingCollectionRequests],
  );
  const cancellationRequestedCollectionRequests = useMemo(
    () => pendingCollectionRequests.filter((request) => resolveCollectionStatus(request) === 'cancelamento_solicitado'),
    [pendingCollectionRequests],
  );
  const collectedCollectionRequests = useMemo(
    () => pendingCollectionRequests.filter((request) => resolveCollectionStatus(request) === 'coletada'),
    [pendingCollectionRequests],
  );
  const unscheduledCollectionRequests = useMemo(
    () => pendingCollectionRequests.filter((request) => {
      const status = resolveCollectionStatus(request);
      return ['solicitada', 'pending'].includes(status);
    }),
    [pendingCollectionRequests],
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedPermission = localStorage.getItem('user_permission') || '';
    setUserPermission(storedPermission);

    const fetchToken = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      const isValidToken = await verifyToken(token);
      if (!isValidToken) {
        delete axios.defaults.headers.common.Authorization;
        navigate('/');
        return;
      }

      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      await loadHomePendencies();
    };

    fetchToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!occurrenceProductCode || !selectedOccurrenceProduct || isOccurrenceTotal) {
      setOccurrenceProductType('');
      setOccurrenceQuantityInput('1');
      return;
    }

    const defaultType = normalizeProductType(selectedOccurrenceProduct.type || selectedOccurrenceProduct.Product.type)
      || DEFAULT_OCCURRENCE_UNIT_TYPES[0];
    setOccurrenceProductType((current) => normalizeProductType(current) || defaultType);
    setOccurrenceQuantityInput(defaultType.includes('KG') ? String(KG_QUANTITY_MIN) : '1');
  }, [occurrenceProductCode, selectedOccurrenceProduct, isOccurrenceTotal]);

  useEffect(() => {
    if (isOccurrenceTotal) {
      setOccurrenceProductType('');
      if (occurrenceItems.length) {
        setOccurrenceItems([]);
      }
    }
  }, [isOccurrenceTotal, occurrenceItems.length]);

  async function loadPendingOccurrences() {
    try {
      const { data } = await axios.get(`${API_URL}/occurrences/pending`);
      const safeData = Array.isArray(data)
        ? data.map((occurrence: IOccurrence) => sanitizeOccurrenceRecord(occurrence))
        : [];

      const missingContextOccurrences = safeData.filter((occurrence: IOccurrence) => {
        const invoice = String(occurrence.invoice_number || '').trim();
        const needsContext = !occurrence.customer_name || !occurrence.city || (!occurrence.product_description && !!occurrence.product_id);
        return needsContext && /^\d+$/.test(invoice);
      });

      if (!missingContextOccurrences.length) {
        setPendingOccurrences(safeData);
        return;
      }

      const fallbackResults = await Promise.all(
        missingContextOccurrences.map(async (occurrence: IOccurrence) => {
          try {
            const { data: danfe } = await axios.get(`${API_URL}/danfes/nf/${occurrence.invoice_number}`);
            const matchedDanfeProduct = danfe?.DanfeProducts?.find(
              (item: any) => String(item?.Product?.code || '').trim() === String(occurrence.product_id || '').trim(),
            );
            const fallbackProductDescription = occurrence.product_description
              || matchedDanfeProduct?.Product?.description
              || null;
            const fallbackProductType = normalizeProductType(
              occurrence.product_type
              || matchedDanfeProduct?.type
              || matchedDanfeProduct?.Product?.type,
            ) || null;

            return {
              id: occurrence.id,
              customer_name: normalizeTextValue(danfe?.Customer?.name_or_legal_entity || occurrence.customer_name) || null,
              city: normalizeCityLabel(danfe?.Customer?.city || occurrence.city) || null,
              product_description: normalizeTextValue(fallbackProductDescription) || null,
              product_type: fallbackProductType,
            };
          } catch {
            return null;
          }
        }),
      );

      const fallbackByOccurrenceId = new Map(
        fallbackResults
          .filter((item): item is NonNullable<typeof item> => !!item)
          .map((item) => [item.id, item]),
      );

      const merged = safeData.map((occurrence: IOccurrence) => {
        const fallback = fallbackByOccurrenceId.get(occurrence.id);
        if (!fallback) return sanitizeOccurrenceRecord(occurrence);
        return {
          ...sanitizeOccurrenceRecord(occurrence),
          customer_name: fallback.customer_name ?? occurrence.customer_name ?? null,
          city: fallback.city ?? occurrence.city ?? null,
          product_description: fallback.product_description ?? occurrence.product_description ?? null,
          product_type: fallback.product_type ?? occurrence.product_type ?? null,
        };
      });

      setPendingOccurrences(merged.map((occurrence) => sanitizeOccurrenceRecord(occurrence)));
    } catch (error) {
      console.error('Erro ao carregar ocorrencias pendentes:', error);
    }
  }

  async function loadPendingCollectionRequests() {
    try {
      const [dashboardResponse, searchResponse] = await Promise.all([
        axios.get(`${API_URL}/collection-requests/dashboard`),
        axios.get(`${API_URL}/collection-requests/search`, {
          params: {
            workflow_status: 'all',
            limit: 180,
          },
        }),
      ]);

      const dashboardPending = Array.isArray(dashboardResponse?.data?.pending) ? dashboardResponse.data.pending : [];
      const searchRows = Array.isArray(searchResponse?.data) ? searchResponse.data : [];
      const mergedById = new Map<number, ICollectionRequest>();

      [...dashboardPending, ...searchRows].forEach((request: ICollectionRequest) => {
        if (!request?.id) return;
        if (isPendingPickupRequest(request)) {
          mergedById.set(request.id, request);
        }
      });

      const actionableRows = Array.from(mergedById.values())
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .map((request) => sanitizeCollectionRequestRecord(request));

      setPendingCollectionRequests(actionableRows);
    } catch (error) {
      console.error('Erro ao carregar coletas pendentes:', error);
      setPendingCollectionRequests([]);
    }
  }

  async function loadHomePendencies() {
    await Promise.all([
      loadPendingOccurrences(),
      loadPendingCollectionRequests(),
    ]);
  }

  async function findDanfeByNf(nf: string) {
    const { data } = await axios.get(`${API_URL}/danfes/nf/${nf}`);
    return data;
  }

  function getItemsSummary(occurrence: IOccurrence): OccurrenceCardItemSummary[] {
    if (occurrence.items?.length) {
      return occurrence.items
        .map((item) => {
          const id = String(item.product_id || '').trim();
          const description = String(item.product_description || '').trim();
          const quantity = Number(item.quantity || 0);
          const base = (() => {
            if (id && description) return `${id} - ${description}`;
            return id || description || '';
          })();
          return {
            label: base || 'Item',
            quantityWithType: formatOccurrenceQtyWithType(quantity, item.product_type || occurrence.product_type),
          };
        })
        .filter((item) => Boolean(item.label));
    }

    const productId = String(occurrence.product_id || '').trim();
    const productDescription = String(occurrence.product_description || '').trim();
    const quantity = Number(occurrence.quantity || 0);
    if (productId && productDescription) {
      return [{
        label: `${productId} - ${productDescription}`,
        quantityWithType: formatOccurrenceQtyWithType(quantity, occurrence.product_type),
      }];
    }
    if (productId) {
      return [{
        label: productId,
        quantityWithType: formatOccurrenceQtyWithType(quantity, occurrence.product_type),
      }];
    }
    if (productDescription) {
      return [{
        label: productDescription,
        quantityWithType: formatOccurrenceQtyWithType(quantity, occurrence.product_type),
      }];
    }
    return [];
  }

  function renderOccurrenceActions(occurrence: IOccurrence) {
    return (
      <OccurrenceCardFooter>
        <OccurrenceActionsRow className="max-[420px]:gap-1">
          <OccurrenceActionsLeft className="max-[420px]:shrink">
            {occurrence.status === 'pending' && canManageOccurrenceStatus && (
              <>
                <button
                  className="primary hidden md:inline-flex md:items-center md:gap-1.5 md:px-3"
                  onClick={() => openResolveModal(occurrence)}
                  type="button"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Marcar como resolvida
                </button>
                <SlideToConfirm
                  label="Arraste para finalizar"
                  confirmedLabel="Resolvida"
                  threshold={0.5}
                  onConfirm={() => openResolveModal(occurrence)}
                  disabled={occurrence.status !== 'pending' || !canManageOccurrenceStatus}
                  hideText
                  persistConfirmed={false}
                  className="w-[124px] shrink-0 max-[420px]:w-[104px] md:hidden"
                />
              </>
            )}
          </OccurrenceActionsLeft>

          <OccurrenceActionsRight className="max-[420px]:gap-1">
            {occurrence.status === 'pending' && canManageOccurrenceStatus && (
              <IconButton
                icon={Pencil}
                label="Editar ocorrencia"
                onClick={() => startEditOccurrence(occurrence)}
                className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0 max-[420px]:!h-8 max-[420px]:!w-8 max-[420px]:!min-h-8 max-[420px]:!min-w-8"
              />
            )}
            {isAdminUser && (
              <IconButton
                icon={History}
                label="Histórico da ocorrência"
                onClick={() => handleViewOccurrenceHistory(occurrence.id)}
                className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0 max-[420px]:!h-8 max-[420px]:!w-8 max-[420px]:!min-h-8 max-[420px]:!min-w-8"
              />
            )}
            {canManageOccurrenceStatus && (
              <IconButton
                icon={Trash2}
                label="Excluir ocorrencia"
                variant="danger"
                onClick={() => handleDeleteOccurrence(occurrence.id)}
                className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0 max-[420px]:!h-8 max-[420px]:!w-8 max-[420px]:!min-h-8 max-[420px]:!min-w-8"
              />
            )}
          </OccurrenceActionsRight>
        </OccurrenceActionsRow>
      </OccurrenceCardFooter>
    );
  }

  function resetOccurrenceEditor() {
    setEditingOccurrenceId(null);
    setOccurrenceNf('');
    setOccurrenceDanfe(null);
    setOccurrenceReason('faltou_no_carregamento');
    setOccurrenceProductCode(OCCURRENCE_TOTAL_OPTION);
    setOccurrenceProductType('');
    setOccurrenceQuantityInput('1');
    setOccurrenceItems([]);
  }

  function closeOccurrenceEditModal() {
    setIsOccurrenceEditOpen(false);
    resetOccurrenceEditor();
  }

  async function handleSearchOccurrenceNf() {
    if (!occurrenceNf.trim()) {
      alert('Digite a NF para buscar.');
      return;
    }

    try {
      const data = await findDanfeByNf(occurrenceNf.trim());

      if (!data) {
        alert('NF nao encontrada.');
        return;
      }

      setOccurrenceDanfe(sanitizeDanfeForDisplay(data));
      setOccurrenceProductCode(OCCURRENCE_TOTAL_OPTION);
      setOccurrenceProductType('');
      setOccurrenceQuantityInput('1');
      setOccurrenceItems([]);
    } catch (error) {
      console.error(error);
      alert('Erro ao buscar NF para ocorrencia.');
    }
  }

  function addOccurrenceItem() {
    if (!occurrenceDanfe) {
      alert('Busque uma NF primeiro.');
      return;
    }

    if (!occurrenceProductCode) {
      alert('Selecione um produto.');
      return;
    }

    if (!selectedOccurrenceProduct) {
      alert('Produto selecionado nao encontrado na NF.');
      return;
    }

    const normalizedProductType = normalizeProductType(occurrenceProductType);
    if (!normalizedProductType) {
      alert('Selecione o tipo da quantidade.');
      return;
    }

    const rawQuantity = String(occurrenceQuantityInput || '').trim();
    if (!rawQuantity) {
      alert('Informe uma quantidade valida.');
      return;
    }

    const parsedQuantity = Number(normalizeDecimalInput(rawQuantity));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      alert('Informe uma quantidade valida.');
      return;
    }

    if (!occurrenceProductIsKg && !Number.isInteger(parsedQuantity)) {
      alert('Para este produto, utilize quantidade inteira.');
      return;
    }

    const normalizedQty = normalizeQtyByType(parsedQuantity, occurrenceProductIsKg);

    if (normalizedQty < occurrenceQuantityMin) {
      alert(`Quantidade minima permitida: ${occurrenceQuantityMin}.`);
      return;
    }

    if ((normalizedQty + occurrenceProductAlreadyAddedQty) - occurrenceProductMaxQty > QUANTITY_EPSILON) {
      alert(`Quantidade excede o limite da NF. Restante disponivel: ${occurrenceProductRemainingQty}.`);
      return;
    }

    setOccurrenceItems((previous) => {
      const existing = previous.find((item) => (
        item.product_id === occurrenceProductCode
        && normalizeProductType(item.product_type) === normalizedProductType
      ));
      if (!existing) {
        return [
          ...previous,
          {
            product_id: occurrenceProductCode,
            product_description: selectedOccurrenceProduct.Product.description,
            product_type: normalizedProductType,
            quantity: normalizedQty,
          },
        ];
      }

      return previous.map((item) => (
        item.product_id === occurrenceProductCode
          && normalizeProductType(item.product_type) === normalizedProductType
          ? { ...item, quantity: Number(item.quantity) + normalizedQty }
          : item
      ));
    });

    setOccurrenceQuantityInput(String(occurrenceQuantityMin));
  }

  function removeOccurrenceItem(productId: string, productType: string | null = null) {
    setOccurrenceItems((previous) => previous.filter((item) => (
      !(item.product_id === productId && normalizeProductType(item.product_type) === normalizeProductType(productType))
    )));
  }

  async function startEditOccurrence(occurrence: IOccurrence) {
    if (occurrence.status !== 'pending') return;

    setIsOccurrenceEditOpen(true);
    setEditingOccurrenceId(occurrence.id);
    setOccurrenceNf(String(occurrence.invoice_number || ''));
    setOccurrenceReason((occurrence.reason || 'legacy_outros') as OccurrenceReasonValue);

    const scopeFromOccurrence = (occurrence.scope || 'items') as 'invoice_total' | 'items';
    setOccurrenceItems(
      (occurrence.items || [])
        .map((item) => ({
          product_id: String(item.product_id || '').trim(),
          product_description: String(item.product_description || '').trim(),
          product_type: normalizeProductType(item.product_type) || null,
          quantity: Number(item.quantity || 0),
        }))
        .filter((item) => item.product_id && item.quantity > 0),
    );

    setOccurrenceProductCode(
      scopeFromOccurrence === 'invoice_total'
        ? OCCURRENCE_TOTAL_OPTION
        : String(occurrence.items?.[0]?.product_id || '').trim() || OCCURRENCE_TOTAL_OPTION,
    );
    setOccurrenceProductType(
      scopeFromOccurrence === 'invoice_total'
        ? ''
        : normalizeProductType(occurrence.items?.[0]?.product_type) || '',
    );

    setOccurrenceQuantityInput('1');

    try {
      const data = await findDanfeByNf(String(occurrence.invoice_number));
      if (data) {
        setOccurrenceDanfe(sanitizeDanfeForDisplay(data));
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function handleEditOccurrence() {
    if (!editingOccurrenceId) {
      alert('Ocorrencia invalida para edicao.');
      return;
    }

    if (!occurrenceDanfe) {
      alert('Busque uma NF para ocorrencia.');
      return;
    }

    if (!occurrenceReason) {
      alert('Selecione o motivo da ocorrencia.');
      return;
    }

    if (occurrenceScope === 'items' && !occurrenceItems.length) {
      alert('Selecione ao menos um item e quantidade para a ocorrencia.');
      return;
    }

    try {
      await axios.put(`${API_URL}/occurrences/${editingOccurrenceId}`, {
        invoice_number: String(occurrenceDanfe.invoice_number),
        reason: occurrenceReason,
        scope: occurrenceScope,
        items: occurrenceScope === 'items' ? occurrenceItems : [],
      });

      alert('Ocorrencia atualizada com sucesso.');
      closeOccurrenceEditModal();
      await loadPendingOccurrences();
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao salvar ocorrencia.');
      } else {
        alert('Erro ao salvar ocorrencia.');
      }
    }
  }

  function openResolveModal(occurrence: IOccurrence) {
    setResolvingOccurrence(occurrence);
    setResolutionType('');
    setResolutionNote('');
  }

  function closeResolveModal() {
    setResolvingOccurrence(null);
    setResolutionType('');
    setResolutionNote('');
  }

  async function handleResolveOccurrence() {
    if (!resolvingOccurrence) return;

    if (!resolutionType) {
      alert('Selecione como a ocorrencia foi resolvida.');
      return;
    }

    if (resolutionType === 'motivo_corrigido' && !resolutionNote.trim()) {
      alert('Motivo corrigido exige observacao.');
      return;
    }

    try {
      await axios.put(`${API_URL}/occurrences/status/${resolvingOccurrence.id}`, {
        status: 'resolved',
        resolution_type: resolutionType,
        resolution_note: resolutionNote.trim(),
      });

      closeResolveModal();
      await loadPendingOccurrences();
    } catch (error) {
      console.error('Erro ao resolver ocorrencia:', error);
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao atualizar status da ocorrencia.');
      } else {
        alert('Erro ao atualizar status da ocorrencia.');
      }
    }
  }

  async function handleDeleteOccurrence(id: number) {
    const confirmed = window.confirm('Deseja realmente excluir esta ocorrencia? O historico sera preservado.');
    if (!confirmed) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/occurrences/${id}`);
      await loadPendingOccurrences();
      alert('Ocorrencia excluida com sucesso.');
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir ocorrencia.');
    }
  }

  async function handleViewOccurrenceHistory(id: number) {
    if (!isAdminUser) {
      alert('Somente usuarios admin podem visualizar o historico.');
      return;
    }

    try {
      const { data } = await axios.get(`${API_URL}/occurrences/${id}/history`);
      setHistoryModalTitle(`Historico da ocorrencia #${id}`);
      setHistoryEntries(data);
      setHistoryModalOpen(true);
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar historico da ocorrencia.');
    }
  }

  function openCollectionScheduleModal(request: ICollectionRequest) {
    setCollectionScheduleRequest(request);
    setCollectionScheduleDate(normalizeTextValue(request.scheduled_for));
    setCollectionScheduleReason('');
    setCollectionScheduleModalOpen(true);
  }

  function closeCollectionScheduleModal() {
    setCollectionScheduleModalOpen(false);
    setCollectionScheduleRequest(null);
    setCollectionScheduleDate('');
    setCollectionScheduleReason('');
    setCollectionScheduleSaving(false);
  }

  async function handleSaveCollectionSchedule() {
    if (!collectionScheduleRequest) return;
    const nextDate = normalizeTextValue(collectionScheduleDate);
    if (!nextDate) {
      alert('Informe a data prevista da coleta.');
      return;
    }

    const currentStatus = resolveCollectionStatus(collectionScheduleRequest);
    const previousDate = normalizeTextValue(collectionScheduleRequest.scheduled_for);
    const dateChanged = previousDate !== nextDate;
    const reason = collectionScheduleReason.trim();

    if (currentStatus === 'aceita_agendada' && dateChanged && !reason) {
      alert('Informe uma justificativa para alterar a data de uma coleta ja agendada.');
      return;
    }

    setCollectionScheduleSaving(true);
    try {
      await axios.patch(`${API_URL}/collection-requests/${collectionScheduleRequest.id}/schedule`, {
        scheduled_for: nextDate,
        reason,
      });

      closeCollectionScheduleModal();
      await loadPendingCollectionRequests();
      alert('Data da coleta atualizada com sucesso.');
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao atualizar data da coleta.');
      } else {
        alert('Erro ao atualizar data da coleta.');
      }
      setCollectionScheduleSaving(false);
    }
  }

  function openCollectionNoteModal(request: ICollectionRequest) {
    setCollectionNoteRequest(request);
    setCollectionNoteText('');
    setCollectionNoteModalOpen(true);
  }

  function closeCollectionNoteModal() {
    setCollectionNoteModalOpen(false);
    setCollectionNoteRequest(null);
    setCollectionNoteText('');
    setCollectionNoteSaving(false);
  }

  async function updateCollectionWorkflowStatusToCollected(request: ICollectionRequest) {
    setCollectionStatusUpdatingId(request.id);
    try {
      await axios.patch(`${API_URL}/collection-requests/${request.id}/status`, {
        workflow_status: 'coletada',
      });
      await loadPendingCollectionRequests();
      alert('Coleta marcada como coletada.');
      return true;
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao atualizar status da coleta.');
      } else {
        alert('Erro ao atualizar status da coleta.');
      }
      return false;
    } finally {
      setCollectionStatusUpdatingId(null);
    }
  }

  async function handleMarkCollectionAsCollected(request: ICollectionRequest) {
    const confirmed = window.confirm(
      `Confirmar coleta da NF ${request.invoice_number || '-'}? Esta acao atualiza o status para coletada.`,
    );
    if (!confirmed) return;
    await updateCollectionWorkflowStatusToCollected(request);
  }

  async function handleApproveCollectionCancellation(request: ICollectionRequest) {
    const confirmed = window.confirm(
      `Aprovar cancelamento da coleta #${request.id} (NF ${request.invoice_number || '-'})?`,
    );
    if (!confirmed) return;

    setCollectionStatusUpdatingId(request.id);
    try {
      await axios.patch(`${API_URL}/collection-requests/${request.id}/status`, {
        workflow_status: 'cancelada',
        reason: 'Cancelamento aprovado pela transportadora.',
      });
      await loadPendingCollectionRequests();
      alert('Cancelamento aprovado e coleta encerrada.');
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao aprovar cancelamento da coleta.');
      } else {
        alert('Erro ao aprovar cancelamento da coleta.');
      }
    } finally {
      setCollectionStatusUpdatingId(null);
    }
  }

  async function handleRejectCollectionCancellation(request: ICollectionRequest) {
    const reason = window.prompt(
      `Motivo para manter a coleta #${request.id} (obrigatorio)`,
      '',
    );
    if (reason === null) return;
    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason) {
      alert('Informe a justificativa para manter a coleta agendada.');
      return;
    }

    setCollectionStatusUpdatingId(request.id);
    try {
      await axios.patch(`${API_URL}/collection-requests/${request.id}/status`, {
        workflow_status: 'aceita_agendada',
        reason: trimmedReason,
      });
      await loadPendingCollectionRequests();
      alert('Solicitação recusada. Coleta mantida como agendada.');
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao manter coleta agendada.');
      } else {
        alert('Erro ao manter coleta agendada.');
      }
    } finally {
      setCollectionStatusUpdatingId(null);
    }
  }

  function openCollectionDetailsModal(request: ICollectionRequest) {
    setCollectionDetailsRequest(request);
  }

  function closeCollectionDetailsModal() {
    setCollectionDetailsRequest(null);
  }

  async function handleSaveCollectionNote() {
    if (!collectionNoteRequest) return;
    const note = collectionNoteText.trim();
    if (!note) {
      alert('Digite a observacao da coleta.');
      return;
    }

    setCollectionNoteSaving(true);
    try {
      await axios.post(`${API_URL}/collection-requests/${collectionNoteRequest.id}/notes`, { note });
      closeCollectionNoteModal();
      await loadPendingCollectionRequests();
      alert('Observacao registrada com sucesso.');
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao registrar observacao da coleta.');
      } else {
        alert('Erro ao registrar observacao da coleta.');
      }
      setCollectionNoteSaving(false);
    }
  }

  async function handleViewCollectionHistory(request: ICollectionRequest) {
    try {
      const { data } = await axios.get(`${API_URL}/collection-requests/${request.id}/history`);
      setHistoryModalTitle(`Historico da coleta #${request.id} | NF ${request.invoice_number || '-'}`);
      setHistoryEntries(Array.isArray(data) ? data : []);
      setHistoryModalOpen(true);
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao carregar historico da coleta.');
      } else {
        alert('Erro ao carregar historico da coleta.');
      }
    }
  }

  async function handlePrintCollectionPdf(request: ICollectionRequest) {
    if (collectionPdfPrintingId === request.id) return;
    setCollectionPdfPrintingId(request.id);

    try {
      let addressLine = buildCustomerAddress(undefined);
      const invoiceNumber = normalizeTextValue(request.invoice_number);

      if (invoiceNumber) {
        const { data } = await axios.get<IDanfe | null>(`${API_URL}/danfes/nf/${invoiceNumber}`);
        if (data?.Customer) {
          addressLine = buildCustomerAddress(data.Customer);
        }
      }

      const pdfBlob = await pdf(
        <CollectionRequestPDF
          request={request}
          addressLine={addressLine}
        />,
      ).toBlob();

      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
    } catch (error) {
      console.error(error);
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao gerar PDF da coleta.');
      } else {
        alert('Erro ao gerar PDF da coleta.');
      }
    } finally {
      setCollectionPdfPrintingId(null);
    }
  }

  return (
    <HomeStyle>
      <Header />
      <HomeContent>
        <Card>
          <CardHeaderRow>
            <h2>Ocorrencias Pendentes</h2>
            <button className="secondary" onClick={loadHomePendencies} type="button">Atualizar lista</button>
          </CardHeaderRow>

          {!pendingCollectionRequests.length && !pendingOccurrences.length ? (
            <InlineText style={{ marginTop: '12px' }}>Nenhuma pendência no momento.</InlineText>
          ) : (
            <>
              {!!pendingCollectionRequests.length && (
                <>
                  <InfoText style={{ marginTop: '12px' }}>
                    Coletas da Torre de Controle (solicitadas, agendadas, solicitações de cancelamento e coletadas)
                  </InfoText>
                  {!!unscheduledCollectionRequests.length && (
                    <>
                      <InfoText className="mt-2">Coletas aguardando agendamento</InfoText>
                      <List className="mt-2">
                        {unscheduledCollectionRequests.map((request) => (
                          <li
                            key={`home-pickup-unscheduled-${request.id}`}
                            className="!border-amber-500/55 !bg-[linear-gradient(135deg,rgba(95,45,8,0.45)_0%,rgba(58,28,5,0.62)_100%)]"
                          >
                            <OccurrenceItemContent>
                              <span className="flex flex-wrap items-center gap-2">
                                <strong className="text-amber-200">COLETA SOLICITADA</strong>
                                <span className={getCollectionUrgencyBadgeClass(request.urgency_level)}>
                                  {getCollectionUrgencyBadgeLabel(request.urgency_level)}
                                </span>
                              </span>
                              <span>
                                <strong>NF: {request.invoice_number || '-'}</strong>
                                {` | CLIENTE: ${request.customer_name || '-'}`}
                              </span>
                              <span>{`CIDADE: ${request.city || '-'}`}</span>
                              <span>{`STATUS: ${getCollectionStatusLabel(request)}`}</span>
                              <span>
                                ITEM: {request.product_id ? `${request.product_id} - ` : ''}{request.product_description || '-'}
                                {` | `}
                                <strong>{`Qtd: ${Number(request.quantity || 0)}${normalizeProductType(request.product_type) || ''}`}</strong>
                              </span>
                              <span>{`URGÊNCIA: ${formatUrgencyLabel(request.urgency_level)}`}</span>
                              {request.notes ? <span>{`OBS: ${request.notes}`}</span> : null}

                              <OccurrenceCardFooter>
                                <OccurrenceActionsRow>
                                  <OccurrenceActionsLeft>
                                    {canManageCollectionWorkflowStatus && (
                                      <>
                                        <button
                                          className="primary hidden md:inline-flex md:items-center md:gap-1.5 md:px-3"
                                          onClick={() => openCollectionScheduleModal(request)}
                                          type="button"
                                        >
                                          <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                          Agendar coleta
                                        </button>
                                        <IconButton
                                          icon={CalendarDays}
                                          label="Agendar coleta"
                                          onClick={() => openCollectionScheduleModal(request)}
                                          className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0 !border-accent/60 !bg-accent/20 !text-text-accent hover:!bg-accent/35 md:!hidden"
                                        />
                                      </>
                                    )}
                                  </OccurrenceActionsLeft>

                                  <OccurrenceActionsRight>
                                    <IconButton
                                      icon={MessageSquare}
                                      label="Registrar observacao da coleta"
                                      onClick={() => openCollectionNoteModal(request)}
                                      className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0"
                                    />
                                    <IconButton
                                      icon={History}
                                      label="Historico da coleta"
                                      onClick={() => handleViewCollectionHistory(request)}
                                      className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0"
                                    />
                                    <IconButton
                                      icon={Printer}
                                      label="Imprimir PDF da coleta"
                                      onClick={() => handlePrintCollectionPdf(request)}
                                      className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0"
                                      disabled={collectionPdfPrintingId === request.id}
                                    />
                                  </OccurrenceActionsRight>
                                </OccurrenceActionsRow>
                              </OccurrenceCardFooter>
                            </OccurrenceItemContent>
                          </li>
                        ))}
                      </List>
                    </>
                  )}

                  {!!cancellationRequestedCollectionRequests.length && (
                    <>
                      <InfoText className="mt-2">Solicitações de cancelamento da Torre de Controle</InfoText>
                      <List className="mt-2">
                        {cancellationRequestedCollectionRequests.map((request) => (
                          <li
                            key={`home-pickup-cancellation-request-${request.id}`}
                            className="!border-rose-500/55 !bg-[rgba(58,10,10,0.72)]"
                          >
                            <OccurrenceItemContent className="gap-1.5">
                              <span className="flex flex-wrap items-center gap-2">
                                <strong className="text-rose-200">CANCELAMENTO SOLICITADO</strong>
                                <span className="rounded-full border border-rose-300/35 bg-rose-300/15 px-2 py-0.5 text-[11px] font-semibold text-rose-100">
                                  {`Em: ${formatDateBR(request.updated_at)}`}
                                </span>
                              </span>
                              <span>
                                <strong>NF: {request.invoice_number || '-'}</strong>
                                {` | CLIENTE: ${request.customer_name || '-'} | CIDADE: ${request.city || '-'}`}
                              </span>
                              <span>
                                ITEM: {request.product_id ? `${request.product_id} - ` : ''}{request.product_description || '-'}
                                {` | `}
                                <strong>{`Qtd: ${Number(request.quantity || 0)}${normalizeProductType(request.product_type) || ''}`}</strong>
                              </span>
                              {request.notes ? <span>{`OBS: ${request.notes}`}</span> : null}

                              <OccurrenceCardFooter>
                                <OccurrenceActionsRow>
                                  <OccurrenceActionsLeft>
                                    <span className="text-xs text-muted">
                                      A Torre solicitou cancelamento de uma coleta já agendada. Defina se a coleta será cancelada ou mantida.
                                    </span>
                                  </OccurrenceActionsLeft>

                                  <OccurrenceActionsRight>
                                    {canManageCollectionWorkflowStatus && (
                                      <>
                                        <IconButton
                                          icon={CheckCircle2}
                                          label="Aprovar cancelamento"
                                          onClick={() => handleApproveCollectionCancellation(request)}
                                          className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0 !border-rose-400/55 !bg-rose-400/15 !text-rose-100 hover:!bg-rose-400/25"
                                          disabled={collectionStatusUpdatingId === request.id}
                                        />
                                        <IconButton
                                          icon={CalendarDays}
                                          label="Manter coleta agendada"
                                          onClick={() => handleRejectCollectionCancellation(request)}
                                          className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0 !border-amber-400/55 !bg-amber-400/15 !text-amber-100 hover:!bg-amber-400/25"
                                          disabled={collectionStatusUpdatingId === request.id}
                                        />
                                      </>
                                    )}
                                    <IconButton
                                      icon={Info}
                                      label="Informacoes da coleta"
                                      onClick={() => openCollectionDetailsModal(request)}
                                      className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0"
                                    />
                                  </OccurrenceActionsRight>
                                </OccurrenceActionsRow>
                              </OccurrenceCardFooter>
                            </OccurrenceItemContent>
                          </li>
                        ))}
                      </List>
                    </>
                  )}

                  {!!scheduledCollectionRequests.length && (
                    <>
                      <InfoText className="mt-2">Coletas agendadas</InfoText>
                      <List className="mt-2">
                        {scheduledCollectionRequests.map((request) => (
                          <li
                            key={`home-pickup-scheduled-${request.id}`}
                            className="!border-sky-500/45 !bg-[rgba(8,30,48,0.72)]"
                          >
                            <OccurrenceItemContent className="gap-1.5">
                              <span className="flex flex-wrap items-center gap-2">
                                <strong className="text-sky-200">COLETA AGENDADA</strong>
                                <span className="rounded-full border border-sky-300/35 bg-sky-300/15 px-2 py-0.5 text-[11px] font-semibold text-sky-100">
                                  {`Data: ${formatDateBR(request.scheduled_for)}`}
                                </span>
                                <span className={getCollectionUrgencyBadgeClass(request.urgency_level)}>
                                  {getCollectionUrgencyBadgeLabel(request.urgency_level)}
                                </span>
                              </span>
                              <span>
                                <strong>NF: {request.invoice_number || '-'}</strong>
                                {` | CLIENTE: ${request.customer_name || '-'} | CIDADE: ${request.city || '-'}`}
                              </span>

                              <OccurrenceCardFooter>
                                <OccurrenceActionsRow>
                                  <OccurrenceActionsLeft>
                                    {canManageCollectionWorkflowStatus && (
                                      <>
                                        <button
                                          className="primary hidden md:inline-flex md:items-center md:gap-1.5 md:px-3"
                                          onClick={() => openCollectionScheduleModal(request)}
                                          type="button"
                                          disabled={collectionStatusUpdatingId === request.id}
                                        >
                                          <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                          Editar data
                                        </button>
                                        <IconButton
                                          icon={CalendarDays}
                                          label="Editar data da coleta"
                                          onClick={() => openCollectionScheduleModal(request)}
                                          className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0 !border-accent/60 !bg-accent/20 !text-text-accent hover:!bg-accent/35 md:!hidden"
                                          disabled={collectionStatusUpdatingId === request.id}
                                        />
                                      </>
                                    )}
                                  </OccurrenceActionsLeft>

                                  <OccurrenceActionsRight>
                                    {canManageCollectionWorkflowStatus && (
                                      <IconButton
                                        icon={CheckCircle2}
                                        label="Confirmar coleta"
                                        onClick={() => handleMarkCollectionAsCollected(request)}
                                        className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0 !border-emerald-400/45 !bg-emerald-400/15 !text-emerald-100 hover:!bg-emerald-400/25"
                                        disabled={collectionStatusUpdatingId === request.id}
                                      />
                                    )}
                                    <IconButton
                                      icon={Info}
                                      label="Informacoes da coleta"
                                      onClick={() => openCollectionDetailsModal(request)}
                                      className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0"
                                    />
                                  </OccurrenceActionsRight>
                                </OccurrenceActionsRow>
                              </OccurrenceCardFooter>
                            </OccurrenceItemContent>
                          </li>
                        ))}
                      </List>
                    </>
                  )}

                  {!!collectedCollectionRequests.length && (
                    <>
                      <InfoText className="mt-2">Coletas coletadas aguardando envio em lote</InfoText>
                      <List className="mt-2">
                        {collectedCollectionRequests.map((request) => (
                          <li
                            key={`home-pickup-collected-${request.id}`}
                            className="!border-emerald-500/45 !bg-[rgba(5,36,31,0.72)]"
                          >
                            <OccurrenceItemContent className="gap-1.5">
                              <span className="flex flex-wrap items-center gap-2">
                                <strong className="text-emerald-200">COLETA COLETADA</strong>
                                <span className="rounded-full border border-emerald-300/35 bg-emerald-300/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                                  {`Confirmada em: ${formatDateBR(request.collected_at || request.updated_at)}`}
                                </span>
                              </span>
                              <span>
                                <strong>NF: {request.invoice_number || '-'}</strong>
                                {` | CLIENTE: ${request.customer_name || '-'} | CIDADE: ${request.city || '-'}`}
                              </span>

                              <OccurrenceCardFooter>
                                <OccurrenceActionsRow>
                                  <OccurrenceActionsLeft>
                                    <span className="text-xs text-muted">
                                      Aguardando retorno para a Mar e Rio, ao ser adicionada em um lote de devolução e enviada a coleta é concluída.
                                    </span>
                                  </OccurrenceActionsLeft>

                                  <OccurrenceActionsRight>
                                    <IconButton
                                      icon={Info}
                                      label="Informacoes da coleta"
                                      onClick={() => openCollectionDetailsModal(request)}
                                      className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0"
                                    />
                                  </OccurrenceActionsRight>
                                </OccurrenceActionsRow>
                              </OccurrenceCardFooter>
                            </OccurrenceItemContent>
                          </li>
                        ))}
                      </List>
                    </>
                  )}
                </>
              )}

              {!!pendingOccurrences.length && (
                <>
                  <InfoText style={{ marginTop: '12px' }}>Ocorrências pendentes</InfoText>
                  {!!priorityLoadingOccurrences.length && (
                    <>
                      <InfoText className="mt-2">Prioridade de carregamento</InfoText>
                      <List className="mt-2">
                        {priorityLoadingOccurrences.map((occurrence) => {
                          const itemsSummary = getItemsSummary(occurrence);

                          return (
                            <li
                              key={occurrence.id}
                              className="!border-accent/45 !bg-[rgba(6,18,29,0.78)]"
                            >
                              <OccurrenceItemContent className="gap-1.5">
                                <span className="w-fit rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-text-accent">
                                  Prioridade de carregamento
                                </span>
                                <span><strong>Cliente:</strong> {occurrence.customer_name || '-'}</span>
                                <span><strong>Cidade:</strong> {occurrence.city || '-'}</span>
                                <span className="flex flex-col gap-1 rounded-md border border-white/10 bg-[rgba(3,10,16,0.35)] px-2 py-2">
                                  <strong>Produtos faltantes:</strong>
                                  {itemsSummary.length ? (
                                    itemsSummary.map((item, index) => (
                                      <span key={`home-occ-priority-summary-${occurrence.id}-${item.label}-${index}`} className="pl-2">
                                        {item.label} | <strong>{`Qtd: ${item.quantityWithType}`}</strong>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="pl-2">NF total</span>
                                  )}
                                </span>

                                {renderOccurrenceActions(occurrence)}
                              </OccurrenceItemContent>
                            </li>
                          );
                        })}
                      </List>
                    </>
                  )}

                  {!!simpleFlowOccurrences.length && (
                    <>
                      <InfoText className="mt-2">Ocorrências pendentes de formulário mercadoria faltante</InfoText>
                      <List className="mt-2">
                        {simpleFlowOccurrences.map((occurrence) => {
                          const itemsSummary = getItemsSummary(occurrence);

                          return (
                            <li
                              key={occurrence.id}
                              className="!border-slate-500/35 !bg-[rgba(9,17,25,0.74)]"
                            >
                              <OccurrenceItemContent className="gap-1.5">
                                <span className="w-fit rounded-full border border-slate-300/25 bg-slate-300/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-slate-100">
                                  Formulario de faltante
                                </span>
                                <span><strong>Cliente:</strong> {occurrence.customer_name || '-'}</span>
                                <span><strong>Cidade:</strong> {occurrence.city || '-'}</span>
                                <span className="flex flex-col gap-1 rounded-md border border-white/10 bg-[rgba(3,10,16,0.35)] px-2 py-2">
                                  <strong>Produtos faltantes:</strong>
                                  {itemsSummary.length ? (
                                    itemsSummary.map((item, index) => (
                                      <span key={`home-occ-simple-summary-${occurrence.id}-${item.label}-${index}`} className="pl-2">
                                        {item.label} | <strong>{`Qtd: ${item.quantityWithType}`}</strong>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="pl-2">NF total</span>
                                  )}
                                </span>

                                {renderOccurrenceActions(occurrence)}
                              </OccurrenceItemContent>
                            </li>
                          );
                        })}
                      </List>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </Card>
      </HomeContent>

      {isOccurrenceEditOpen && canManageOccurrenceStatus && (
        <>
          <ModalOverlay onClick={closeOccurrenceEditModal} />
          <ModalCard className="max-h-[88vh] w-[min(96vw,760px)] overflow-y-auto">
            <h3>{editingOccurrenceId ? `Editar ocorrencia #${editingOccurrenceId}` : 'Editar ocorrencia'}</h3>
            <Grid className="grid-cols-1">
              <div className="min-w-0">
                <SearchInput
                  type="text"
                  inputMode="numeric"
                  value={occurrenceNf}
                  onChange={(event) => setOccurrenceNf(event.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="Digite a NF"
                  maxLength={9}
                  onSearch={handleSearchOccurrenceNf}
                  searchLabel="Buscar NF de ocorrencia"
                  aria-label="NF da ocorrencia"
                  className="text-[1rem] tracking-[0.04em]" wrapperClassName="max-w-[280px] max-md:max-w-full"
                />
              </div>
            </Grid>

            {occurrenceDanfe && (
              <>
                <InlineText style={{ marginTop: '12px' }}>
                  NF selecionada: {occurrenceDanfe.invoice_number} | Cliente: {occurrenceDanfe.Customer.name_or_legal_entity}
                </InlineText>

                <Grid className="mt-3 grid-cols-1 md:grid-cols-3">
                  <div>
                    <InlineText>Motivo</InlineText>
                    <select
                      value={occurrenceReason}
                      onChange={(event) => setOccurrenceReason(event.target.value as OccurrenceReasonValue)}
                    >
                      {occurrenceReason === 'legacy_outros' && (
                        <option value="legacy_outros">Legado / outros</option>
                      )}
                      {OCCURRENCE_REASONS.map((reason) => (
                        <option key={reason.value} value={reason.value}>
                          {reason.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <InlineText>Produto</InlineText>
                    <select
                      value={occurrenceProductCode}
                      onChange={(event) => {
                        const nextProductCode = event.target.value;
                        const switchingToTotal = nextProductCode === OCCURRENCE_TOTAL_OPTION;

                        if (editingOccurrenceId && switchingToTotal && occurrenceItems.length) {
                          const confirmed = window.confirm('Deseja trocar a ocorrencia para NF total? Os itens selecionados serao removidos.');
                          if (!confirmed) return;
                        }

                        setOccurrenceProductType('');
                        setOccurrenceProductCode(nextProductCode);
                      }}
                    >
                      <option value={OCCURRENCE_TOTAL_OPTION}>Total da NF</option>
                      {occurrenceDanfe.DanfeProducts.map((item) => (
                        <option key={`home-occ-select-${item.Product.code}`} value={item.Product.code}>
                          {item.Product.code} - {item.Product.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <InlineText>Tipo da quantidade</InlineText>
                    <select
                      value={occurrenceProductType}
                      onChange={(event) => {
                        const nextType = normalizeProductType(event.target.value);
                        setOccurrenceProductType(nextType);
                        setOccurrenceQuantityInput(nextType.includes('KG') ? String(KG_QUANTITY_MIN) : '1');
                      }}
                      disabled={isOccurrenceTotal || !selectedOccurrenceProduct}
                    >
                      {!occurrenceTypeOptions.length ? (
                        <option value="">Selecione</option>
                      ) : (
                        occurrenceTypeOptions.map((typeOption) => (
                          <option key={`home-occ-type-${typeOption}`} value={typeOption}>
                            {typeOption}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </Grid>

                {!isOccurrenceTotal && (
                  <>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                      <div>
                        <InlineText>Quantidade</InlineText>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={occurrenceQuantityInput}
                          onChange={(event) => setOccurrenceQuantityInput(event.target.value)}
                          disabled={!selectedOccurrenceProduct}
                        />
                        {!!selectedOccurrenceProduct && (
                          <InfoText>
                            Limite da NF: {occurrenceProductMaxQty} | Restante: {occurrenceProductRemainingQty}
                          </InfoText>
                        )}
                      </div>
                      <button
                        className="secondary h-[42px] shrink-0 rounded-md border-none bg-white/15 px-4 font-semibold text-text disabled:cursor-not-allowed disabled:opacity-45"
                        onClick={addOccurrenceItem}
                        type="button"
                        disabled={!selectedOccurrenceProduct || occurrenceProductRemainingQty <= 0}
                      >
                        Adicionar item
                      </button>
                    </div>
                    <List>
                      {!occurrenceItems.length ? (
                        <li>
                          <span>Nenhum item selecionado.</span>
                        </li>
                      ) : occurrenceItems.map((item) => (
                        <li key={`home-occ-item-${item.product_id}-${normalizeProductType(item.product_type) || 'NA'}`}>
                          <span>
                            <strong>{item.product_id}</strong> - {item.product_description}
                            {` | Tipo: ${normalizeProductType(item.product_type) || 'N/A'} | Qtd: ${item.quantity}`}
                          </span>
                          <Actions>
                            <button className="danger" onClick={() => removeOccurrenceItem(item.product_id, item.product_type)} type="button">Remover</button>
                          </Actions>
                        </li>
                      ))}
                    </List>
                  </>
                )}
              </>
            )}

            <Actions style={{ marginTop: '12px' }}>
              {occurrenceDanfe && editingOccurrenceId && (
                <button className="primary" onClick={handleEditOccurrence} type="button">
                  Salvar alteracoes
                </button>
              )}
              <button className="secondary" onClick={closeOccurrenceEditModal} type="button">
                Cancelar edicao
              </button>
            </Actions>
          </ModalCard>
        </>
      )}

      {collectionScheduleModalOpen && collectionScheduleRequest && (
        <>
          <ModalOverlay onClick={closeCollectionScheduleModal} />
          <ModalCard>
            <h3>
              {resolveCollectionStatus(collectionScheduleRequest) === 'aceita_agendada'
                ? `Reagendar coleta #${collectionScheduleRequest.id}`
                : `Agendar coleta #${collectionScheduleRequest.id}`}
            </h3>
            <InlineText>
              NF: {collectionScheduleRequest.invoice_number || '-'} | Cliente: {collectionScheduleRequest.customer_name || '-'}
            </InlineText>
            <InlineText style={{ marginTop: '10px' }}>Data prevista da coleta</InlineText>
            <input
              type="date"
              value={collectionScheduleDate}
              onChange={(event) => setCollectionScheduleDate(event.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
            <InlineText style={{ marginTop: '10px' }}>
              {resolveCollectionStatus(collectionScheduleRequest) === 'aceita_agendada'
                ? 'Justificativa da alteracao (obrigatoria ao mudar data)'
                : 'Observacao do agendamento (opcional)'}
            </InlineText>
            <textarea
              value={collectionScheduleReason}
              onChange={(event) => setCollectionScheduleReason(event.target.value)}
              placeholder="Ex: cliente pediu reagendamento para o periodo da tarde."
              style={{ width: '100%', minHeight: 96, marginTop: 6 }}
            />

            <Actions style={{ marginTop: '12px' }}>
              <button
                className="primary"
                onClick={handleSaveCollectionSchedule}
                type="button"
                disabled={collectionScheduleSaving}
              >
                {collectionScheduleSaving ? 'Salvando...' : 'Salvar data'}
              </button>
              <button
                className="secondary"
                onClick={closeCollectionScheduleModal}
                type="button"
                disabled={collectionScheduleSaving}
              >
                Cancelar
              </button>
            </Actions>
          </ModalCard>
        </>
      )}

      {collectionNoteModalOpen && collectionNoteRequest && (
        <>
          <ModalOverlay onClick={closeCollectionNoteModal} />
          <ModalCard>
            <h3>Registrar observacao da coleta #{collectionNoteRequest.id}</h3>
            <InlineText>
              NF: {collectionNoteRequest.invoice_number || '-'} | Cliente: {collectionNoteRequest.customer_name || '-'}
            </InlineText>
            <InlineText style={{ marginTop: '10px' }}>Observacao</InlineText>
            <textarea
              value={collectionNoteText}
              onChange={(event) => setCollectionNoteText(event.target.value)}
              placeholder="Descreva problema, bloqueio ou informacao relevante para a Torre de Controle."
              style={{ width: '100%', minHeight: 120, marginTop: 6 }}
            />
            <Actions style={{ marginTop: '12px' }}>
              <button
                className="primary"
                onClick={handleSaveCollectionNote}
                type="button"
                disabled={collectionNoteSaving}
              >
                {collectionNoteSaving ? 'Salvando...' : 'Registrar observacao'}
              </button>
              <button
                className="secondary"
                onClick={closeCollectionNoteModal}
                type="button"
                disabled={collectionNoteSaving}
              >
                Cancelar
              </button>
            </Actions>
          </ModalCard>
        </>
      )}

      {collectionDetailsRequest && (
        <>
          <ModalOverlay onClick={closeCollectionDetailsModal} />
          <ModalCard className="max-h-[88vh] w-[min(96vw,760px)] overflow-y-auto">
            <h3>Informacoes da coleta #{collectionDetailsRequest.id}</h3>
            <InlineText>
              NF: {collectionDetailsRequest.invoice_number || '-'} | Cliente: {collectionDetailsRequest.customer_name || '-'}
            </InlineText>
            <InlineText style={{ marginTop: '6px' }}>
              Cidade: {collectionDetailsRequest.city || '-'}
            </InlineText>

            <List className="mt-2">
              <li>
                <span><strong>Status:</strong> {getCollectionStatusLabel(collectionDetailsRequest)}</span>
              </li>
              <li>
                <span><strong>Urgencia:</strong> {formatUrgencyLabel(collectionDetailsRequest.urgency_level)}</span>
              </li>
              <li>
                <span><strong>Solicitada em:</strong> {formatDateBR(collectionDetailsRequest.created_at)}</span>
              </li>
              <li>
                <span><strong>Data agendada:</strong> {formatDateBR(collectionDetailsRequest.scheduled_for)}</span>
              </li>
              <li>
                <span><strong>Solicitada pela:</strong> {collectionDetailsRequest.requested_by_company || '-'}</span>
              </li>
            </List>

            <InlineText style={{ marginTop: '10px' }}>Itens da coleta</InlineText>
            <div className="mt-2 rounded-md border border-white/10 bg-[rgba(5,14,22,0.5)] px-3 py-2 text-sm text-text">
              {collectionDetailsRequest.request_scope === 'invoice_total'
                ? 'NF total'
                : (
                  <>
                    {collectionDetailsRequest.product_id ? `${collectionDetailsRequest.product_id} - ` : ''}
                    {collectionDetailsRequest.product_description || '-'}
                    {` | Qtd: ${formatCollectionQuantityWithType(
                      Number(collectionDetailsRequest.quantity || 0),
                      collectionDetailsRequest.product_type,
                    )}`}
                  </>
                )}
            </div>

            {collectionDetailsRequest.request_scope === 'items' && (
              <>
                <InlineText style={{ marginTop: '10px' }}>Saldo da NF por item</InlineText>
                <List className="mt-2">
                  <li>
                    <span>
                      <strong>Qtd original:</strong>{' '}
                      {formatCollectionQuantityWithType(
                        collectionDetailsRequest.quantity_original,
                        collectionDetailsRequest.product_type,
                      )}
                    </span>
                  </li>
                  <li>
                    <span>
                      <strong>Total coletado:</strong>{' '}
                      {formatCollectionQuantityWithType(
                        collectionDetailsRequest.total_collected,
                        collectionDetailsRequest.product_type,
                      )}
                    </span>
                  </li>
                  <li>
                    <span>
                      <strong>Restante coletavel:</strong>{' '}
                      {formatCollectionQuantityWithType(
                        collectionDetailsRequest.remaining_collectable,
                        collectionDetailsRequest.product_type,
                      )}
                    </span>
                  </li>
                </List>

                <InlineText style={{ marginTop: '10px' }}>Historico de coletas confirmadas do item</InlineText>
                {Array.isArray(collectionDetailsRequest.collection_item_history)
                && collectionDetailsRequest.collection_item_history.length ? (
                  <List className="mt-2">
                    {collectionDetailsRequest.collection_item_history.map((historyItem) => (
                      <li key={`collection-item-history-${collectionDetailsRequest.id}-${historyItem.collection_request_id}-${historyItem.created_at || 'na'}`}>
                        <span>
                          <strong>{`#${historyItem.collection_request_id}`}</strong>
                          {historyItem.request_code ? ` | ${historyItem.request_code}` : ''}
                          {` | Qtd: ${formatCollectionQuantityWithType(historyItem.quantity, collectionDetailsRequest.product_type)}`}
                          {` | Status: ${String(historyItem.workflow_status || '-').replace(/_/g, ' ')}`}
                          {` | Data: ${formatDateBR(resolveCollectionItemHistoryEventDate(historyItem))}`}
                        </span>
                      </li>
                    ))}
                  </List>
                  ) : (
                    <InlineText style={{ marginTop: '6px' }}>Nenhuma coleta confirmada para este item.</InlineText>
                  )}
              </>
            )}

            {collectionDetailsRequest.notes ? (
              <>
                <InlineText style={{ marginTop: '10px' }}>Observacao</InlineText>
                <div className="mt-2 rounded-md border border-white/10 bg-[rgba(5,14,22,0.5)] px-3 py-2 text-sm text-text">
                  {collectionDetailsRequest.notes}
                </div>
              </>
            ) : null}

            <Actions style={{ marginTop: '12px' }}>
              <button className="secondary" onClick={closeCollectionDetailsModal} type="button">
                Fechar
              </button>
            </Actions>
          </ModalCard>
        </>
      )}

      {resolvingOccurrence && (
        <>
          <ModalOverlay onClick={closeResolveModal} />
          <ModalCard>
            <h3>Resolver ocorrencia #{resolvingOccurrence.id}</h3>
            <InlineText>
              Motivo: {OCCURRENCE_REASON_LABELS[resolvingOccurrence.reason || 'legacy_outros'] || 'Legado / outros'}
            </InlineText>
            {isSimpleOccurrenceReason(resolvingOccurrence.reason) && (
              <InfoText style={{ marginTop: '10px' }}>
                Fluxo esperado: preencher formulario de devolucao, marcar como resolvida e seguir com credito ao cliente pela Mar e Rio.
              </InfoText>
            )}
            <InlineText style={{ marginTop: '10px' }}>Como foi resolvida?</InlineText>
            <select
              value={resolutionType}
              onChange={(event) => setResolutionType(event.target.value)}
              style={{ width: '100%', marginTop: 6, minHeight: 40 }}
            >
              <option value="">Selecione</option>
              {availableResolutionOptions.map((option) => (
                <option key={`home-res-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
            <InlineText style={{ marginTop: '10px' }}>Observacao (opcional)</InlineText>
            <textarea
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="Detalhes da resolucao"
              style={{ width: '100%', minHeight: 96, marginTop: 6 }}
            />
            <Actions style={{ marginTop: '12px' }}>
              <button className="primary" onClick={handleResolveOccurrence} type="button">Confirmar</button>
              <button className="secondary" onClick={closeResolveModal} type="button">Cancelar</button>
            </Actions>
          </ModalCard>
        </>
      )}

      {historyModalOpen && (
        <>
          <ModalOverlay onClick={() => setHistoryModalOpen(false)} />
          <ModalCard>
            <h3>{historyModalTitle}</h3>
            {!historyEntries.length ? (
              <InlineText>Nenhum evento de historico encontrado.</InlineText>
            ) : (
              <List>
                {historyEntries.map((entry) => {
                  const metadataSummary = summarizeHistoryMetadata(entry);

                  return (
                    <li key={entry.id}>
                      <div className="flex flex-col gap-1">
                        <span>
                          <strong>{entry.action}</strong>
                          {` | Usuario: ${entry.actor_username || entry.actor_user_id || 'nao identificado'}`}
                          {` | Data: ${formatDateBR(entry.created_at)}`}
                        </span>
                        {metadataSummary ? <span className="text-xs text-text-accent">{metadataSummary}</span> : null}
                      </div>
                    </li>
                  );
                })}
              </List>
            )}

            <Actions style={{ marginTop: '12px' }}>
              <button className="secondary" onClick={() => setHistoryModalOpen(false)} type="button">
                Fechar
              </button>
            </Actions>
          </ModalCard>
        </>
      )}
    </HomeStyle>
  );
}

export default Home;
