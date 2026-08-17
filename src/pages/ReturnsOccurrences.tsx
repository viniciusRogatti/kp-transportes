import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import { useSearchParams } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSearch,
  History,
  PackageCheck,
  Pencil,
  Trash2,
  Truck,
  X,
} from 'lucide-react';

import Header from '../components/Header';
import ReturnReceiptPDF from '../components/ReturnReceiptPDF';
import MissingCargoOccurrenceDetails, {
  isMissingCargoOccurrence,
} from '../components/occurrences/MissingCargoOccurrenceDetails';
import IconButton from '../components/ui/IconButton';
import SearchInput from '../components/ui/SearchInput';
import { API_URL } from '../data';
import { Container } from '../style/invoices';
import {
  Actions,
  BoxDescription,
  Card,
  CardHeaderRow,
  BatchActionsRow,
  BatchItemContent,
  Grid,
  InfoText,
  InlineText,
  ListHeaderRow,
  List,
  ModalCard,
  ModalOverlay,
  OccurrenceActionsLeft,
  OccurrenceActionsRight,
  OccurrenceActionsRow,
  OccurrenceCardFooter,
  OccurrenceItemContent,
  PageContainer,
  ReturnSearchRow,
  SaveBatchButton,
  SingleColumn,
  Tabs,
  TabsRow,
  TopActionBar,
} from '../style/returnsOccurrences';
import {
  ICar,
  ICollectionRequest,
  IDanfe,
  IDriver,
  IInvoiceReturn,
  IInvoiceReturnItem,
  IOccurrence,
  IProduct,
  IReturnBatch,
} from '../types/types';
import verifyToken from '../utils/verifyToken';
import { formatDateBR, formatDateTimeBR } from '../utils/dateDisplay';
import { showConfirm } from '../utils/dialog';
import { handleAuthenticationError } from '../utils/authErrorHandler';
import { sanitizeDanfeTextFields } from '../utils/textNormalization';
import {
  getReturnDataByInvoice,
  getReturnDataOverview,
  InvoiceReturnDataLookup,
} from '../services/returnDataService';

const DEFAULT_RETURN_UNIT_TYPES = ['UN', 'CX', 'FD', 'KG', 'PCT'];
const RETURN_BATCH_LOOKBACK_OPTIONS = [
  { value: '7', label: 'Ultimos 7 dias' },
  { value: '30', label: 'Ultimos 30 dias' },
] as const;
type ReturnBatchLookbackValue = (typeof RETURN_BATCH_LOOKBACK_OPTIONS)[number]['value'];
type VehicleSuggestionResponse = {
  suggestion: null | {
    car: ICar;
    usageCount: number;
    sampleSize: number;
    lastUsedAt: string | null;
    basis: 'most_used_recently';
  };
};

const OCCURRENCE_REASONS = [
  { value: 'faltou_no_carregamento', label: 'Faltou no carregamento' },
  { value: 'faltou_na_carga', label: 'Faltou na carga' },
  { value: 'produto_avariado', label: 'Produto avariado' },
  { value: 'produto_invertido', label: 'Produto invertido' },
  { value: 'produto_sem_etiqueta_ou_data', label: 'Produto sem etiqueta de identificacao ou data' },
] as const;

const OCCURRENCE_TOTAL_OPTION = '__INVOICE_TOTAL__';
const KG_QUANTITY_MIN = 0.01;
const KG_QUANTITY_PRECISION = 1000;
const QUANTITY_EPSILON = 1e-6;
const normalizeAssignmentSearch = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const RESOLUTION_LABELS: Record<string, string> = {
  enviado_posteriormente: 'Enviado posteriormente',
  nf_parcial_emitida: 'Emitida NF parcial',
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
    { value: 'nf_parcial_emitida', label: RESOLUTION_LABELS.nf_parcial_emitida },
    { value: 'talao_mercadoria_faltante', label: RESOLUTION_LABELS.talao_mercadoria_faltante },
  ],
  faltou_na_carga: [
    { value: 'nf_parcial_emitida', label: RESOLUTION_LABELS.nf_parcial_emitida },
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

const OCCURRENCE_WORKFLOW_LABELS: Record<'pending_transportadora' | 'awaiting_control_tower' | 'finalized', string> = {
  pending_transportadora: 'Pendente da transportadora',
  awaiting_control_tower: 'Aguardando finalizacao da torre',
  finalized: 'Finalizada',
};

type OccurrenceWorkflowFilter = 'all' | 'pending_transportadora' | 'awaiting_control_tower' | 'finalized';

const resolveOccurrenceWorkflowStatus = (occurrence: IOccurrence): Exclude<OccurrenceWorkflowFilter, 'all'> => {
  const resolved = occurrence.status === 'resolved';
  const isTalao = occurrence.resolution_type === 'talao_mercadoria_faltante';
  const creditCompleted = occurrence.credit_status === 'completed';

  if (!resolved) return 'pending_transportadora';
  if (isTalao && !creditCompleted) return 'awaiting_control_tower';
  return 'finalized';
};

const isOccurrencePendingForTransportadora = (occurrence: IOccurrence) => (
  resolveOccurrenceWorkflowStatus(occurrence) === 'pending_transportadora'
);

type OccurrenceReasonValue = (typeof OCCURRENCE_REASONS)[number]['value'] | 'legacy_outros';
type OccurrenceDraftItem = {
  product_id: string;
  product_description: string;
  product_type: string | null;
  quantity: number;
};
type SavedOccurrenceDraft = {
  invoiceNumber: string;
  reason: OccurrenceReasonValue;
  productCode: string;
  productType: string;
  quantityInput: string;
  items: OccurrenceDraftItem[];
  savedAt: string;
};
const OCCURRENCE_DRAFT_STORAGE_KEY = 'kp_returns_occurrence_draft_v1';

const readSavedOccurrenceDraft = (): SavedOccurrenceDraft | null => {
  try {
    const raw = localStorage.getItem(OCCURRENCE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedOccurrenceDraft>;
    if (!String(parsed.invoiceNumber || '').trim()) return null;
    return {
      invoiceNumber: String(parsed.invoiceNumber || '').replace(/\D/g, '').slice(0, 9),
      reason: (parsed.reason || 'faltou_no_carregamento') as OccurrenceReasonValue,
      productCode: String(parsed.productCode || OCCURRENCE_TOTAL_OPTION),
      productType: String(parsed.productType || ''),
      quantityInput: String(parsed.quantityInput || '1'),
      items: Array.isArray(parsed.items) ? parsed.items : [],
      savedAt: String(parsed.savedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
};
type OccurrenceCardItemSummary = {
  label: string;
  quantityWithType: string;
};
type SurplusInversionDraft = {
  invoice_number: string;
  missing_product_code: string;
};
type SurplusInversionAllocationDraft = SurplusInversionDraft & {
  quantity: number;
};
type ReturnType = 'total' | 'partial' | 'sobra' | 'coleta' | 'weight_break';
const registryTypeToReturnType = (value?: string | null): ReturnType | null => {
  if (value === 'collection') return 'coleta';
  if (value === 'surplus') return 'sobra';
  if (value === 'total' || value === 'partial' || value === 'weight_break') return value;
  return null;
};
const getRegistryTypeLabel = (value?: string | null) => {
  const normalized = registryTypeToReturnType(value);
  if (normalized === 'total') return 'Total';
  if (normalized === 'partial') return 'Parcial';
  if (normalized === 'coleta') return 'Coleta';
  if (normalized === 'weight_break') return 'Quebra de peso';
  if (normalized === 'sobra') return 'Sobra';
  return 'Não classificado';
};
const getApprovedRegistryReturnTypes = (lookup: InvoiceReturnDataLookup | null) => Array.from(new Set(
  (lookup?.occurrences || [])
    .filter((occurrence) => occurrence.approval_status === 'approved')
    .map((occurrence) => registryTypeToReturnType(
      occurrence.effective_return_type || occurrence.inferred_return_type,
    ))
    .filter((value): value is ReturnType => Boolean(value)),
));
type ReturnDraftNote = {
  invoice_number: string;
  return_type: ReturnType;
  items: IInvoiceReturnItem[];
  load_number?: string | null;
  is_inversion?: boolean;
  inversion?: SurplusInversionDraft | null;
};

type ReturnBatchWorkflowStatus = 'pending_transportadora' | 'awaiting_control_tower' | 'finalized';

const RETURN_BATCH_WORKFLOW_LABELS: Record<ReturnBatchWorkflowStatus, string> = {
  pending_transportadora: 'Pendente da transportadora',
  awaiting_control_tower: 'Aguardando confirmacao da Torre de Controle',
  finalized: 'Recebido e finalizado pela Torre de Controle',
};

const resolveReturnBatchWorkflowStatus = (batch: IReturnBatch): ReturnBatchWorkflowStatus => {
  if (batch.workflow_status) {
    return batch.workflow_status;
  }

  if (!batch.sent_to_control_tower_at) {
    return 'pending_transportadora';
  }

  if (!batch.received_by_control_tower_at) {
    return 'awaiting_control_tower';
  }

  return 'finalized';
};

const normalizeProductType = (value?: string | null) => String(value || '').trim().toUpperCase();
const normalizeDecimalInput = (value: string) => value.trim().replace(',', '.');
const normalizeQtyByType = (value: number, isKg: boolean) => (
  isKg ? Math.round(value * KG_QUANTITY_PRECISION) / KG_QUANTITY_PRECISION : value
);
const parseUnitsPerBoxFromDescription = (description?: string | null) => {
  const normalizedDescription = String(description || '').toUpperCase();
  const match = normalizedDescription.match(/\bCX\s*(\d+(?:[.,]\d+)?)\s*UN\b/);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number(normalizeDecimalInput(match[1]));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const getDanfeProductQuantityLimitByType = (product?: IDanfe['DanfeProducts'][number] | null, selectedType?: string | null) => {
  if (!product) {
    return 0;
  }

  const baseQuantity = Number(normalizeDecimalInput(String(product.quantity ?? '0')));
  if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) {
    return 0;
  }

  const normalizedSelectedType = normalizeProductType(selectedType);
  const normalizedProductType = normalizeProductType(product.type || product.Product.type);
  const unitsPerBox = parseUnitsPerBoxFromDescription(product.Product.description);

  if (
    unitsPerBox
    && normalizedProductType.includes('CX')
    && (normalizedSelectedType === 'UN' || normalizedSelectedType === 'PCT')
  ) {
    return baseQuantity * unitsPerBox;
  }

  return baseQuantity;
};
const formatKgInputValue = (value: number) => (
  normalizeQtyByType(value, true).toFixed(3).replace(/\.?0+$/, '')
);
const sanitizeSurplusReferenceToken = (value: string, fallback = 'SEMVALOR') => {
  const normalized = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized || fallback;
};
const buildSurplusReferenceInvoiceNumber = (
  loadNumber: string,
  productCode: string,
  inversionInvoice?: string | null,
  inversionMissingProductCode?: string | null,
) => {
  const base = `SOBRA-${sanitizeSurplusReferenceToken(loadNumber, 'SEMCARGA')}-${sanitizeSurplusReferenceToken(productCode, 'SEMPRODUTO')}`;
  const normalizedInversionInvoice = sanitizeSurplusReferenceToken(String(inversionInvoice || '').slice(0, 14), '');
  const normalizedMissingCode = sanitizeSurplusReferenceToken(String(inversionMissingProductCode || '').slice(0, 20), '');

  if (!normalizedInversionInvoice || !normalizedMissingCode) {
    return base;
  }

  return `${base}-${normalizedInversionInvoice}-${normalizedMissingCode}`;
};
const formatOccurrenceQtyWithType = (quantity: number, productType?: string | null) => {
  const normalizedType = normalizeProductType(productType);
  return `${Number(quantity || 0)}${normalizedType || ''}`;
};
const formatReturnDataUpdate = (value?: string | null) => {
  return formatDateTimeBR(value, '');
};
const buildOccurrenceCardItemSummary = (occurrence: IOccurrence): OccurrenceCardItemSummary[] => {
  if (occurrence.items?.length) {
    return occurrence.items
      .map((item) => {
        const id = String(item.product_id || '').trim();
        const description = String(item.product_description || '').trim();
        const quantity = Number(item.quantity || 0);
        const label = (() => {
          if (id && description) return `${id} - ${description}`;
          return id || description || '';
        })();

        return {
          label: label || 'Item',
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
};
const getReturnItemKey = (
  item: Pick<IInvoiceReturnItem, 'product_id' | 'product_type' | 'is_missing' | 'keep_in_stock'>,
) => (
  [
    item.product_id,
    normalizeProductType(item.product_type),
    item.is_missing ? 'missing' : 'present',
    item.keep_in_stock ? 'stock' : 'return',
  ].join('::')
);
const groupItemsByProductAndType = (items: IInvoiceReturnItem[]) => items.reduce((acc: IInvoiceReturnItem[], item) => {
  const key = getReturnItemKey(item);
  const existing = acc.find((savedItem) => getReturnItemKey(savedItem) === key);

  if (existing) {
    existing.quantity += Number(item.quantity);
  } else {
    acc.push({
      ...item,
      product_type: normalizeProductType(item.product_type) || null,
      quantity: Number(item.quantity),
    });
  }

  return acc;
}, []);

function ReturnsOccurrences() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const getDateInputValue = (date: Date) => {
    const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - timezoneOffsetMs).toISOString().split('T')[0];
  };
  const getTodayDate = () => getDateInputValue(new Date());
  const getBatchRangeByLookback = (lookbackDays: number) => {
    const safeLookback = Number.isFinite(lookbackDays) && lookbackDays > 0 ? Math.floor(lookbackDays) : 7;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (safeLookback - 1));

    return {
      startDate: getDateInputValue(startDate),
      endDate: getDateInputValue(endDate),
    };
  };
  const getReturnPdfFileName = (dateValue: string) => {
    const [year, month, day] = String(dateValue || '').split('-');
    if (!year || !month || !day) {
      return 'DEVOLUCOES-KPTRANSPORTES.pdf';
    }

    return `DEVOLUCOES-KPTRANSPORTES-${day}${month}${year}.pdf`;
  };
  const openPdfInNewTab = (pdfBlob: Blob, fileName: string) => {
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    const pdfUrl = URL.createObjectURL(pdfFile);
    const title = fileName.replace(/\.pdf$/i, '');
    const newTab = window.open('', '_blank');

    if (!newTab) {
      window.open(pdfUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
      return;
    }

    newTab.document.title = title;
    newTab.document.body.style.margin = '0';
    newTab.document.body.innerHTML = `
      <div style="padding:8px 12px;border-bottom:1px solid #ddd;font-family:Arial,sans-serif;display:flex;gap:12px;align-items:center;">
        <strong style="font-size:13px;">${fileName}</strong>
        <a
          href="${pdfUrl}"
          download="${fileName}"
          style="font-size:13px;color:#0b57d0;text-decoration:none;"
        >
          Baixar PDF
        </a>
      </div>
      <iframe
        src="${pdfUrl}"
        title="${title}"
        style="border:0;width:100vw;height:calc(100vh - 42px);"
      ></iframe>
    `;

    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
  };

  const [activeTab, setActiveTab] = useState<'returns' | 'occurrences'>('returns');
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [cars, setCars] = useState<ICar[]>([]);
  const [products, setProducts] = useState<IProduct[]>([]);

  const [returnNf, setReturnNf] = useState(() => String(searchParams.get('nf') || '').replace(/\D/g, '').slice(0, 9));
  const [returnDanfe, setReturnDanfe] = useState<IDanfe | null>(null);
  const [returnDataLookup, setReturnDataLookup] = useState<InvoiceReturnDataLookup | null>(null);
  const [returnDataLookupLoading, setReturnDataLookupLoading] = useState(false);
  const [returnDataLookupError, setReturnDataLookupError] = useState('');
  const [showReturnDataDetails, setShowReturnDataDetails] = useState(false);
  const returnLookupFeedbackRef = useRef<HTMLDivElement>(null);
  const [returnDataLastUpdate, setReturnDataLastUpdate] = useState<string | null>(null);
  const [returnType, setReturnType] = useState<ReturnType>('total');
  const [returnTypeDivergenceAcknowledged, setReturnTypeDivergenceAcknowledged] = useState('');
  const [returnWizardStep, setReturnWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [isReturnNfCollection, setIsReturnNfCollection] = useState(false);
  const [returnNfCollectionLookupLoading, setReturnNfCollectionLookupLoading] = useState(false);
  const [partialProductCode, setPartialProductCode] = useState('');
  const [partialProductType, setPartialProductType] = useState('');
  const [partialQuantityInput, setPartialQuantityInput] = useState('1');
  const [partialItems, setPartialItems] = useState<IInvoiceReturnItem[]>([]);
  const [partialIsMissing, setPartialIsMissing] = useState(false);
  const [partialKeepInStock, setPartialKeepInStock] = useState(false);
  const [partialStockDefault, setPartialStockDefault] = useState(false);
  const [leftoverProductCode, setLeftoverProductCode] = useState('');
  const [leftoverQuantityInput, setLeftoverQuantityInput] = useState('1');
  const [leftoverProductType, setLeftoverProductType] = useState('');
  const [leftoverLoadNumber, setLeftoverLoadNumber] = useState('');
  const [leftoverIsInversion, setLeftoverIsInversion] = useState(false);
  const [leftoverInversionInvoiceNumber, setLeftoverInversionInvoiceNumber] = useState('');
  const [leftoverInversionMissingProductCode, setLeftoverInversionMissingProductCode] = useState('');
  const [leftoverInversionQuantityInput, setLeftoverInversionQuantityInput] = useState('');
  const [leftoverInversionDanfe, setLeftoverInversionDanfe] = useState<IDanfe | null>(null);
  const [leftoverInversionLookupLoading, setLeftoverInversionLookupLoading] = useState(false);
  const [leftoverInversionLookupError, setLeftoverInversionLookupError] = useState('');
  const [leftoverInversionAllocations, setLeftoverInversionAllocations] = useState<SurplusInversionAllocationDraft[]>([]);
  const [draftNotes, setDraftNotes] = useState<ReturnDraftNote[]>([]);
  const [recentlyRemovedDraft, setRecentlyRemovedDraft] = useState<{
    note: ReturnDraftNote;
    index: number;
  } | null>(null);
  const [returnDriverId, setReturnDriverId] = useState('');
  const [selectedCarId, setSelectedCarId] = useState('');
  const [returnDriverInput, setReturnDriverInput] = useState('');
  const [returnCarInput, setReturnCarInput] = useState('');
  const [isReturnDriverSuggestionsOpen, setIsReturnDriverSuggestionsOpen] = useState(false);
  const [isReturnCarSuggestionsOpen, setIsReturnCarSuggestionsOpen] = useState(false);
  const [returnVehicleSuggestionMessage, setReturnVehicleSuggestionMessage] = useState('');
  const [isReturnVehicleSuggestionLoading, setIsReturnVehicleSuggestionLoading] = useState(false);
  const returnVehicleSuggestionRequestRef = useRef(0);
  const [returnDate, setReturnDate] = useState(getTodayDate());

  const [batchLookbackDays, setBatchLookbackDays] = useState<ReturnBatchLookbackValue>('7');
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchEndDate, setBatchEndDate] = useState('');
  const [batchCodeFilter, setBatchCodeFilter] = useState(() => String(searchParams.get('batch') || '').trim());
  const [batchSearchFeedback, setBatchSearchFeedback] = useState('');
  const [returnBatches, setReturnBatches] = useState<IReturnBatch[]>([]);
  const [selectedBatchCode, setSelectedBatchCode] = useState('');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const returnModalContentRef = useRef<HTMLDivElement>(null);
  const [batchDraftNotes, setBatchDraftNotes] = useState<IInvoiceReturn[]>([]);

  const [occurrenceNf, setOccurrenceNf] = useState('');
  const [occurrenceDanfe, setOccurrenceDanfe] = useState<IDanfe | null>(null);
  const [occurrenceReason, setOccurrenceReason] = useState<OccurrenceReasonValue>('faltou_no_carregamento');
  const [occurrenceProductCode, setOccurrenceProductCode] = useState(OCCURRENCE_TOTAL_OPTION);
  const [occurrenceProductType, setOccurrenceProductType] = useState('');
  const [occurrenceQuantityInput, setOccurrenceQuantityInput] = useState('1');
  const [occurrenceItems, setOccurrenceItems] = useState<OccurrenceDraftItem[]>([]);
  const [editingOccurrenceId, setEditingOccurrenceId] = useState<number | null>(null);
  const [resolvingOccurrence, setResolvingOccurrence] = useState<IOccurrence | null>(null);
  const [resolutionType, setResolutionType] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [isOccurrenceBuilderOpen, setIsOccurrenceBuilderOpen] = useState(false);
  const [hasSavedOccurrenceDraft, setHasSavedOccurrenceDraft] = useState(() => Boolean(readSavedOccurrenceDraft()));
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [occurrences, setOccurrences] = useState<IOccurrence[]>([]);
  const [occurrenceStatusFilter, setOccurrenceStatusFilter] = useState<OccurrenceWorkflowFilter>('pending_transportadora');
  const [occurrenceNfFilter, setOccurrenceNfFilter] = useState(() => (
    searchParams.get('tab') === 'occurrences'
      ? String(searchParams.get('nf') || '').replace(/\D/g, '').slice(0, 9)
      : ''
  ));
  const [occurrenceStartDate, setOccurrenceStartDate] = useState('');
  const [occurrenceEndDate, setOccurrenceEndDate] = useState('');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyModalTitle, setHistoryModalTitle] = useState('');
  const [userPermission, setUserPermission] = useState('');
  const [historyEntries, setHistoryEntries] = useState<Array<{
    id: number;
    action: string;
    actor_user_id: number | null;
    actor_username: string | null;
    created_at: string;
  }>>([]);

  const selectedBatch = useMemo(() => (
    returnBatches.find((batch) => batch.batch_code === selectedBatchCode) || null
  ), [returnBatches, selectedBatchCode]);
  const selectedBatchWorkflowStatus = useMemo<ReturnBatchWorkflowStatus | null>(() => (
    selectedBatch ? resolveReturnBatchWorkflowStatus(selectedBatch) : null
  ), [selectedBatch]);
  const isAdminUser = userPermission === 'admin';
  const isControlTowerUser = userPermission === 'control_tower';
  const canManageOccurrenceStatus = !isControlTowerUser;
  const canManageBatchTransportadora = !isControlTowerUser;
  const canConfirmBatchReceipt = userPermission === 'control_tower';
  const isSelectedBatchEditableByTransportadora = Boolean(
    selectedBatch
      && selectedBatchWorkflowStatus === 'pending_transportadora'
      && canManageBatchTransportadora,
  );
  const isSelectedBatchAwaitingControlTower = selectedBatchWorkflowStatus === 'awaiting_control_tower';
  const isReturnWizardMode = !selectedBatch || isSelectedBatchEditableByTransportadora;
  const returnWizardNoteCount = selectedBatch ? batchDraftNotes.length : draftNotes.length;

  function setTab(nextTab: 'returns' | 'occurrences') {
    setReturnModalOpen(false);
    setActiveTab(nextTab);
    localStorage.setItem('returns_occurrences_last_tab', nextTab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', nextTab);
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    const tabFromQuery = searchParams.get('tab');
    const tabFromStorage = localStorage.getItem('returns_occurrences_last_tab');
    const resolved = (tabFromQuery === 'returns' || tabFromQuery === 'occurrences')
      ? tabFromQuery
      : (tabFromStorage === 'returns' || tabFromStorage === 'occurrences')
        ? tabFromStorage
        : 'returns';

    setActiveTab(resolved);

    if (tabFromQuery !== resolved) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', resolved);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!returnModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [returnModalOpen]);

  useEffect(() => {
    if (!returnModalOpen || !isReturnWizardMode) return;
    returnModalContentRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
  }, [isReturnWizardMode, returnModalOpen, returnWizardStep]);

  useEffect(() => {
    if (returnWizardStep !== 2 || (!returnDataLookup && !returnDataLookupError)) return;
    window.requestAnimationFrame(() => {
      returnLookupFeedbackRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
  }, [returnDataLookup, returnDataLookupError, returnWizardStep]);

  useEffect(() => {
    if (!isOccurrenceBuilderOpen || editingOccurrenceId) return;
    if (!occurrenceNf.trim()) return;
    const draft: SavedOccurrenceDraft = {
      invoiceNumber: occurrenceNf,
      reason: occurrenceReason,
      productCode: occurrenceProductCode,
      productType: occurrenceProductType,
      quantityInput: occurrenceQuantityInput,
      items: occurrenceItems,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(OCCURRENCE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setHasSavedOccurrenceDraft(true);
    } catch {
      // O formulario continua utilizavel mesmo se o navegador bloquear armazenamento local.
    }
  }, [
    editingOccurrenceId,
    isOccurrenceBuilderOpen,
    occurrenceItems,
    occurrenceNf,
    occurrenceProductCode,
    occurrenceProductType,
    occurrenceQuantityInput,
    occurrenceReason,
  ]);

  useEffect(() => {
    if (!selectedBatch) {
      setBatchDraftNotes([]);
      return;
    }

    setBatchDraftNotes(selectedBatch.notes);
    const driverId = String(selectedBatch.driver_id || '');
    const currentDriver = drivers.find((driver) => String(driver.id) === driverId);
    setReturnDriverId(driverId);
    setReturnDriverInput(currentDriver?.name || selectedBatch.Driver?.name || '');
    const currentCar = cars.find((car) => String(car.license_plate).toUpperCase() === String(selectedBatch.vehicle_plate || '').toUpperCase());
    setSelectedCarId(currentCar ? String(currentCar.id) : '');
    setReturnCarInput(currentCar ? `${currentCar.model} - ${currentCar.license_plate}` : selectedBatch.vehicle_plate || '');
    setReturnDate(selectedBatch.return_date);
  }, [selectedBatch, cars, drivers]);

  useEffect(() => {
    if (!selectedBatchCode) return;
    clearNfBuilder();
    setReturnWizardStep(1);
  // A abertura de outro lote sempre reinicia a navegacao, sem apagar o conteudo carregado.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchCode]);

  const selectedBatchHasUnsavedChanges = useMemo(() => {
    if (!selectedBatch) {
      return false;
    }

    const originalInvoices = selectedBatch.notes.map((note) => note.invoice_number).sort();
    const draftInvoices = batchDraftNotes.map((note) => note.invoice_number).sort();

    if (originalInvoices.length !== draftInvoices.length) {
      return true;
    }

    const hasInvoiceChanges = originalInvoices.some((invoiceNumber, index) => invoiceNumber !== draftInvoices[index]);
    if (hasInvoiceChanges) {
      return true;
    }

    if (String(selectedBatch.driver_id || '') !== String(returnDriverId || '')) {
      return true;
    }

    const selectedBatchCar = cars.find((car) => String(car.id) === String(selectedCarId));
    const nextVehiclePlate = String(selectedBatchCar?.license_plate || selectedBatch.vehicle_plate || '').toUpperCase();
    return String(selectedBatch.vehicle_plate || '').toUpperCase() !== nextVehiclePlate;
  }, [selectedBatch, batchDraftNotes, returnDriverId, selectedCarId, cars]);

  const selectedBatchDriverName = useMemo(() => {
    if (!selectedBatch) return 'Motorista';
    return drivers.find((driver) => String(driver.id) === String(returnDriverId || selectedBatch.driver_id))?.name
      || selectedBatch.Driver?.name
      || String(returnDriverId || selectedBatch.driver_id || 'Motorista');
  }, [drivers, selectedBatch, returnDriverId]);

  const selectedBatchVehiclePlate = useMemo(() => {
    if (!selectedBatch) return '';
    return cars.find((car) => String(car.id) === String(selectedCarId))?.license_plate
      || selectedBatch.vehicle_plate
      || '';
  }, [cars, selectedBatch, selectedCarId]);

  const selectedBatchAggregatedPreview = useMemo(() => {
    if (!selectedBatch) {
      return [];
    }

    return groupItemsByProductAndType(
      batchDraftNotes.flatMap((note) => note.items || [])
    );
  }, [selectedBatch, batchDraftNotes]);

  const draftAggregatedItems = useMemo(() => {
    const allItems = draftNotes.flatMap((note) => note.items);
    return groupItemsByProductAndType(allItems);
  }, [draftNotes]);
  const returnDriverOptions = useMemo(() => drivers.map((driver) => ({
    id: String(driver.id),
    value: driver.name,
    label: driver.name,
  })), [drivers]);
  const returnCarOptions = useMemo(() => cars.map((car) => ({
    id: String(car.id),
    value: `${car.model} - ${car.license_plate}`,
    label: `${car.model} - ${car.license_plate}`,
  })), [cars]);
  const filteredReturnDriverOptions = useMemo(() => {
    const term = normalizeAssignmentSearch(returnDriverInput);
    return returnDriverOptions
      .filter((option) => !term || normalizeAssignmentSearch(option.value).includes(term))
      .slice(0, 8);
  }, [returnDriverInput, returnDriverOptions]);
  const filteredReturnCarOptions = useMemo(() => {
    const term = normalizeAssignmentSearch(returnCarInput);
    return returnCarOptions
      .filter((option) => !term || normalizeAssignmentSearch(option.value).includes(term))
      .slice(0, 8);
  }, [returnCarInput, returnCarOptions]);

  const selectedPartialDanfeProduct = useMemo(() => (
    returnDanfe?.DanfeProducts.find((item) => item.Product.code === partialProductCode) || null
  ), [returnDanfe, partialProductCode]);

  const selectedPartialTypeOptions = useMemo(() => {
    if (!selectedPartialDanfeProduct) {
      return DEFAULT_RETURN_UNIT_TYPES;
    }

    const fromDanfe = [
      normalizeProductType(selectedPartialDanfeProduct.type),
      normalizeProductType(selectedPartialDanfeProduct.Product.type),
    ].filter(Boolean);

    return Array.from(new Set([...fromDanfe, ...DEFAULT_RETURN_UNIT_TYPES]));
  }, [selectedPartialDanfeProduct]);

  const selectedPartialMaxQty = getDanfeProductQuantityLimitByType(selectedPartialDanfeProduct, partialProductType);
  const selectedPartialAlreadyAddedQty = partialProductCode && partialProductType
    ? partialItems
      .filter((item) => (
        item.product_id === partialProductCode
        && normalizeProductType(item.product_type) === normalizeProductType(partialProductType)
      ))
      .reduce((sum, item) => sum + Number(item.quantity), 0)
    : 0;
  const selectedPartialRemainingQty = Math.max(0, selectedPartialMaxQty - selectedPartialAlreadyAddedQty);
  const selectedLeftoverProduct = useMemo(() => (
    products.find((product) => product.code === leftoverProductCode) || null
  ), [products, leftoverProductCode]);
  const leftoverInversionProducts = useMemo(() => (
    leftoverInversionDanfe?.DanfeProducts || []
  ), [leftoverInversionDanfe]);
  const selectedLeftoverMissingProduct = useMemo(() => (
    leftoverInversionProducts.find((item) => item.Product.code === leftoverInversionMissingProductCode) || null
  ), [leftoverInversionProducts, leftoverInversionMissingProductCode]);
  const parsedLeftoverTotalQty = useMemo(() => {
    const parsed = Number(normalizeDecimalInput(String(leftoverQuantityInput || '')));
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return normalizeQtyByType(parsed, true);
  }, [leftoverQuantityInput]);
  const leftoverInversionAllocatedQty = useMemo(() => (
    normalizeQtyByType(
      leftoverInversionAllocations.reduce((sum, allocation) => sum + Number(allocation.quantity || 0), 0),
      true,
    )
  ), [leftoverInversionAllocations]);
  const leftoverInversionRemainingQty = useMemo(() => (
    Math.max(0, normalizeQtyByType(parsedLeftoverTotalQty - leftoverInversionAllocatedQty, true))
  ), [parsedLeftoverTotalQty, leftoverInversionAllocatedQty]);
  const surplusInversionSummary = useMemo(() => {
    if (!leftoverIsInversion) return '';

    if (leftoverInversionAllocations.length) {
      return `Inversao distribuida em ${leftoverInversionAllocations.length} NF(s) | Distribuido: ${formatKgInputValue(leftoverInversionAllocatedQty)} | Restante: ${formatKgInputValue(leftoverInversionRemainingQty)}`;
    }

    const surplusProductCode = leftoverProductCode.trim().toUpperCase();
    const missingProductCode = leftoverInversionMissingProductCode.trim().toUpperCase();
    const invoiceNumber = leftoverInversionInvoiceNumber.trim();

    if (!surplusProductCode || !missingProductCode || !invoiceNumber) return '';
    return `Inversao: Veio ${surplusProductCode} (sobra) no lugar de ${missingProductCode} (falta) na NF ${invoiceNumber}`;
  }, [
    leftoverIsInversion,
    leftoverProductCode,
    leftoverInversionMissingProductCode,
    leftoverInversionInvoiceNumber,
    leftoverInversionAllocations,
    leftoverInversionAllocatedQty,
    leftoverInversionRemainingQty,
  ]);
  const leftoverTypeOptions = useMemo(() => {
    const productTypes = products.map((product) => String(product.type || '').trim().toUpperCase()).filter(Boolean);
    return Array.from(new Set([...productTypes, ...DEFAULT_RETURN_UNIT_TYPES]));
  }, [products]);
  const productTypeByCode = useMemo(() => products.reduce((acc, product) => {
    const normalizedCode = String(product.code || '').trim().toUpperCase();
    const normalizedType = normalizeProductType(product.type);

    if (normalizedCode && normalizedType) {
      acc[normalizedCode] = normalizedType;
    }

    return acc;
  }, {} as Record<string, string>), [products]);
  const fillMissingTypeForPdf = (items: IInvoiceReturnItem[]) => items.map((item) => {
    const directType = normalizeProductType(item.product_type);
    if (directType) {
      return { ...item, product_type: directType };
    }

    const catalogType = productTypeByCode[String(item.product_id || '').trim().toUpperCase()];
    return { ...item, product_type: catalogType || 'UN' };
  });
  const getReturnTypeLabel = (value: ReturnType) => {
    if (value === 'total') return 'Total';
    if (value === 'partial') return 'Parcial';
    if (value === 'coleta') return 'Coleta';
    if (value === 'weight_break') return 'Quebra de peso';
    return 'Sobra';
  };
  const getNoteDisplayLabel = (note: {
    invoice_number: string;
    return_type: ReturnType;
    items?: IInvoiceReturnItem[];
    load_number?: string | null;
  }) => {
    if (note.return_type === 'sobra') {
      const surplusProductCode = String(note.items?.[0]?.product_id || '').trim().toUpperCase();
      const loadNumber = String(note.load_number || '').trim();
      const baseLabel = surplusProductCode
        ? `Sobra ${surplusProductCode}`
        : note.invoice_number.replace(/^SOBRA-/, 'Sobra ');
      return loadNumber ? `${baseLabel} (Carga ${loadNumber})` : baseLabel;
    }

    return `NF ${note.invoice_number}`;
  };
  const getNoteInversionSummary = (note: {
    return_type: ReturnType;
    is_inversion?: boolean;
    inversion?: { invoice_number: string | null; missing_product_code: string | null } | null;
    inversion_invoice_number?: string | null;
    inversion_missing_product_code?: string | null;
    items?: IInvoiceReturnItem[];
  }) => {
    if (note.return_type !== 'sobra' || !note.is_inversion) {
      return '';
    }

    const inversionInvoice = String(note.inversion?.invoice_number || note.inversion_invoice_number || '').trim();
    const missingProductCode = String(note.inversion?.missing_product_code || note.inversion_missing_product_code || '').trim().toUpperCase();
    const surplusProductCode = String(note.items?.[0]?.product_id || '').trim().toUpperCase();

    if (!inversionInvoice || !missingProductCode) {
      return 'Inversao cadastrada';
    }

    return `Inversao: Veio ${surplusProductCode || '-'} (sobra) no lugar de ${missingProductCode} (falta) na NF ${inversionInvoice}`;
  };
  const serializeReturnNotePayload = (note: {
    invoice_number: string;
    return_type: ReturnType;
    load_number?: string | null;
    is_inversion?: boolean;
    inversion?: { invoice_number: string | null; missing_product_code: string | null } | null;
    inversion_invoice_number?: string | null;
    inversion_missing_product_code?: string | null;
    items: IInvoiceReturnItem[];
  }) => {
    const payload = {
      invoice_number: note.invoice_number,
      return_type: note.return_type,
      load_number: note.load_number || null,
      is_inversion: Boolean(note.is_inversion),
      items: note.items,
    } as {
      invoice_number: string;
      return_type: ReturnType;
      load_number: string | null;
      is_inversion: boolean;
      items: IInvoiceReturnItem[];
      inversion?: {
        invoice_number: string;
        missing_product_code: string;
      };
    };

    if (payload.is_inversion) {
      const inversionInvoice = String(note.inversion?.invoice_number || note.inversion_invoice_number || '').trim();
      const missingProductCode = String(note.inversion?.missing_product_code || note.inversion_missing_product_code || '').trim().toUpperCase();
      if (inversionInvoice && missingProductCode) {
        payload.inversion = {
          invoice_number: inversionInvoice,
          missing_product_code: missingProductCode,
        };
      }
    }

    return payload;
  };
  const occurrenceProducts = useMemo(() => occurrenceDanfe?.DanfeProducts || [], [occurrenceDanfe]);
  const selectedOccurrenceProduct = useMemo(() => (
    occurrenceProducts.find((item) => item.Product.code === occurrenceProductCode) || null
  ), [occurrenceProducts, occurrenceProductCode]);
  const occurrenceTypeOptions = useMemo(() => {
    const productType = normalizeProductType(selectedOccurrenceProduct?.type || selectedOccurrenceProduct?.Product.type);
    return Array.from(new Set([productType, ...DEFAULT_RETURN_UNIT_TYPES].filter(Boolean)));
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

  useEffect(() => {
    if (!partialProductCode || !selectedPartialDanfeProduct) {
      setPartialProductType('');
      setPartialIsMissing(false);
      setPartialKeepInStock(false);
      setPartialStockDefault(false);
      return;
    }

    const defaultType = normalizeProductType(selectedPartialDanfeProduct.type)
      || normalizeProductType(selectedPartialDanfeProduct.Product.type)
      || DEFAULT_RETURN_UNIT_TYPES[0];

    setPartialProductType(defaultType);
    const stockDefault = Boolean(selectedPartialDanfeProduct.Product.return_to_stock_default);
    setPartialIsMissing(false);
    setPartialKeepInStock(stockDefault);
    setPartialStockDefault(stockDefault);
  }, [partialProductCode, selectedPartialDanfeProduct]);

  useEffect(() => {
    if (!partialProductCode || !partialProductType) {
      setPartialQuantityInput('1');
      return;
    }

    const isKgType = normalizeProductType(partialProductType).includes('KG');
    if (!isKgType) {
      setPartialQuantityInput('1');
      return;
    }

    const suggestedQty = normalizeQtyByType(selectedPartialRemainingQty, true);
    if (suggestedQty > QUANTITY_EPSILON) {
      setPartialQuantityInput(formatKgInputValue(suggestedQty));
      return;
    }

    setPartialQuantityInput(String(KG_QUANTITY_MIN));
  }, [partialProductCode, partialProductType, selectedPartialRemainingQty]);

  useEffect(() => {
    if (!occurrenceProductCode || !selectedOccurrenceProduct || isOccurrenceTotal) {
      setOccurrenceProductType('');
      setOccurrenceQuantityInput('1');
      return;
    }

    const defaultType = normalizeProductType(selectedOccurrenceProduct.type || selectedOccurrenceProduct.Product.type)
      || DEFAULT_RETURN_UNIT_TYPES[0];
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

  useEffect(() => {
    if (!leftoverProductCode) {
      setLeftoverProductType('');
      return;
    }

    if (selectedLeftoverProduct?.type) {
      setLeftoverProductType(String(selectedLeftoverProduct.type).toUpperCase());
    }
  }, [leftoverProductCode, selectedLeftoverProduct]);

  useEffect(() => {
    if (leftoverIsInversion) {
      return;
    }

    setLeftoverInversionInvoiceNumber('');
    setLeftoverInversionMissingProductCode('');
    setLeftoverInversionQuantityInput('');
    setLeftoverInversionDanfe(null);
    setLeftoverInversionLookupError('');
    setLeftoverInversionLookupLoading(false);
    setLeftoverInversionAllocations([]);
  }, [leftoverIsInversion]);

  useEffect(() => {
    if (!leftoverIsInversion) return;
    if (leftoverInversionAllocations.length) return;
    if (leftoverInversionQuantityInput.trim()) return;
    if (parsedLeftoverTotalQty <= QUANTITY_EPSILON) return;

    setLeftoverInversionQuantityInput(formatKgInputValue(parsedLeftoverTotalQty));
  }, [
    leftoverIsInversion,
    leftoverInversionAllocations.length,
    leftoverInversionQuantityInput,
    parsedLeftoverTotalQty,
  ]);

  useEffect(() => {
    if (!leftoverIsInversion) {
      return;
    }

    const normalizedInputInvoice = leftoverInversionInvoiceNumber.trim();
    const loadedInvoice = String(leftoverInversionDanfe?.invoice_number || '').trim();
    if (!normalizedInputInvoice || !loadedInvoice || loadedInvoice !== normalizedInputInvoice) {
      setLeftoverInversionDanfe(null);
      setLeftoverInversionMissingProductCode('');
      setLeftoverInversionLookupError('');
    }
  }, [leftoverIsInversion, leftoverInversionInvoiceNumber, leftoverInversionDanfe?.invoice_number]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedPermission = localStorage.getItem('user_permission') || '';
    setUserPermission(storedPermission);

    const validateAndLoad = async () => {
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
      const notificationInvoiceNumber = String(searchParams.get('nf') || '').trim();
      const requestedBatchCode = String(searchParams.get('batch') || '').trim();
      await Promise.all([
        loadDrivers(),
        loadCars(),
        loadProducts(),
        loadOccurrences(),
        requestedBatchCode
          ? loadReturnBatchesByBatchCode(requestedBatchCode)
          : notificationInvoiceNumber
            ? loadReturnBatchesByInvoiceNumber(notificationInvoiceNumber)
            : loadReturnBatches(),
      ]);
      try {
        const registryOverview = await getReturnDataOverview();
        setReturnDataLastUpdate(registryOverview?.latest_import?.imported_at || null);
      } catch (registryError) {
        console.error('Erro ao consultar atualização da base de devoluções:', registryError);
      }
    };

    validateAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab !== 'occurrences') return;

    const timer = window.setTimeout(() => {
      loadOccurrences();
    }, 280);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, occurrenceStatusFilter, occurrenceNfFilter, occurrenceStartDate, occurrenceEndDate, userPermission]);

  async function loadDrivers() {
    try {
      const { data } = await axios.get(`${API_URL}/drivers`);
      setDrivers(data);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
    }
  }

  async function loadCars() {
    try {
      const { data } = await axios.get(`${API_URL}/cars`);
      setCars(data);
    } catch (error) {
      console.error('Erro ao carregar veiculos:', error);
    }
  }

  function selectReturnCar(carId: string) {
    const option = returnCarOptions.find((item) => item.id === carId);
    returnVehicleSuggestionRequestRef.current += 1;
    setIsReturnVehicleSuggestionLoading(false);
    setReturnVehicleSuggestionMessage('');
    setSelectedCarId(option ? carId : '');
    setReturnCarInput(option?.value || '');
    setIsReturnCarSuggestionsOpen(false);
  }

  function selectReturnDriver(driverId: string) {
    const option = returnDriverOptions.find((item) => item.id === driverId);
    returnVehicleSuggestionRequestRef.current += 1;
    setIsReturnVehicleSuggestionLoading(false);
    setReturnVehicleSuggestionMessage('');
    setReturnDriverId(option ? driverId : '');
    setReturnDriverInput(option?.value || '');
    setIsReturnDriverSuggestionsOpen(false);
    setSelectedCarId('');
    setReturnCarInput('');

    if (!option) return;

    const requestId = returnVehicleSuggestionRequestRef.current;
    setIsReturnVehicleSuggestionLoading(true);
    void axios.get<VehicleSuggestionResponse>(`${API_URL}/trips/suggestions/vehicle/${driverId}`)
      .then(({ data }) => {
        if (returnVehicleSuggestionRequestRef.current !== requestId) return;
        const suggestion = data?.suggestion;
        if (!suggestion?.car?.id) {
          setReturnVehicleSuggestionMessage('Nenhum veículo habitual encontrado. Selecione a placa manualmente.');
          return;
        }

        const suggestedCarId = String(suggestion.car.id);
        const matchingCar = cars.find((car) => String(car.id) === suggestedCarId) || suggestion.car;
        setSelectedCarId(suggestedCarId);
        setReturnCarInput(`${matchingCar.model} - ${matchingCar.license_plate}`);
        setReturnVehicleSuggestionMessage(
          `Veículo habitual preenchido pelo histórico (${suggestion.usageCount} de ${suggestion.sampleSize} viagem(ns) recentes).`,
        );
      })
      .catch(() => {
        if (returnVehicleSuggestionRequestRef.current === requestId) {
          setReturnVehicleSuggestionMessage('Não foi possível consultar o histórico. Selecione a placa manualmente.');
        }
      })
      .finally(() => {
        if (returnVehicleSuggestionRequestRef.current === requestId) {
          setIsReturnVehicleSuggestionLoading(false);
        }
      });
  }

  function commitReturnDriverInput(rawValue: string, preferFirst = false) {
    const normalized = normalizeAssignmentSearch(rawValue);
    const exact = returnDriverOptions.find((option) => normalizeAssignmentSearch(option.value) === normalized);
    const fallback = preferFirst
      ? returnDriverOptions.find((option) => normalizeAssignmentSearch(option.value).includes(normalized))
      : undefined;
    const selected = exact || fallback;
    if (!normalized || !selected) {
      if (preferFirst) selectReturnDriver('');
      return false;
    }
    selectReturnDriver(selected.id);
    return true;
  }

  function commitReturnCarInput(rawValue: string, preferFirst = false) {
    const normalized = normalizeAssignmentSearch(rawValue);
    const exact = returnCarOptions.find((option) => normalizeAssignmentSearch(option.value) === normalized);
    const fallback = preferFirst
      ? returnCarOptions.find((option) => normalizeAssignmentSearch(option.value).includes(normalized))
      : undefined;
    const selected = exact || fallback;
    if (!normalized || !selected) {
      if (preferFirst) selectReturnCar('');
      return false;
    }
    selectReturnCar(selected.id);
    return true;
  }

  async function loadProducts() {
    try {
      const { data } = await axios.get(`${API_URL}/products`);
      setProducts(data);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  }

  async function updateProductStockDefault(productCode: string, enabled: boolean) {
    try {
      await axios.patch(`${API_URL}/products/${encodeURIComponent(productCode)}/return-stock-default`, {
        return_to_stock_default: enabled,
      });
      setProducts((previous) => previous.map((product) => (
        product.code === productCode
          ? { ...product, return_to_stock_default: enabled }
          : product
      )));
      setReturnDanfe((previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          DanfeProducts: previous.DanfeProducts.map((item) => (
            item.Product.code === productCode
              ? {
                ...item,
                Product: {
                  ...item.Product,
                  return_to_stock_default: enabled,
                },
              }
              : item
          )),
        };
      });
    } catch (error) {
      console.error('Erro ao salvar destino padrao do produto:', error);
      alert('O item foi adicionado, mas nao foi possivel salvar o destino padrao para as proximas devolucoes.');
    }
  }

  async function loadReturnBatches(lookbackDaysOverride?: ReturnBatchLookbackValue | number) {
    try {
      setBatchSearchFeedback('');
      const selectedLookbackRaw = lookbackDaysOverride ?? batchLookbackDays;
      const selectedLookback = Number(selectedLookbackRaw);
      const { startDate, endDate } = getBatchRangeByLookback(selectedLookback);
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);

      const { data } = await axios.get(`${API_URL}/returns/batches/search?${params.toString()}`);
      setReturnBatches(data);

      if (selectedBatchCode) {
        const stillExists = data.some((batch: IReturnBatch) => batch.batch_code === selectedBatchCode);
        if (!stillExists) {
          setSelectedBatchCode('');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar lotes de devolucao:', error);
    }
  }

  async function loadReturnBatchesByInvoiceNumber(invoiceNumber: string) {
    try {
      const normalizedInvoiceNumber = String(invoiceNumber || '').trim();
      if (!normalizedInvoiceNumber) return;

      const { data } = await axios.get(`${API_URL}/returns/batches/search`, {
        params: { invoice_number: normalizedInvoiceNumber, workflow_status: 'all' },
      });
      const batches = Array.isArray(data) ? data : [];
      setReturnBatches(batches);

      const requestedBatchCode = String(searchParams.get('batch') || '').trim();
      const selectedCode = batches.find((batch: IReturnBatch) => batch.batch_code === requestedBatchCode)?.batch_code
        || batches[0]?.batch_code
        || '';
      setSelectedBatchCode(selectedCode);
      setReturnModalOpen(Boolean(selectedCode));
    } catch (error) {
      console.error('Erro ao localizar lote de devolucao pela NF:', error);
    }
  }

  async function loadReturnBatchesByBatchCode(batchCode: string) {
    try {
      const normalizedBatchCode = String(batchCode || '').trim();
      if (!normalizedBatchCode) return;

      const { data } = await axios.get(`${API_URL}/returns/batches/search`, {
        params: { batch_code: normalizedBatchCode, workflow_status: 'all' },
      });
      const batches = Array.isArray(data) ? data : [];
      setReturnBatches(batches);
      setSelectedBatchCode(batches[0]?.batch_code || '');
      setReturnModalOpen(batches.length > 0);
      setBatchCodeFilter(normalizedBatchCode);
      setBatchSearchFeedback(batches.length
        ? `Lote ${batches[0].batch_code} localizado.`
        : `Nenhum lote encontrado com o ID ${normalizedBatchCode}.`);
    } catch (error) {
      console.error('Erro ao localizar lote de devolucao pelo ID:', error);
      setBatchSearchFeedback('Nao foi possivel pesquisar o lote agora.');
    }
  }

  async function handleSearchBatchByCode() {
    const normalizedBatchCode = batchCodeFilter.trim();
    if (!normalizedBatchCode) {
      setBatchSearchFeedback('Digite o ID do lote para pesquisar.');
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set('tab', 'returns');
    next.set('batch', normalizedBatchCode);
    next.delete('nf');
    setSearchParams(next, { replace: true });
    setActiveTab('returns');
    await loadReturnBatchesByBatchCode(normalizedBatchCode);
  }

  async function handleSearchBatchesByPeriod() {
    if (!batchStartDate || !batchEndDate) {
      alert('Informe a data inicial e a data final para pesquisar os lotes.');
      return;
    }
    if (batchStartDate > batchEndDate) {
      alert('A data inicial deve ser anterior ou igual à data final.');
      return;
    }

    try {
      setBatchSearchFeedback('');
      const { data } = await axios.get(`${API_URL}/returns/batches/search`, {
        params: { startDate: batchStartDate, endDate: batchEndDate },
      });
      setReturnBatches(Array.isArray(data) ? data : []);
      setSelectedBatchCode('');
    } catch (error) {
      console.error('Erro ao pesquisar lotes de devolucao por periodo:', error);
    }
  }

  async function handleLoadLatestBatches() {
    await loadReturnBatches(batchLookbackDays);
  }

  function handleOpenDatePicker(event: ReactMouseEvent<HTMLInputElement>) {
    try {
      event.currentTarget.showPicker?.();
    } catch (error) {
      // Alguns navegadores bloqueiam showPicker fora de uma interacao direta.
    }
  }

  async function loadOccurrences() {
    try {
      const params = new URLSearchParams();
      const effectiveWorkflowStatus: OccurrenceWorkflowFilter = isControlTowerUser
        ? 'awaiting_control_tower'
        : occurrenceStatusFilter;

      if (effectiveWorkflowStatus !== 'all') {
        params.append('workflow_status', effectiveWorkflowStatus);
      }

      if (occurrenceNfFilter.trim()) {
        params.append('invoice_number', occurrenceNfFilter.trim());
      }

      if (occurrenceStartDate && occurrenceEndDate) {
        params.append('startDate', occurrenceStartDate);
        params.append('endDate', occurrenceEndDate);
      }

      const { data } = await axios.get(`${API_URL}/occurrences/search?${params.toString()}`);
      setOccurrences(data);
    } catch (error) {
      console.error('Erro ao carregar ocorrencias:', error);
    }
  }

  async function findDanfeByNf(nf: string) {
    const { data } = await axios.get(`${API_URL}/danfes/nf/${nf}`);
    return sanitizeDanfeTextFields(data);
  }

  async function hasActionQueueCollectionForInvoice(invoiceNumber: string) {
    const normalizedInvoice = String(invoiceNumber || '').trim();
    if (!normalizedInvoice) return false;

    const params = new URLSearchParams();
    params.append('invoice_number', normalizedInvoice);
    params.append('limit', '50');

    const { data } = await axios.get<ICollectionRequest[]>(`${API_URL}/collection-requests/action-queue?${params.toString()}`);
    const rows = Array.isArray(data) ? data : [];
    return rows.some((row) => String(row.invoice_number || '').trim() === normalizedInvoice);
  }

  function resetSurplusInversionBuilder() {
    setLeftoverIsInversion(false);
    setLeftoverInversionInvoiceNumber('');
    setLeftoverInversionMissingProductCode('');
    setLeftoverInversionQuantityInput('');
    setLeftoverInversionDanfe(null);
    setLeftoverInversionLookupError('');
    setLeftoverInversionLookupLoading(false);
    setLeftoverInversionAllocations([]);
  }

  const approvedRegistryReturnTypes = useMemo(
    () => getApprovedRegistryReturnTypes(returnDataLookup),
    [returnDataLookup],
  );
  const suggestedRegistryReturnType = approvedRegistryReturnTypes.length === 1
    ? approvedRegistryReturnTypes[0]
    : null;
  const returnTypeDivergenceKey = suggestedRegistryReturnType && returnDanfe
    ? `${returnDanfe.invoice_number}:${suggestedRegistryReturnType}:${returnType}`
    : '';
  const hasReturnTypeDivergence = Boolean(
    suggestedRegistryReturnType
    && returnType !== 'sobra'
    && returnType !== suggestedRegistryReturnType,
  );
  const isReturnTypeDivergenceAcknowledged = Boolean(
    hasReturnTypeDivergence
    && returnTypeDivergenceAcknowledged === returnTypeDivergenceKey,
  );

  function applyReturnType(nextType: ReturnType) {
    setReturnType(nextType);

    if (nextType === 'sobra') {
      setReturnDanfe(null);
      setIsReturnNfCollection(false);
      setReturnNfCollectionLookupLoading(false);
      setPartialItems([]);
      setPartialProductCode('');
      setPartialProductType('');
      setPartialQuantityInput('1');
      return;
    }

    if (nextType === 'total' && returnDanfe) {
      setPartialItems(returnDanfe.DanfeProducts.map((item) => ({
        product_id: item.Product.code,
        product_description: item.Product.description,
        product_type: normalizeProductType(item.type) || normalizeProductType(item.Product.type) || null,
        quantity: Number(item.quantity),
        is_missing: false,
        keep_in_stock: Boolean(item.Product.return_to_stock_default),
      })));
    } else if (nextType !== 'total') {
      setPartialItems([]);
    }

    setLeftoverProductCode('');
    setLeftoverQuantityInput('1');
    setLeftoverProductType('');
    setLeftoverLoadNumber('');
    resetSurplusInversionBuilder();
  }

  async function handleChangeReturnType(nextType: ReturnType) {
    if (
      isReturnNfCollection
      && returnDanfe
      && (nextType === 'total' || nextType === 'partial' || nextType === 'weight_break')
    ) {
      alert('Esta NF possui coleta solicitada pela Mar e Rio. O tipo foi travado automaticamente como Coleta.');
      return;
    }

    if (
      nextType !== 'sobra'
      && suggestedRegistryReturnType
      && nextType !== suggestedRegistryReturnType
      && returnDanfe
    ) {
      const divergenceKey = `${returnDanfe.invoice_number}:${suggestedRegistryReturnType}:${nextType}`;
      const confirmed = await showConfirm(
        `A base de devoluções classifica esta NF como ${getRegistryTypeLabel(suggestedRegistryReturnType)}, `
        + `mas você selecionou ${getRegistryTypeLabel(nextType)}.\n\n`
        + 'A base pode estar incorreta, mas esta escolha ficará divergente. Deseja continuar mesmo assim?',
        {
          title: 'Confirmar divergência de tipo',
          confirmLabel: 'Sim, usar tipo diferente',
          cancelLabel: 'Manter tipo da base',
        },
      );
      if (!confirmed) return;
      setReturnTypeDivergenceAcknowledged(divergenceKey);
    } else {
      setReturnTypeDivergenceAcknowledged('');
    }

    applyReturnType(nextType);
  }

  async function handleSearchSurplusInversionNf() {
    const normalizedInvoice = leftoverInversionInvoiceNumber.trim();
    if (!normalizedInvoice) {
      setLeftoverInversionLookupError('Informe a NF relacionada para a inversao.');
      return;
    }

    setLeftoverInversionLookupLoading(true);
    setLeftoverInversionLookupError('');
    try {
      const data = await findDanfeByNf(normalizedInvoice);
      if (!data) {
        setLeftoverInversionDanfe(null);
        setLeftoverInversionMissingProductCode('');
        setLeftoverInversionLookupError('NF relacionada nao encontrada.');
        return;
      }

      setLeftoverInversionDanfe(data);
      setLeftoverInversionMissingProductCode((previous) => {
        if (!previous) return previous;
        const stillExists = (data.DanfeProducts || []).some((item: IDanfe['DanfeProducts'][number]) => item.Product.code === previous);
        return stillExists ? previous : '';
      });
    } catch (error) {
      console.error(error);
      setLeftoverInversionDanfe(null);
      setLeftoverInversionMissingProductCode('');
      setLeftoverInversionLookupError('Erro ao buscar NF relacionada.');
    } finally {
      setLeftoverInversionLookupLoading(false);
    }
  }

  function addSurplusInversionAllocation() {
    if (!leftoverIsInversion) return;

    if (parsedLeftoverTotalQty <= QUANTITY_EPSILON) {
      alert('Informe a quantidade total da sobra antes de distribuir por NF.');
      return;
    }

    const relatedInvoice = leftoverInversionInvoiceNumber.trim();
    if (!relatedInvoice) {
      alert('Informe a NF relacionada da inversao.');
      return;
    }

    if (!leftoverInversionDanfe || String(leftoverInversionDanfe.invoice_number) !== relatedInvoice) {
      alert('Busque a NF relacionada para validar os itens da inversao.');
      return;
    }

    const missingProductCode = leftoverInversionMissingProductCode.trim().toUpperCase();
    if (!missingProductCode) {
      alert('Informe o produto que faltou na NF relacionada.');
      return;
    }

    const belongsToInvoice = leftoverInversionDanfe.DanfeProducts.some((item) => item.Product.code === missingProductCode);
    if (!belongsToInvoice) {
      alert('Produto faltante nao pertence a NF relacionada.');
      return;
    }

    const rawAllocationQty = String(leftoverInversionQuantityInput || '').trim();
    if (!rawAllocationQty) {
      alert('Informe a quantidade para a NF relacionada.');
      return;
    }

    const parsedAllocationQty = Number(normalizeDecimalInput(rawAllocationQty));
    if (!Number.isFinite(parsedAllocationQty) || parsedAllocationQty <= 0) {
      alert('Informe uma quantidade valida para a NF relacionada.');
      return;
    }

    const normalizedAllocationQty = normalizeQtyByType(parsedAllocationQty, true);
    const nextDistributedQty = normalizeQtyByType(leftoverInversionAllocatedQty + normalizedAllocationQty, true);
    if (nextDistributedQty - parsedLeftoverTotalQty > QUANTITY_EPSILON) {
      alert(`Quantidade distribuida excede a sobra. Restante disponivel: ${formatKgInputValue(leftoverInversionRemainingQty)}.`);
      return;
    }

    setLeftoverInversionAllocations((previous) => {
      const allocationIndex = previous.findIndex((item) => (
        item.invoice_number === relatedInvoice
        && item.missing_product_code === missingProductCode
      ));

      if (allocationIndex === -1) {
        return [
          ...previous,
          {
            invoice_number: relatedInvoice,
            missing_product_code: missingProductCode,
            quantity: normalizedAllocationQty,
          },
        ];
      }

      return previous.map((item, index) => (
        index === allocationIndex
          ? { ...item, quantity: normalizeQtyByType(Number(item.quantity || 0) + normalizedAllocationQty, true) }
          : item
      ));
    });

    const nextRemainingQty = Math.max(0, normalizeQtyByType(parsedLeftoverTotalQty - nextDistributedQty, true));
    setLeftoverInversionQuantityInput(nextRemainingQty > QUANTITY_EPSILON ? formatKgInputValue(nextRemainingQty) : '');
    setLeftoverInversionInvoiceNumber('');
    setLeftoverInversionMissingProductCode('');
    setLeftoverInversionDanfe(null);
    setLeftoverInversionLookupError('');
  }

  function removeSurplusInversionAllocation(indexToRemove: number) {
    setLeftoverInversionAllocations((previous) => previous.filter((_, index) => index !== indexToRemove));
  }

  async function handleSearchReturnNf() {
    if (returnType === 'sobra') {
      alert('Para sobra, informe codigo, quantidade e tipo do produto.');
      return;
    }

    if (!returnNf.trim()) {
      alert('Digite a NF para buscar.');
      return;
    }

    setReturnNfCollectionLookupLoading(true);
    try {
      const data = await findDanfeByNf(returnNf.trim());

      if (!data) {
        setIsReturnNfCollection(false);
        alert('NF nao encontrada.');
        return;
      }

      setReturnDanfe(data);
      setPartialItems(data.DanfeProducts.map((item: IDanfe['DanfeProducts'][number]) => ({
        product_id: item.Product.code,
        product_description: item.Product.description,
        product_type: normalizeProductType(item.type) || normalizeProductType(item.Product.type) || null,
        quantity: Number(item.quantity),
        is_missing: false,
        keep_in_stock: Boolean(item.Product.return_to_stock_default),
      })));
      setPartialProductCode('');
      setPartialProductType('');
      setPartialQuantityInput('1');

      const normalizedInvoice = String(data.invoice_number || returnNf.trim()).trim();
      const registryLookup = await loadReturnRegistryLookup(normalizedInvoice);
      const registryTypes = getApprovedRegistryReturnTypes(registryLookup);
      const suggestedType = registryTypes.length === 1 ? registryTypes[0] : null;
      setReturnTypeDivergenceAcknowledged('');
      if (suggestedType && suggestedType !== 'sobra') {
        applyReturnType(suggestedType);
      }
      try {
        const isCollectionInvoice = await hasActionQueueCollectionForInvoice(normalizedInvoice);
        setIsReturnNfCollection(isCollectionInvoice);
        if (isCollectionInvoice) {
          setReturnType('coleta');
          setPartialItems([]);
        }
      } catch (collectionError) {
        console.error('Erro ao verificar coleta solicitada para NF:', collectionError);
        setIsReturnNfCollection(false);
      }
    } catch (error) {
      console.error(error);
      setIsReturnNfCollection(false);
      alert('Erro ao buscar NF para devolucao.');
    } finally {
      setReturnNfCollectionLookupLoading(false);
    }
  }

  async function loadReturnRegistryLookup(invoiceNumber: string) {
    setReturnDataLookupLoading(true);
    setReturnDataLookupError('');
    setReturnDataLookup(null);
    setShowReturnDataDetails(false);
    try {
      const lookup = await getReturnDataByInvoice(invoiceNumber);
      if (!lookup || !Array.isArray(lookup.occurrences)) {
        throw new Error('Resposta inválida da base de devoluções.');
      }
      setReturnDataLookup(lookup);
      setReturnDataLastUpdate(lookup.latest_base_update || returnDataLastUpdate);
      return lookup;
    } catch (error) {
      if (handleAuthenticationError(error)) return null;
      setReturnDataLookupError('Não foi possível consultar esta NF na base de devoluções. O lote pode continuar normalmente.');
      return null;
    } finally {
      setReturnDataLookupLoading(false);
    }
  }

  function addPartialItem() {
    if (!returnDanfe) {
      alert('Busque uma NF primeiro.');
      return;
    }

    if (!partialProductCode) {
      alert('Selecione um produto.');
      return;
    }

    if (!partialProductType) {
      alert('Selecione o tipo da devolucao (CX, PCT, KG, UN).');
      return;
    }

    const rawPartialQuantity = String(partialQuantityInput || '').trim();
    if (!rawPartialQuantity) {
      alert('Digite uma quantidade valida.');
      return;
    }

    const parsedPartialQuantity = Number(normalizeDecimalInput(rawPartialQuantity));
    if (!Number.isFinite(parsedPartialQuantity) || parsedPartialQuantity <= 0) {
      alert('Digite uma quantidade valida.');
      return;
    }

    const foundProduct = returnDanfe.DanfeProducts.find((item) => item.Product.code === partialProductCode);
    if (!foundProduct) {
      alert('Produto nao encontrado na NF.');
      return;
    }

    const normalizedType = normalizeProductType(partialProductType);
    const isKg = normalizedType.includes('KG');
    const minAllowed = isKg ? KG_QUANTITY_MIN : 1;
    const maxAllowed = getDanfeProductQuantityLimitByType(foundProduct, normalizedType);
    const existingQty = partialItems
      .filter((item) => (
        item.product_id === foundProduct.Product.code
        && normalizeProductType(item.product_type) === normalizedType
      ))
      .reduce((sum, item) => sum + Number(item.quantity), 0);

    if (!isKg && !Number.isInteger(parsedPartialQuantity)) {
      alert('Para este produto, use apenas quantidades inteiras.');
      return;
    }

    const normalizedQuantity = normalizeQtyByType(parsedPartialQuantity, isKg);

    if (normalizedQuantity < minAllowed) {
      alert(`Quantidade minima permitida para este produto: ${minAllowed}.`);
      return;
    }

    if ((normalizedQuantity + existingQty) - maxAllowed > QUANTITY_EPSILON) {
      const remaining = Math.max(0, maxAllowed - existingQty);
      alert(`Quantidade excede o limite da NF, de: ${remaining}.`);
      return;
    }

    setPartialItems((previous) => {
      const existingItem = previous.find((item) => (
        item.product_id === foundProduct.Product.code
        && normalizeProductType(item.product_type) === normalizedType
        && Boolean(item.is_missing) === partialIsMissing
        && Boolean(item.keep_in_stock) === (partialIsMissing ? false : partialKeepInStock)
      ));
      if (!existingItem) {
        return [
          ...previous,
          {
            product_id: foundProduct.Product.code,
            product_description: foundProduct.Product.description,
            product_type: normalizedType,
            quantity: normalizedQuantity,
            is_missing: partialIsMissing,
            keep_in_stock: partialIsMissing ? false : partialKeepInStock,
          },
        ];
      }

      return previous.map((item) => (
        item.product_id === foundProduct.Product.code
          && normalizeProductType(item.product_type) === normalizedType
          && Boolean(item.is_missing) === partialIsMissing
          && Boolean(item.keep_in_stock) === (partialIsMissing ? false : partialKeepInStock)
          ? { ...item, quantity: Number(item.quantity) + normalizedQuantity }
          : item
      ));
    });

    setPartialQuantityInput(String(minAllowed));
    if (partialStockDefault !== Boolean(foundProduct.Product.return_to_stock_default)) {
      void updateProductStockDefault(foundProduct.Product.code, partialStockDefault);
    }
  }

  function removePartialItem(indexToRemove: number) {
    setPartialItems((previous) => previous.filter((_, index) => index !== indexToRemove));
  }

  function updateReturnItemHandling(indexToUpdate: number, field: 'is_missing' | 'keep_in_stock', enabled: boolean) {
    setPartialItems((previous) => previous.map((item, index) => {
      if (index !== indexToUpdate) return item;
      if (field === 'is_missing') {
        return {
          ...item,
          is_missing: enabled,
          keep_in_stock: enabled ? false : Boolean(item.keep_in_stock),
        };
      }
      return {
        ...item,
        keep_in_stock: enabled,
        is_missing: enabled ? false : Boolean(item.is_missing),
      };
    }));
  }

  function getCurrentNoteItems() {
    if (returnType === 'sobra') {
      const normalizedCode = leftoverProductCode.trim().toUpperCase();
      const normalizedType = leftoverProductType.trim().toUpperCase();

      if (!normalizedCode) {
        alert('Informe o codigo do produto da sobra.');
        return [];
      }

      const rawLeftoverQuantity = String(leftoverQuantityInput || '').trim();
      if (!rawLeftoverQuantity) {
        alert('Informe uma quantidade valida para sobra.');
        return [];
      }

      const parsedLeftoverQuantity = Number(normalizeDecimalInput(rawLeftoverQuantity));
      if (!Number.isFinite(parsedLeftoverQuantity) || parsedLeftoverQuantity <= 0) {
        alert('Informe uma quantidade valida para sobra.');
        return [];
      }

      if (!normalizedType) {
        alert('Selecione o tipo do produto da sobra.');
        return [];
      }

      return [{
        product_id: normalizedCode,
        product_description: selectedLeftoverProduct?.description || `Sobra de produto ${normalizedCode}`,
        product_type: normalizedType,
        quantity: Math.round(parsedLeftoverQuantity * 1000) / 1000,
      }];
    }

    if (!returnDanfe) {
      return [];
    }

    if (returnType === 'total') {
      return partialItems.length
        ? groupItemsByProductAndType(partialItems)
        : returnDanfe.DanfeProducts.map((item) => ({
          product_id: item.Product.code,
          product_description: item.Product.description,
          product_type: normalizeProductType(item.type) || normalizeProductType(item.Product.type) || null,
          quantity: Number(item.quantity),
          is_missing: false,
          keep_in_stock: Boolean(item.Product.return_to_stock_default),
        }));
    }

    return groupItemsByProductAndType(partialItems);
  }

  function ensureSelectedBatchEditable() {
    if (!selectedBatch) return true;
    if (isSelectedBatchEditableByTransportadora) return true;

    alert('Este lote ja foi confirmado como enviado e nao pode mais ser editado.');
    return false;
  }

  async function handleAddNf() {
    if (selectedBatch && !ensureSelectedBatchEditable()) {
      return;
    }

    const effectiveReturnType = isReturnNfCollection ? 'coleta' : returnType;

    if (effectiveReturnType !== 'sobra' && !returnDanfe) {
      alert('Busque uma NF para adicionar na lista.');
      return;
    }

    if (effectiveReturnType !== 'sobra' && returnDataLookup?.consolidated_status === 'approved') {
      const registeredTypes = getApprovedRegistryReturnTypes(returnDataLookup);
      if (registeredTypes.length && !registeredTypes.includes(effectiveReturnType)) {
        const divergenceKey = `${returnDanfe?.invoice_number}:${registeredTypes.join(',')}:${effectiveReturnType}`;
        const confirmed = returnTypeDivergenceAcknowledged === divergenceKey || await showConfirm(
          `A base de devoluções classifica esta NF como ${registeredTypes.map(getReturnTypeLabel).join(' ou ')}, `
          + `mas você selecionou ${getReturnTypeLabel(effectiveReturnType)}.\n\n`
          + 'A base pode estar incorreta. Confirma que deseja adicionar a NF com o tipo divergente?',
          {
            title: 'Divergência com a base de devoluções',
            confirmLabel: 'Confirmar tipo diferente',
            cancelLabel: 'Revisar preenchimento',
          },
        );
        if (!confirmed) return;
        setReturnTypeDivergenceAcknowledged(divergenceKey);
      }
    }

    const noteItems = getCurrentNoteItems();
    if (!noteItems.length) {
      if (effectiveReturnType === 'partial' || effectiveReturnType === 'coleta' || effectiveReturnType === 'weight_break') {
        const typeLabel = effectiveReturnType === 'coleta'
          ? 'de coleta'
          : effectiveReturnType === 'weight_break'
            ? 'de quebra de peso'
            : 'parcial';
        alert(`Adicione ao menos um item na devolucao ${typeLabel}.`);
      }
      return;
    }

    let notesToCreate: ReturnDraftNote[] = [];

    if (effectiveReturnType === 'sobra') {
      const normalizedLoadNumber = leftoverLoadNumber.trim().toUpperCase();
      if (!normalizedLoadNumber) {
        alert('Informe o numero da carga da sobra.');
        return;
      }

      const baseItem = noteItems[0];
      const normalizedTotalSurplusQty = normalizeQtyByType(Number(baseItem.quantity || 0), true);
      if (normalizedTotalSurplusQty <= QUANTITY_EPSILON) {
        alert('Informe uma quantidade valida para sobra.');
        return;
      }

      if (leftoverIsInversion) {
        let inversionAllocations = [...leftoverInversionAllocations];

        if (!inversionAllocations.length) {
          const relatedInvoice = leftoverInversionInvoiceNumber.trim();
          if (!relatedInvoice) {
            alert('Informe ao menos uma NF relacionada da inversao.');
            return;
          }

          if (!leftoverInversionDanfe || String(leftoverInversionDanfe.invoice_number) !== relatedInvoice) {
            alert('Busque a NF relacionada para validar os itens da inversao.');
            return;
          }

          const missingProductCode = leftoverInversionMissingProductCode.trim().toUpperCase();
          if (!missingProductCode) {
            alert('Informe o produto que faltou na NF relacionada.');
            return;
          }

          const belongsToInvoice = leftoverInversionDanfe.DanfeProducts.some((item) => item.Product.code === missingProductCode);
          if (!belongsToInvoice) {
            alert('Produto faltante nao pertence a NF relacionada.');
            return;
          }

          inversionAllocations = [{
            invoice_number: relatedInvoice,
            missing_product_code: missingProductCode,
            quantity: normalizedTotalSurplusQty,
          }];
        }

        const normalizedDistributedQty = normalizeQtyByType(
          inversionAllocations.reduce((sum, allocation) => sum + Number(allocation.quantity || 0), 0),
          true,
        );
        if (Math.abs(normalizedDistributedQty - normalizedTotalSurplusQty) > QUANTITY_EPSILON) {
          const normalizedRemaining = Math.max(0, normalizeQtyByType(normalizedTotalSurplusQty - normalizedDistributedQty, true));
          alert(
            `Distribuicao incompleta da sobra por inversao. Total: ${formatKgInputValue(normalizedTotalSurplusQty)} | Distribuido: ${formatKgInputValue(normalizedDistributedQty)} | Restante: ${formatKgInputValue(normalizedRemaining)}.`,
          );
          return;
        }

        notesToCreate = inversionAllocations.map((allocation) => {
          const normalizedAllocationQty = normalizeQtyByType(Number(allocation.quantity || 0), true);
          const inversionPayload = {
            invoice_number: allocation.invoice_number,
            missing_product_code: allocation.missing_product_code,
          };

          return {
            invoice_number: buildSurplusReferenceInvoiceNumber(
              normalizedLoadNumber,
              baseItem.product_id,
              inversionPayload.invoice_number,
              inversionPayload.missing_product_code,
            ),
            return_type: returnType,
            load_number: normalizedLoadNumber,
            is_inversion: true,
            inversion: inversionPayload,
            items: [{ ...baseItem, quantity: normalizedAllocationQty }],
          };
        });
      } else {
        notesToCreate = [
          {
            invoice_number: buildSurplusReferenceInvoiceNumber(normalizedLoadNumber, baseItem.product_id),
            return_type: returnType,
            load_number: normalizedLoadNumber,
            is_inversion: false,
            items: noteItems,
          },
        ];
      }
    } else {
      const noteInvoiceNumber = String(returnDanfe?.invoice_number);
      notesToCreate = [
        {
          invoice_number: noteInvoiceNumber,
          return_type: effectiveReturnType,
          items: noteItems,
        },
      ];
    }

    const duplicateInvoiceInsidePayload = notesToCreate.find((note, index) => (
      notesToCreate.findIndex((candidate) => candidate.invoice_number === note.invoice_number) !== index
    ));
    if (duplicateInvoiceInsidePayload) {
      alert('Ha NFs de inversao repetidas na distribuicao da sobra. Ajuste a lista antes de continuar.');
      return;
    }

    if (selectedBatch) {
      const existingInvoiceNumbers = new Set(batchDraftNotes.map((note) => note.invoice_number));
      const conflictingNotes = notesToCreate.filter((note) => existingInvoiceNumbers.has(note.invoice_number));
      if (conflictingNotes.length) {
        alert(effectiveReturnType === 'sobra'
          ? 'Uma ou mais sobras dessa distribuicao ja existem no lote selecionado.'
          : 'Essa NF ja existe no lote selecionado.');
        return;
      }

      setBatchDraftNotes((previous) => ([
        ...previous,
        ...notesToCreate.map((note, index) => ({
          id: -(Date.now() + index),
          invoice_number: note.invoice_number,
          return_type: note.return_type,
          driver_id: Number(selectedBatch.driver_id),
          vehicle_plate: selectedBatch.vehicle_plate,
          return_date: selectedBatch.return_date,
          batch_code: selectedBatch.batch_code,
          batch_status: selectedBatch.batch_status,
          load_number: note.load_number || null,
          is_inversion: Boolean(note.is_inversion),
          ...(note.inversion
            ? {
              inversion_invoice_number: note.inversion.invoice_number,
              inversion_missing_product_code: note.inversion.missing_product_code,
              inversion: note.inversion,
            }
            : {}),
          items: note.items,
        })),
      ]));

      const addedCountLabel = notesToCreate.length > 1 ? `${notesToCreate.length} sobras` : 'Sobra';
      alert(effectiveReturnType === 'sobra'
        ? `${addedCountLabel} adicionadas na edicao do lote. Clique em "Salvar lote" para persistir.`
        : 'NF adicionada na edicao do lote. Clique em "Salvar lote" para persistir.');
      clearNfBuilder();
      setReturnWizardStep(4);
      return;
    }

    const existingInvoiceNumbers = new Set(draftNotes.map((note) => note.invoice_number));
    const conflictingNotes = notesToCreate.filter((note) => existingInvoiceNumbers.has(note.invoice_number));
    if (conflictingNotes.length) {
      alert(effectiveReturnType === 'sobra'
        ? 'Uma ou mais sobras dessa distribuicao ja estao na lista atual.'
        : 'Essa NF ja esta na lista atual.');
      return;
    }

    setDraftNotes((previous) => ([
      ...previous,
      ...notesToCreate,
    ]));
    setRecentlyRemovedDraft(null);

    clearNfBuilder();
    setReturnWizardStep(4);
  }

  function clearNfBuilder() {
    setReturnNf('');
    setReturnDanfe(null);
    setReturnDataLookup(null);
    setReturnDataLookupError('');
    setReturnDataLookupLoading(false);
    setShowReturnDataDetails(false);
    setReturnType('total');
    setReturnTypeDivergenceAcknowledged('');
    setIsReturnNfCollection(false);
    setReturnNfCollectionLookupLoading(false);
    setPartialItems([]);
    setPartialProductCode('');
    setPartialProductType('');
    setPartialQuantityInput('1');
    setPartialIsMissing(false);
    setPartialKeepInStock(false);
    setPartialStockDefault(false);
    setLeftoverProductCode('');
    setLeftoverQuantityInput('1');
    setLeftoverProductType('');
    setLeftoverLoadNumber('');
    resetSurplusInversionBuilder();
  }

  function removeDraftNf(invoiceNumber: string) {
    const index = draftNotes.findIndex((note) => note.invoice_number === invoiceNumber);
    const note = index >= 0 ? draftNotes[index] : null;
    if (note) {
      setRecentlyRemovedDraft({ note, index });
    }
    setDraftNotes((previous) => previous.filter((note) => note.invoice_number !== invoiceNumber));
  }

  function undoRemoveDraftNf() {
    if (!recentlyRemovedDraft) return;
    const { note, index } = recentlyRemovedDraft;
    setDraftNotes((previous) => {
      const next = [...previous];
      next.splice(Math.min(index, next.length), 0, note);
      return next;
    });
    setRecentlyRemovedDraft(null);
  }

  function handleCreateNewBatch() {
    setSelectedBatchCode('');
    setDraftNotes([]);
    setRecentlyRemovedDraft(null);
    clearNfBuilder();
    setReturnDriverId('');
    setSelectedCarId('');
    setReturnDriverInput('');
    setReturnCarInput('');
    setIsReturnDriverSuggestionsOpen(false);
    setIsReturnCarSuggestionsOpen(false);
    setReturnVehicleSuggestionMessage('');
    setIsReturnVehicleSuggestionLoading(false);
    returnVehicleSuggestionRequestRef.current += 1;
    setReturnDate(getTodayDate());
    setReturnWizardStep(1);
  }

  function handleOpenNewReturnModal() {
    handleCreateNewBatch();
    setReturnModalOpen(true);
  }

  function handleOpenReturnBatchModal(batchCode: string) {
    setSelectedBatchCode(batchCode);
    setReturnModalOpen(true);
  }

  async function handleCloseReturnModal() {
    const hasUnsavedChanges = selectedBatch
      ? selectedBatchHasUnsavedChanges
      : draftNotes.length > 0;
    if (hasUnsavedChanges) {
      const confirmed = await showConfirm(
        'Existem alteracoes que ainda nao foram salvas. Deseja fechar mesmo assim?',
        {
          title: 'Fechar devolucao',
          confirmLabel: 'Fechar sem salvar',
          cancelLabel: 'Continuar editando',
          tone: 'danger',
        },
      );
      if (!confirmed) return;
    }

    setReturnModalOpen(false);
    setSelectedBatchCode('');
  }

  async function handleConcludeBatch() {
    if (!draftNotes.length) {
      alert('Adicione ao menos uma NF na lista para concluir.');
      return;
    }

    if (!returnDriverId) {
      alert('Selecione o motorista.');
      return;
    }

    if (!selectedCarId) {
      alert('Selecione o veiculo.');
      return;
    }

    if (!returnDate) {
      alert('Informe a data da subida da devolucao.');
      return;
    }

    const selectedCar = cars.find((car) => String(car.id) === String(selectedCarId));
    if (!selectedCar) {
      alert('Selecione um veiculo valido.');
      return;
    }

    try {
      let batchCodeForPdf = `RET-${returnDate.replace(/-/g, '')}`;
      let createdWithLegacyRoute = false;
      const serializedDraftNotes = draftNotes.map((note) => serializeReturnNotePayload(note));

      try {
        const { data } = await axios.post(`${API_URL}/returns/batches/create`, {
          driver_id: Number(returnDriverId),
          vehicle_plate: selectedCar.license_plate,
          return_date: returnDate,
          notes: serializedDraftNotes,
        });
        batchCodeForPdf = data?.batch_code || batchCodeForPdf;
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          throw error;
        }

        // Compatibilidade com backend antigo em producao (sem rotas de lote)
        await Promise.all(serializedDraftNotes.map((note) => (
          axios.post(`${API_URL}/returns/create`, {
            ...note,
            driver_id: Number(returnDriverId),
            vehicle_plate: selectedCar.license_plate,
            return_date: returnDate,
          })
        )));
        createdWithLegacyRoute = true;
      }

      const driverName = drivers.find((driver) => String(driver.id) === String(returnDriverId))?.name || 'Motorista';
      const pdfItems = fillMissingTypeForPdf(draftAggregatedItems);

      const pdfBlob = await pdf(
        <ReturnReceiptPDF
          batchCode={batchCodeForPdf}
          driverName={driverName}
          vehiclePlate={selectedCar.license_plate}
          returnDate={returnDate}
          notes={draftNotes.map((note) => ({
            invoice_number: note.invoice_number,
            return_type: note.return_type,
            items: fillMissingTypeForPdf(note.items),
          }))}
          items={pdfItems}
        />
      ).toBlob();

      const fileName = getReturnPdfFileName(returnDate);
      openPdfInNewTab(pdfBlob, fileName);

      if (createdWithLegacyRoute) {
        alert('Devolucao concluida com sucesso. Observacao: backend em modo legado (sem lote).');
      } else {
        alert('Devolucao concluida com sucesso.');
      }
      handleCreateNewBatch();
      setReturnModalOpen(false);
      await loadReturnBatches();
    } catch (error) {
      console.error(error);
      alert('Erro ao concluir devolucao.');
    }
  }

  function handleRemoveNoteFromBatch(noteId: number) {
    if (!ensureSelectedBatchEditable()) {
      return;
    }

    setBatchDraftNotes((previous) => previous.filter((note) => note.id !== noteId));
  }

  async function handleSaveBatch() {
    if (!selectedBatch) {
      return;
    }

    if (!ensureSelectedBatchEditable()) {
      return;
    }

    const originalNotes = selectedBatch.notes;
    const draftInvoices = new Set(batchDraftNotes.map((note) => note.invoice_number));
    const originalInvoices = new Set(originalNotes.map((note) => note.invoice_number));
    const driverChanged = String(selectedBatch.driver_id || '') !== String(returnDriverId || '');
    const vehicleChanged = String(selectedBatch.vehicle_plate || '').toUpperCase() !== String(selectedBatchVehiclePlate || '').toUpperCase();

    const notesToAdd = batchDraftNotes.filter((note) => !originalInvoices.has(note.invoice_number));
    const notesToRemove = originalNotes.filter((note) => !draftInvoices.has(note.invoice_number));

    if (!notesToAdd.length && !notesToRemove.length && !driverChanged && !vehicleChanged) {
      alert('Nenhuma alteracao para salvar no lote.');
      return;
    }

    try {
      if (driverChanged || vehicleChanged) {
        await axios.put(`${API_URL}/returns/batches/${selectedBatch.batch_code}/transport`, {
          driver_id: Number(returnDriverId),
          vehicle_plate: selectedBatchVehiclePlate,
        });
      }

      for (const note of notesToRemove) {
        await axios.delete(`${API_URL}/returns/notes/${note.id}`);
      }

      for (const note of notesToAdd) {
        await axios.post(
          `${API_URL}/returns/batches/${selectedBatch.batch_code}/add-note`,
          serializeReturnNotePayload(note),
        );
      }

      alert('Lote salvo com sucesso.');
      await loadReturnBatches();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar alteracoes do lote.');
    }
  }

  async function handleConfirmBatchSubmission(batchToConfirm?: IReturnBatch) {
    const targetBatch = batchToConfirm || selectedBatch;
    if (!targetBatch) {
      return;
    }

    const targetWorkflowStatus = resolveReturnBatchWorkflowStatus(targetBatch);
    const isTargetSelected = selectedBatch?.batch_code === targetBatch.batch_code;

    if (isTargetSelected && selectedBatchHasUnsavedChanges) {
      alert('Salve as alteracoes do lote antes de confirmar o envio.');
      return;
    }

    if (!canManageBatchTransportadora || targetWorkflowStatus !== 'pending_transportadora') {
      alert('Apenas lotes pendentes da transportadora podem ser confirmados para envio.');
      return;
    }

    const confirmed = await showConfirm(
      'Ao confirmar o envio da devolucao, este lote nao podera mais ser editado. Deseja continuar?',
      {
        title: 'Confirmar envio',
        confirmLabel: 'Confirmar envio',
        cancelLabel: 'Cancelar',
      },
    );
    if (!confirmed) {
      return;
    }

    try {
      await axios.put(`${API_URL}/returns/batches/${targetBatch.batch_code}/confirm-submission`);
      alert('Envio do lote confirmado. O lote agora aguarda confirmacao da Torre de Controle.');
      await loadReturnBatches();
    } catch (error) {
      console.error(error);
      if (handleAuthenticationError(error)) return;
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao confirmar envio do lote.');
      } else {
        alert('Erro ao confirmar envio do lote.');
      }
    }
  }

  async function handleConfirmBatchReceipt() {
    if (!selectedBatch) {
      return;
    }

    if (!canConfirmBatchReceipt || !isSelectedBatchAwaitingControlTower) {
      alert('Somente lotes aguardando a Torre de Controle podem ser finalizados.');
      return;
    }

    const confirmed = await showConfirm(
      'Confirma que a Torre de Controle recebeu esta devolucao e deseja finalizar o lote?',
      {
        title: 'Confirmar recebimento',
        confirmLabel: 'Finalizar lote',
        cancelLabel: 'Cancelar',
      },
    );
    if (!confirmed) {
      return;
    }

    try {
      await axios.put(`${API_URL}/returns/batches/${selectedBatch.batch_code}/confirm-receipt`);
      alert('Recebimento confirmado pela Torre de Controle.');
      await loadReturnBatches();
    } catch (error) {
      console.error(error);
      if (handleAuthenticationError(error)) return;
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao confirmar recebimento do lote.');
      } else {
        alert('Erro ao confirmar recebimento do lote.');
      }
    }
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

      setOccurrenceDanfe(data);
      setOccurrenceProductCode(OCCURRENCE_TOTAL_OPTION);
      setOccurrenceProductType('');
      setOccurrenceQuantityInput('1');
      setOccurrenceItems([]);
    } catch (error) {
      console.error(error);
      alert('Erro ao buscar NF para ocorrencia.');
    }
  }

  function resetOccurrenceBuilder() {
    setEditingOccurrenceId(null);
    setOccurrenceReason('faltou_no_carregamento');
    setOccurrenceProductCode(OCCURRENCE_TOTAL_OPTION);
    setOccurrenceProductType('');
    setOccurrenceQuantityInput('1');
    setOccurrenceItems([]);
    setOccurrenceDanfe(null);
    setOccurrenceNf('');
  }

  async function openCreateOccurrenceBuilder() {
    const draft = readSavedOccurrenceDraft();
    resetOccurrenceBuilder();
    setIsOccurrenceBuilderOpen(true);
    if (!draft) return;

    setOccurrenceNf(draft.invoiceNumber);
    setOccurrenceReason(draft.reason);
    setOccurrenceItems(draft.items);
    try {
      const danfe = await findDanfeByNf(draft.invoiceNumber);
      if (danfe) setOccurrenceDanfe(danfe);
    } catch {
      // A NF pode ser buscada novamente pelo usuario quando a conexao voltar.
    }
    setOccurrenceProductCode(draft.productCode);
    setOccurrenceProductType(draft.productType);
    setOccurrenceQuantityInput(draft.quantityInput);
  }

  function closeOccurrenceBuilder() {
    setIsOccurrenceBuilderOpen(false);
    resetOccurrenceBuilder();
  }

  function clearSavedOccurrenceDraft() {
    localStorage.removeItem(OCCURRENCE_DRAFT_STORAGE_KEY);
    setHasSavedOccurrenceDraft(false);
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

  async function handleCreateOrEditOccurrence() {
    if (!isOnline) {
      alert('Sem conexao no momento. O rascunho foi mantido neste aparelho; envie quando a internet voltar.');
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
      const payload = {
        invoice_number: String(occurrenceDanfe.invoice_number),
        reason: occurrenceReason,
        scope: occurrenceScope,
        items: occurrenceScope === 'items' ? occurrenceItems : [],
      };

      if (editingOccurrenceId) {
        await axios.put(`${API_URL}/occurrences/${editingOccurrenceId}`, payload);
      } else {
        await axios.post(`${API_URL}/occurrences/create`, payload);
      }

      alert(editingOccurrenceId ? 'Ocorrencia atualizada com sucesso.' : 'Ocorrencia registrada com sucesso.');
      if (!editingOccurrenceId) clearSavedOccurrenceDraft();
      closeOccurrenceBuilder();
      await loadOccurrences();
    } catch (error) {
      console.error(error);
      if (handleAuthenticationError(error)) return;
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao salvar ocorrencia.');
      } else {
        alert('Erro ao salvar ocorrencia.');
      }
    }
  }

  async function startEditOccurrence(occurrence: IOccurrence) {
    if (!isOccurrencePendingForTransportadora(occurrence)) return;

    setIsOccurrenceBuilderOpen(true);
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
        setOccurrenceDanfe(data);
      }
    } catch (error) {
      console.error(error);
    }
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

      if (resolutionType === 'talao_mercadoria_faltante') {
        alert('Ocorrencia enviada para a Torre de Controle e aguardando finalizacao do credito.');
      }

      setResolvingOccurrence(null);
      setResolutionType('');
      setResolutionNote('');

      if (resolutionType === 'talao_mercadoria_faltante' && !isControlTowerUser) {
        setOccurrenceStatusFilter('awaiting_control_tower');
      } else {
        await loadOccurrences();
      }
    } catch (error) {
      console.error(error);
      if (handleAuthenticationError(error)) return;
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao atualizar status da ocorrencia.');
      } else {
        alert('Erro ao atualizar status da ocorrencia.');
      }
    }
  }

  async function handleOpenBatchPdf(batch: IReturnBatch) {
    try {
      const aggregatedItems = batch.aggregated_items?.length
        ? groupItemsByProductAndType(batch.aggregated_items)
        : groupItemsByProductAndType(batch.notes.flatMap((note) => note.items || []));
      const pdfItems = fillMissingTypeForPdf(aggregatedItems);

      const driverName = batch.Driver?.name
        || drivers.find((driver) => String(driver.id) === String(batch.driver_id))?.name
        || 'Motorista';

      const pdfBlob = await pdf(
        <ReturnReceiptPDF
          batchCode={batch.batch_code}
          driverName={driverName}
          vehiclePlate={batch.vehicle_plate}
          returnDate={batch.return_date}
          notes={batch.notes.map((note) => ({
            invoice_number: note.invoice_number,
            return_type: note.return_type,
            items: fillMissingTypeForPdf(note.items || []),
          }))}
          items={pdfItems}
        />
      ).toBlob();

      const fileName = getReturnPdfFileName(batch.return_date);
      openPdfInNewTab(pdfBlob, fileName);
    } catch (error) {
      console.error(error);
      alert('Erro ao abrir PDF do lote.');
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

  async function handleDeleteOccurrence(id: number) {
    const confirmed = await showConfirm(
      'Deseja realmente excluir esta ocorrencia? O historico sera preservado.',
      {
        title: 'Excluir ocorrência',
        confirmLabel: 'Excluir',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      },
    );
    if (!confirmed) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/occurrences/${id}`);
      await loadOccurrences();
      alert('Ocorrencia excluida com sucesso.');
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir ocorrencia.');
    }
  }

  async function handleViewBatchHistory(batchCode: string) {
    if (!isAdminUser) {
      alert('Somente usuarios admin podem visualizar o historico.');
      return;
    }

    try {
      const { data } = await axios.get(`${API_URL}/returns/batches/${batchCode}/history`);
      setHistoryModalTitle(`Historico do lote ${batchCode}`);
      setHistoryEntries(data);
      setHistoryModalOpen(true);
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar historico do lote.');
    }
  }

  return (
    <div>
      <Header />
      <Container>
        <PageContainer className="gap-0">
          <TabsRow className="items-end gap-0">
            <Tabs className="w-auto">
              <button
                className={`relative -mb-px rounded-t-[10px] border px-4 py-2 text-sm font-semibold transition ${activeTab === 'returns'
                  ? 'z-10 border-border border-b-transparent bg-card text-text shadow-none after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-card after:content-[""]'
                  : 'border-transparent bg-surface text-muted hover:bg-surface-2 hover:text-text'
                  }`}
                onClick={() => setTab('returns')}
                type="button"
              >
                Devolucoes
              </button>
              <button
                className={`relative -mb-px rounded-t-[10px] border px-4 py-2 text-sm font-semibold transition ${activeTab === 'occurrences'
                  ? 'z-10 border-border border-b-transparent bg-card text-text shadow-none after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-card after:content-[""]'
                  : 'border-transparent bg-surface text-muted hover:bg-surface-2 hover:text-text'
                  }`}
                onClick={() => setTab('occurrences')}
                type="button"
              >
                Ocorrencias
              </button>
            </Tabs>
          </TabsRow>

          <section className="-mt-px w-full min-w-0 rounded-b-lg rounded-tr-lg border border-border bg-surface p-3 shadow-soft">
            {activeTab === 'returns' && (
              <SingleColumn>
                <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-text">Consultar lotes de devolucao</h2>
                      <p className="text-xs text-muted">Pesquise por ID, periodo ou consulte os lotes mais recentes.</p>
                    </div>
                    <div className="flex flex-wrap items-start justify-end gap-2">
                      <div className="text-left">
                        <button
                          type="button"
                          onClick={() => navigate('/returns-occurrences/base')}
                          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-accent-strong bg-accent px-4 text-sm font-bold text-white shadow-soft transition-colors hover:bg-accent-strong"
                        >
                          <Database size={16} /> Base de devoluções
                        </button>
                        <p className="mt-1 text-[10px] text-muted">
                          {returnDataLastUpdate
                            ? `Atualizada em ${formatReturnDataUpdate(returnDataLastUpdate)}`
                            : 'Base ainda não importada'}
                        </p>
                      </div>
                      {canManageBatchTransportadora && (
                        <button
                          type="button"
                          onClick={handleOpenNewReturnModal}
                          className="h-10 shrink-0 rounded-md border border-accent-strong bg-accent px-5 text-sm font-bold text-white shadow-soft transition-colors hover:bg-accent-strong"
                        >
                          + Nova devolucao
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(280px,1fr)_190px_auto]">
                    <div className="flex min-w-0 gap-2">
                      <input
                        type="search"
                        value={batchCodeFilter}
                        onChange={(event) => setBatchCodeFilter(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void handleSearchBatchByCode();
                        }}
                        placeholder="ID do lote (ex.: RET-...)"
                        aria-label="ID do lote de devolucao"
                        className="h-10 min-w-0 flex-1 rounded-sm border border-border bg-card px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                      />
                      <button
                        type="button"
                        onClick={handleSearchBatchByCode}
                        className="h-10 shrink-0 rounded-md border border-accent/60 bg-accent/15 px-4 text-[0.85rem] font-bold text-text-accent transition hover:bg-accent/25"
                      >
                        Buscar lote
                      </button>
                    </div>
                    <select
                      value={batchLookbackDays}
                      onChange={(event) => {
                        const lookbackDays = event.target.value as ReturnBatchLookbackValue;
                        setBatchLookbackDays(lookbackDays);
                        void loadReturnBatches(lookbackDays);
                      }}
                      className="h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                      aria-label="Periodo de devolucoes"
                    >
                      {RETURN_BATCH_LOOKBACK_OPTIONS.map((option) => (
                        <option key={`return-lookback-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleLoadLatestBatches}
                      className="h-10 rounded-md border border-border bg-card px-3 text-[0.82rem] font-semibold text-muted transition hover:bg-surface-2 hover:text-text"
                    >
                      Atualizar lista
                    </button>
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="min-w-0 flex-1 sm:max-w-[220px]">
                      <span className="mb-1 block text-xs font-semibold text-muted">Data inicial</span>
                      <input
                        type="date"
                        value={batchStartDate}
                        onClick={handleOpenDatePicker}
                        onChange={(event) => setBatchStartDate(event.target.value)}
                        aria-label="Data inicial dos lotes de devolucao"
                        className="h-10 w-full cursor-pointer rounded-sm border border-border bg-card px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                      />
                    </label>
                    <label className="min-w-0 flex-1 sm:max-w-[220px]">
                      <span className="mb-1 block text-xs font-semibold text-muted">Data final</span>
                      <input
                        type="date"
                        value={batchEndDate}
                        onClick={handleOpenDatePicker}
                        onChange={(event) => setBatchEndDate(event.target.value)}
                        aria-label="Data final dos lotes de devolucao"
                        className="h-10 w-full cursor-pointer rounded-sm border border-border bg-card px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleSearchBatchesByPeriod}
                      className="h-10 rounded-md border border-border bg-card px-4 text-[0.85rem] font-bold text-text transition hover:bg-surface-2"
                    >
                      Buscar período
                    </button>
                  </div>
                </div>
                {batchSearchFeedback ? (
                  <div className={`rounded-md border px-3 py-2 text-sm ${returnBatches.length ? 'semantic-panel-success' : 'semantic-panel-warning'}`}>
                    {batchSearchFeedback}
                  </div>
                ) : null}
                {returnModalOpen && (
                  <>
                    <ModalOverlay onClick={() => void handleCloseReturnModal()} />
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-label={selectedBatch ? `Lote de devolucao ${selectedBatch.batch_code}` : 'Nova devolucao'}
                      className="fixed left-1/2 top-1/2 z-[1500] flex max-h-[94vh] w-[min(96vw,1120px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-3)]"
                    >
                      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-5">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-bold text-text sm:text-lg">
                            {selectedBatch
                              ? `${isSelectedBatchEditableByTransportadora ? 'Editar' : 'Consultar'} lote ${selectedBatch.batch_code}`
                              : 'Nova devolucao'}
                          </h2>
                          <p className="text-xs text-muted">
                            {selectedBatch
                              ? RETURN_BATCH_WORKFLOW_LABELS[selectedBatchWorkflowStatus || 'pending_transportadora']
                              : 'Monte a lista de NFs e conclua para criar o lote.'}
                          </p>
                        </div>
                        <IconButton
                          icon={X}
                          label="Fechar devolucao"
                          onClick={() => void handleCloseReturnModal()}
                          className="!h-10 !w-10 !min-h-10 !min-w-10 !shrink-0 !px-0 !py-0"
                        />
                      </div>
                      <div ref={returnModalContentRef} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                {selectedBatch && (
                  <TopActionBar className="mb-3 flex-wrap">
                    <button className="secondary" onClick={() => handleOpenBatchPdf(selectedBatch)} type="button">
                      Abrir PDF
                    </button>
                    {selectedBatchWorkflowStatus === 'pending_transportadora' && canManageBatchTransportadora && (
                      <button
                        type="button"
                        onClick={() => handleConfirmBatchSubmission()}
                        className="rounded-md border border-warning bg-warning px-4 py-[0.65rem] text-[0.82rem] font-bold text-white transition hover:brightness-110"
                      >
                        Confirmar envio da devolucao
                      </button>
                    )}
                    {isSelectedBatchAwaitingControlTower && canConfirmBatchReceipt && (
                      <button
                        type="button"
                        onClick={handleConfirmBatchReceipt}
                        className="rounded-md border border-emerald-700 bg-emerald-600 px-4 py-[0.65rem] text-[0.82rem] font-bold text-white transition-colors hover:bg-emerald-700"
                      >
                        Confirmar recebimento da devolucao
                      </button>
                    )}
                  </TopActionBar>
                )}

                <Card>
                  {isReturnWizardMode && (
                    <div className="mb-5 overflow-x-auto pb-1">
                      <ol className="grid min-w-[620px] grid-cols-4 gap-2" aria-label="Etapas da devolucao">
                        {([
                          { step: 1 as const, label: 'Transporte', icon: Truck },
                          { step: 2 as const, label: 'Nota fiscal', icon: FileSearch },
                          { step: 3 as const, label: 'Tipo e produtos', icon: PackageCheck },
                          { step: 4 as const, label: 'Revisao do lote', icon: CheckCircle2 },
                        ]).map(({ step, label, icon: StepIcon }) => {
                          const isActive = returnWizardStep === step;
                          const isComplete = returnWizardStep > step;
                          return (
                            <li key={step}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (step === 1 || step < returnWizardStep || (step === 4 && returnWizardNoteCount)) {
                                    setReturnWizardStep(step);
                                  }
                                }}
                                disabled={step > returnWizardStep && !(step === 4 && returnWizardNoteCount)}
                                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
                                  isActive
                                    ? 'border-accent bg-accent/15 text-text-accent'
                                    : isComplete
                                      ? 'semantic-panel-success'
                                      : 'border-border bg-card text-muted'
                                } disabled:cursor-not-allowed disabled:opacity-55`}
                              >
                                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                                  isActive ? 'bg-accent text-white' : isComplete ? 'bg-emerald-600 text-white' : 'bg-surface-2'
                                }`}>
                                  <StepIcon size={15} />
                                </span>
                                <span>
                                  <span className="block text-[0.68rem] font-semibold uppercase tracking-wide">Etapa {step}</span>
                                  <span className="block text-xs font-bold">{label}</span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                  <BoxDescription className="flex-col gap-1">
                    <h2 className="leading-tight max-[768px]:text-[0.92rem]">
                      {selectedBatch ? (
                        selectedBatchWorkflowStatus === 'pending_transportadora'
                          ? `Editando lote ${selectedBatch.batch_code}`
                          : `Lote ${selectedBatch.batch_code} (somente leitura)`
                      ) : (
                        <>
                          <span className="max-[768px]:hidden">Nova devolucao (lista de NFs)</span>
                          <span className="hidden max-[768px]:inline">Nova devolucao - lista de NFs</span>
                        </>
                      )}
                    </h2>
                    {selectedBatch && !isSelectedBatchEditableByTransportadora ? (
                      <>
                        <InlineText>
                          Motorista: {selectedBatchDriverName} | Placa: {selectedBatchVehiclePlate} | Data: {formatDateBR(selectedBatch.return_date)}
                        </InlineText>
                        <InlineText>
                          Status do lote: {RETURN_BATCH_WORKFLOW_LABELS[selectedBatchWorkflowStatus || 'pending_transportadora']}
                          {selectedBatch.sent_to_control_tower_at ? ` | Enviado em: ${formatDateTimeBR(selectedBatch.sent_to_control_tower_at)}` : ''}
                          {selectedBatch.received_by_control_tower_at ? ` | Recebido em: ${formatDateTimeBR(selectedBatch.received_by_control_tower_at)}` : ''}
                        </InlineText>
                        {!isSelectedBatchEditableByTransportadora && selectedBatchWorkflowStatus === 'awaiting_control_tower' && (
                          <InfoText>
                            Este lote ja foi enviado pela transportadora e esta aguardando confirmacao de recebimento pela Torre de Controle. Edicao bloqueada.
                          </InfoText>
                        )}
                        {!isSelectedBatchEditableByTransportadora && selectedBatchWorkflowStatus === 'finalized' && (
                          <InfoText>
                            Este lote ja foi finalizado pela Torre de Controle e permanece somente para consulta.
                          </InfoText>
                        )}
                      </>
                    ) : null}

                  </BoxDescription>
                  {isReturnWizardMode && returnWizardStep === 1 && (
                    <div className="mt-4 rounded-xl border border-border bg-card p-4 sm:p-5">
                      <div className="mb-4">
                        <h3 className="text-base font-bold text-text">Quem vai carregar esta devolucao?</h3>
                        <p className="mt-1 text-sm text-muted">Comece informando o motorista e o veiculo que receberao os produtos.</p>
                      </div>
                      <Grid className="grid-cols-1 md:grid-cols-2">
                      <div className="relative">
                        <InlineText>Motorista *</InlineText>
                        <input
                          role="combobox"
                          aria-label="Motorista da devolucao"
                          aria-autocomplete="list"
                          aria-expanded={isReturnDriverSuggestionsOpen}
                          aria-controls="return-driver-suggestions"
                          value={returnDriverInput}
                          onChange={(event) => {
                            const value = event.target.value;
                            setReturnDriverInput(value);
                            setIsReturnDriverSuggestionsOpen(true);
                            const current = returnDriverOptions.find((option) => option.id === returnDriverId);
                            if (current && normalizeAssignmentSearch(current.value) !== normalizeAssignmentSearch(value)) {
                              returnVehicleSuggestionRequestRef.current += 1;
                              setReturnDriverId('');
                              setSelectedCarId('');
                              setReturnCarInput('');
                              setIsReturnVehicleSuggestionLoading(false);
                              setReturnVehicleSuggestionMessage('');
                            }
                          }}
                          onFocus={() => setIsReturnDriverSuggestionsOpen(true)}
                          onBlur={(event) => {
                            commitReturnDriverInput(event.target.value, true);
                            setIsReturnDriverSuggestionsOpen(false);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitReturnDriverInput((event.target as HTMLInputElement).value, true);
                            }
                          }}
                          placeholder="Digite o nome do motorista"
                        />
                        {isReturnDriverSuggestionsOpen ? (
                          <div id="return-driver-suggestions" role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg">
                            {filteredReturnDriverOptions.length ? filteredReturnDriverOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                role="option"
                                aria-selected={returnDriverId === option.id}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectReturnDriver(option.id)}
                                className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-surface focus:bg-surface focus:outline-none"
                              >
                                {option.label}
                              </button>
                            )) : (
                              <p className="px-3 py-2 text-sm text-muted">Nenhum motorista encontrado.</p>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <div className="relative">
                        <InlineText>Veiculo / Placa *</InlineText>
                        <input
                          role="combobox"
                          aria-label="Veiculo da devolucao"
                          aria-autocomplete="list"
                          aria-expanded={isReturnCarSuggestionsOpen}
                          aria-controls="return-car-suggestions"
                          value={returnCarInput}
                          onChange={(event) => {
                            const value = event.target.value;
                            setReturnCarInput(value);
                            setIsReturnCarSuggestionsOpen(true);
                            const current = returnCarOptions.find((option) => option.id === selectedCarId);
                            if (current && normalizeAssignmentSearch(current.value) !== normalizeAssignmentSearch(value)) {
                              setSelectedCarId('');
                              setReturnVehicleSuggestionMessage('');
                            }
                          }}
                          onFocus={() => setIsReturnCarSuggestionsOpen(true)}
                          onBlur={(event) => {
                            commitReturnCarInput(event.target.value, true);
                            setIsReturnCarSuggestionsOpen(false);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitReturnCarInput((event.target as HTMLInputElement).value, true);
                            }
                          }}
                          placeholder="Digite a placa ou o veículo"
                        />
                        {isReturnCarSuggestionsOpen ? (
                          <div id="return-car-suggestions" role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg">
                            {filteredReturnCarOptions.length ? filteredReturnCarOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                role="option"
                                aria-selected={selectedCarId === option.id}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectReturnCar(option.id)}
                                className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-surface focus:bg-surface focus:outline-none"
                              >
                                {option.label}
                              </button>
                            )) : (
                              <p className="px-3 py-2 text-sm text-muted">Nenhum veículo encontrado.</p>
                            )}
                          </div>
                        ) : null}
                        {isReturnVehicleSuggestionLoading ? (
                          <p className="mt-1 text-[11px] text-muted">Buscando veículo habitual...</p>
                        ) : returnVehicleSuggestionMessage ? (
                          <p className="mt-1 text-[11px] text-muted">{returnVehicleSuggestionMessage}</p>
                        ) : null}
                      </div>
                      </Grid>
                      <div className="mt-5 flex justify-end">
                        <button
                          type="button"
                          disabled={!returnDriverId || !selectedCarId}
                          onClick={() => setReturnWizardStep(2)}
                          className="inline-flex h-10 items-center gap-2 rounded-md border border-accent-strong bg-accent px-5 text-sm font-bold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Continuar
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className={
                    isReturnWizardMode && (returnWizardStep === 2 || returnWizardStep === 3)
                      ? 'contents'
                      : 'hidden'
                  }>
                    {isReturnWizardMode && (
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (returnWizardStep === 3) {
                              if (returnType === 'sobra') {
                                clearNfBuilder();
                              }
                              setReturnWizardStep(2);
                              return;
                            }
                            setReturnWizardStep(1);
                          }}
                          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-text"
                        >
                          <ArrowLeft size={16} />
                          Voltar
                        </button>
                      </div>
                    )}
                    {returnWizardStep === 3 ? (
                      <InlineText style={{ margin: '10px 0 6px 0' }}>Tipo e produtos da devolucao</InlineText>
                    ) : null}
                    <div className={
                      isReturnWizardMode && returnWizardStep === 2
                        ? 'mx-auto mt-2 w-full max-w-[480px] space-y-3 rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5'
                        : 'space-y-2'
                    }>
                    {isReturnWizardMode && returnWizardStep === 2 && (
                      <div className="flex flex-col items-center text-center">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-text-accent">
                          <FileSearch size={19} />
                        </span>
                        <h3 className="mt-2 text-base font-bold text-text">Localizar nota fiscal</h3>
                        <p className="mt-1 max-w-[400px] text-xs leading-relaxed text-muted">
                          Informe o número da NF para carregar os produtos.
                        </p>
                      </div>
                    )}
                    <div className={`flex min-w-0 flex-col gap-2 md:flex-row md:items-end md:gap-3 ${
                      isReturnWizardMode && returnWizardStep === 2 ? 'justify-center' : ''
                    }`}>
                      <div className={`${isReturnWizardMode && returnWizardStep !== 2 ? 'hidden' : ''} min-w-0 ${
                        isReturnWizardMode && returnWizardStep === 2 ? 'w-full max-w-[320px]' : 'md:w-[320px] md:shrink-0'
                      }`}>
                        {returnType === 'sobra' ? (
                          <div className="rounded-md border border-border bg-card px-3 py-[11px] text-[0.82rem] text-muted">
                            Cadastro manual de sobra
                          </div>
                        ) : (
                          <div className="flex w-full items-center justify-center gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={returnNf}
                              onChange={(event) => setReturnNf(event.target.value.replace(/\D/g, '').slice(0, 9))}
                              onKeyDown={(event) => {
                                if (event.key !== 'Enter') return;
                                event.preventDefault();
                                void handleSearchReturnNf();
                              }}
                              placeholder="Digite a NF"
                              aria-label="Número da NF da devolução"
                              maxLength={9}
                              className="h-10 min-w-0 flex-1 rounded-sm border border-accent/35 bg-card px-3 text-center text-base font-semibold tracking-[0.08em] text-text placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                            />
                            <button
                              type="button"
                              aria-label="Buscar NF de devolucao"
                              onClick={() => void handleSearchReturnNf()}
                              disabled={!returnNf.trim() || returnNfCollectionLookupLoading}
                              className="h-10 shrink-0 rounded-md border border-accent-strong bg-accent px-4 text-sm font-bold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {returnNfCollectionLookupLoading ? 'Buscando...' : 'Pesquisar'}
                            </button>
                          </div>
                        )}
                        {isReturnWizardMode && returnWizardStep === 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              handleChangeReturnType('sobra');
                              setReturnWizardStep(3);
                            }}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-500 bg-amber-500/15 px-3 py-2.5 text-sm font-bold text-amber-800 shadow-sm transition hover:bg-amber-500/25 dark:text-amber-200"
                          >
                            <PackageCheck size={17} />
                            Registrar sobra sem NF
                          </button>
                        )}
                      </div>
                      <ReturnSearchRow className={`${isReturnWizardMode && returnWizardStep !== 3 ? 'hidden' : ''} md:min-w-0 md:flex-1 md:flex-nowrap md:items-center md:gap-3 md:[&_label]:px-1 md:[&_label]:text-[0.86rem] md:[&_label]:leading-none`}>
                        <label>
                          <input
                            type="checkbox"
                            checked={returnType === 'total'}
                            disabled={Boolean(returnDanfe) && isReturnNfCollection}
                            onChange={() => handleChangeReturnType('total')}
                          />
                          Total
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={returnType === 'partial'}
                            disabled={Boolean(returnDanfe) && isReturnNfCollection}
                            onChange={() => handleChangeReturnType('partial')}
                          />
                          Parcial
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={returnType === 'coleta'}
                            onChange={() => handleChangeReturnType('coleta')}
                          />
                          Coleta
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={returnType === 'weight_break'}
                            disabled={Boolean(returnDanfe) && isReturnNfCollection}
                            onChange={() => handleChangeReturnType('weight_break')}
                          />
                          Quebra de peso
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={returnType === 'sobra'}
                            onChange={() => handleChangeReturnType('sobra')}
                          />
                          Sobra
                        </label>
                      </ReturnSearchRow>
                    </div>
                    </div>

                    {(returnDanfe || returnType === 'sobra') && (
                    <>
                      {returnDanfe && returnType !== 'sobra' && (
                        <InfoText style={{ marginTop: '12px' }}>
                          NF carregada: {returnDanfe.invoice_number} | Cliente: {returnDanfe.Customer.name_or_legal_entity}
                        </InfoText>
                      )}
                      {returnDanfe && returnType !== 'sobra' && returnDataLookupLoading && (
                        <div className="mt-3 rounded-lg border border-border bg-card px-3 py-3 text-sm text-muted">
                          Consultando NF na base acumulada de devoluções...
                        </div>
                      )}
                      {returnDanfe && returnType !== 'sobra' && returnDataLookupError && (
                        <div ref={returnLookupFeedbackRef} className="mt-3 rounded-lg border semantic-panel-warning px-3 py-3 text-sm">
                          {returnDataLookupError}
                        </div>
                      )}
                      {returnDanfe && returnType !== 'sobra' && returnDataLookup && (
                        <div
                          ref={returnLookupFeedbackRef}
                          data-testid={returnWizardStep === 3 ? 'return-base-compact-reminder' : 'return-base-lookup-result'}
                          className={`mx-auto mt-3 max-w-[640px] rounded-lg border px-3 py-2.5 text-sm ${
                          returnDataLookup.consolidated_status === 'approved'
                            ? 'semantic-panel-success'
                            : returnDataLookup.consolidated_status === 'registered_without_approval'
                              ? 'semantic-panel-warning'
                              : 'border-red-500 bg-red-500/10 text-red-800 dark:text-red-200'
                        }`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <Database size={16} className="shrink-0" />
                              <strong>Base de devoluções:</strong>
                              <span className="font-semibold">
                                {returnDataLookup.consolidated_status === 'approved'
                                  ? returnDataLookup.approved_count > 1
                                    ? `${returnDataLookup.approved_count} ocorrências aprovadas`
                                    : 'Possui ocorrência aprovada'
                                  : returnDataLookup.consolidated_status === 'registered_without_approval'
                                    ? 'Registrada, mas sem aprovação'
                                    : 'Atenção: NF não localizada na base de devoluções'}
                              </span>
                              {returnWizardStep === 2 ? <span className="text-xs opacity-80">
                                {returnDataLookup.latest_base_update
                                  ? `Base atualizada em ${formatReturnDataUpdate(returnDataLookup.latest_base_update)}`
                                  : 'Base ainda não importada'}
                              </span> : null}
                              {returnWizardStep === 3 && approvedRegistryReturnTypes.length === 1 ? (
                                <span className="text-xs font-semibold">
                                  Tipo sugerido pela base: {getReturnTypeLabel(approvedRegistryReturnTypes[0])}
                                </span>
                              ) : returnWizardStep === 3 && approvedRegistryReturnTypes.length > 1 ? (
                                <span className="text-xs font-semibold">
                                  A base possui mais de um tipo aprovado: {approvedRegistryReturnTypes.map(getReturnTypeLabel).join(' e ')}
                                </span>
                              ) : null}
                            </p>
                            {returnWizardStep === 2 && returnDataLookup.occurrences.length ? (
                              <button
                                type="button"
                                onClick={() => setShowReturnDataDetails((current) => !current)}
                                className="rounded-md border border-current/30 bg-card px-3 py-2 text-xs font-semibold"
                              >
                                {showReturnDataDetails ? 'Ocultar ocorrências' : 'Ver ocorrências'}
                              </button>
                            ) : null}
                          </div>
                          {returnWizardStep === 2 ? <p className="mt-1.5 text-xs">
                            {returnDataLookup.consolidated_status === 'not_found'
                              ? 'Leia este aviso e confirme abaixo para continuar o cadastro da devolução.'
                              : 'Informação orientativa: esta situação não impede adicionar a NF nem concluir o lote.'}
                          </p> : null}
                          {returnWizardStep === 2 && showReturnDataDetails ? (
                            <div className="mt-3 space-y-2">
                              {returnDataLookup.occurrences.map((registryOccurrence) => (
                                <article key={registryOccurrence.id} className="rounded-md border border-current/20 bg-card p-2 text-xs text-text">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <strong>ID {registryOccurrence.source_occurrence_id}</strong>
                                    <span>{registryOccurrence.approval_status === 'approved' ? 'Aprovada' : registryOccurrence.approval_status === 'rejected' ? 'Reprovada' : 'Não classificada'}</span>
                                  </div>
                                  <p className="mt-1"><strong>Motivo:</strong> {registryOccurrence.return_reason_raw || registryOccurrence.return_reason_category}</p>
                                  <p className="mt-1"><strong>Justificativa:</strong> {registryOccurrence.return_justification || '-'}</p>
                                  <p className="mt-1"><strong>Aprovação:</strong> {registryOccurrence.approval_justification || '-'}</p>
                                  <p className="mt-1"><strong>Transportadora:</strong> {registryOccurrence.carrier_name || '-'}</p>
                                  <p className="mt-1">
                                    <strong>Tipo:</strong>{' '}
                                    {getRegistryTypeLabel(
                                      registryOccurrence.effective_return_type || registryOccurrence.inferred_return_type,
                                    )}
                                    {registryOccurrence.operational_return_type ? ' (corrigido pela operação)' : ''}
                                  </p>
                                  <div className="mt-1">
                                    <strong>Produtos:</strong>
                                    {registryOccurrence.items.length ? registryOccurrence.items.map((item, index) => (
                                      <span key={`${registryOccurrence.id}-${item.id || index}`} className="ml-1">
                                        {item.product_description}{index < registryOccurrence.items.length - 1 ? ';' : ''}
                                      </span>
                                    )) : <span className="ml-1">não informados</span>}
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
                      {isReturnWizardMode
                        && returnWizardStep === 2
                        && returnDanfe
                        && !returnDataLookupLoading
                        && !returnNfCollectionLookupLoading
                        && (returnDataLookup || returnDataLookupError) && (
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setReturnWizardStep(3)}
                            className="inline-flex h-10 items-center gap-2 rounded-md border border-accent-strong bg-accent px-5 text-sm font-bold text-white transition hover:bg-accent-strong"
                          >
                            {returnDataLookup?.consolidated_status === 'not_found'
                              ? 'Ciente, continuar para tipo e produtos'
                              : 'Continuar para tipo e produtos'}
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      )}
                      {returnWizardStep === 3 && (
                      <>
                      <div className="sticky top-0 z-20 mt-2 flex items-center justify-center gap-2 rounded-md border border-accent/40 bg-card/95 px-3 py-2 text-xs font-semibold text-text-accent shadow-sm backdrop-blur">
                        <ArrowDown size={15} className="shrink-0" />
                        Há produtos e ações abaixo. Role para revisar e adicionar esta NF à lista.
                      </div>
                      {returnDanfe && returnType !== 'sobra' && returnNfCollectionLookupLoading && (
                        <InfoText style={{ marginTop: '4px' }}>
                          Validando se a NF possui coleta solicitada pela Mar e Rio...
                        </InfoText>
                      )}
                      {returnDanfe && returnType !== 'sobra' && isReturnNfCollection && (
                        <InfoText style={{ marginTop: '4px' }}>
                          Coleta solicitada identificada para esta NF. Tipo ajustado automaticamente para Coleta.
                        </InfoText>
                      )}
                      {returnDanfe && returnType !== 'sobra' && hasReturnTypeDivergence ? (
                        <div
                          data-testid="return-type-divergence-warning"
                          className="mt-3 rounded-lg border semantic-panel-warning px-3 py-2 text-sm"
                        >
                          <strong>Divergência de tipo:</strong> a base informa {getReturnTypeLabel(suggestedRegistryReturnType as ReturnType)}, mas o preenchimento está como {getReturnTypeLabel(returnType)}.
                          {isReturnTypeDivergenceAcknowledged ? ' O usuário confirmou que deseja manter essa diferença.' : ' A confirmação será solicitada antes de continuar.'}
                        </div>
                      ) : null}
                      {(returnType === 'partial' || returnType === 'coleta' || returnType === 'weight_break') && returnDanfe && (
                        <>
                          {returnType === 'weight_break' && (
                            <div className="mt-3 rounded-lg border semantic-panel-warning px-3 py-2 text-sm">
                              Informe os produtos e as quantidades afetadas. Estes itens aparecerao no PDF como
                              <strong> quebra de peso, sem retorno fisico</strong>.
                            </div>
                          )}
                          <Grid style={{ marginTop: '12px' }}>
                            <div>
                              <InlineText>Produto</InlineText>
                              <select
                                aria-label="Produto da devolucao parcial"
                                value={partialProductCode}
                                onChange={(event) => {
                                  const nextProductCode = event.target.value;
                                  setPartialProductCode(nextProductCode);
                                }}
                              >
                                <option value="">Selecione</option>
                                {returnDanfe.DanfeProducts.map((item) => (
                                  <option key={item.Product.code} value={item.Product.code}>
                                    {item.Product.code} - {item.Product.description}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <InlineText>Tipo</InlineText>
                              <select
                                aria-label="Unidade da devolucao parcial"
                                value={partialProductType}
                                onChange={(event) => setPartialProductType(event.target.value)}
                                disabled={!partialProductCode}
                              >
                                <option value="">Selecione</option>
                                {selectedPartialTypeOptions.map((typeOption) => (
                                  <option key={`partial-type-${typeOption}`} value={typeOption}>
                                    {typeOption}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <InlineText>Quantidade</InlineText>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={partialQuantityInput}
                                onChange={(event) => setPartialQuantityInput(event.target.value)}
                              />
                              {!!partialProductCode && (
                                <InfoText>
                                  Limite da NF para o tipo selecionado: {selectedPartialMaxQty} | Restante para adicionar: {selectedPartialRemainingQty}
                                </InfoText>
                              )}
                            </div>
                          </Grid>
                          {returnType !== 'weight_break' && (
                            <div className="mt-3 grid gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-3">
                              <label className="flex cursor-pointer items-start gap-2 text-sm text-text">
                                <input
                                  type="checkbox"
                                  checked={partialIsMissing}
                                  onChange={(event) => {
                                    setPartialIsMissing(event.target.checked);
                                    if (event.target.checked) setPartialKeepInStock(false);
                                  }}
                                  className="mt-0.5"
                                />
                                <span>
                                  <strong className="block">Produto faltante</strong>
                                  <span className="text-xs text-muted">Nao foi recebido e nao sera separado.</span>
                                </span>
                              </label>
                              <label className="flex cursor-pointer items-start gap-2 text-sm text-text">
                                <input
                                  type="checkbox"
                                  checked={partialKeepInStock}
                                  disabled={partialIsMissing}
                                  onChange={(event) => setPartialKeepInStock(event.target.checked)}
                                  className="mt-0.5"
                                />
                                <span>
                                  <strong className="block">Ficara em estoque</strong>
                                  <span className="text-xs text-muted">Nao retorna agora para a MAR E RIO.</span>
                                </span>
                              </label>
                              <label className="flex cursor-pointer items-start gap-2 text-sm text-text">
                                <input
                                  type="checkbox"
                                  checked={partialStockDefault}
                                  onChange={(event) => setPartialStockDefault(event.target.checked)}
                                  className="mt-0.5"
                                />
                                <span>
                                  <strong className="block">Usar como padrao</strong>
                                  <span className="text-xs text-muted">Pre-selecionar estoque nas proximas devolucoes.</span>
                                </span>
                              </label>
                            </div>
                          )}
                          <Actions style={{ marginTop: '12px' }}>
                            <button
                              className="bg-warning text-white"
                              onClick={addPartialItem}
                              disabled={!partialProductCode || !partialProductType || selectedPartialRemainingQty <= 0}
                              type="button"
                            >
                              {returnType === 'coleta'
                                ? 'Adicionar item de coleta'
                                : returnType === 'weight_break'
                                  ? 'Adicionar quebra de peso'
                                  : 'Adicionar item parcial'}
                            </button>
                          </Actions>
                        </>
                      )}

                      {!!partialItems.length && returnType !== 'sobra' && returnDanfe && (
                        <List>
                          {partialItems.map((item, index) => (
                            <li key={`${getReturnItemKey(item)}-${index}`}>
                              <div className="min-w-0 flex-1">
                              <span className="block">
                                <strong>{item.product_id}</strong> - {item.product_description}
                                {` | Tipo: ${normalizeProductType(item.product_type) || 'N/A'} | Qtd: ${item.quantity}`}
                              </span>
                              {returnType === 'weight_break' ? (
                                <span className="mt-1 inline-flex rounded-full border semantic-solid-warning px-2 py-1 text-xs font-bold">
                                  Quebra de peso — sem produto fisico
                                </span>
                              ) : (
                                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                                  <label className="inline-flex items-center gap-1.5">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(item.is_missing)}
                                      onChange={(event) => updateReturnItemHandling(index, 'is_missing', event.target.checked)}
                                    />
                                    Produto faltante
                                  </label>
                                  <label className="inline-flex items-center gap-1.5">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(item.keep_in_stock)}
                                      disabled={Boolean(item.is_missing)}
                                      onChange={(event) => updateReturnItemHandling(index, 'keep_in_stock', event.target.checked)}
                                    />
                                    Fica em estoque
                                  </label>
                                </div>
                              )}
                              </div>
                              <Actions>
                                {returnType !== 'total' && (
                                  <button className="danger" onClick={() => removePartialItem(index)} type="button">Remover</button>
                                )}
                              </Actions>
                            </li>
                          ))}
                        </List>
                      )}

                      {returnType === 'sobra' && (
                        <>
                          <Grid style={{ marginTop: '12px' }}>
                            <div>
                              <InlineText>Numero da Carga *</InlineText>
                              <input
                                type="text"
                                value={leftoverLoadNumber}
                                onChange={(event) => setLeftoverLoadNumber(event.target.value.toUpperCase())}
                                placeholder="Ex.: CARGA-123"
                                maxLength={40}
                              />
                            </div>
                            <div>
                              <InlineText>Codigo do produto (sobra) *</InlineText>
                              <input
                                type="text"
                                list="products-codes-list"
                                value={leftoverProductCode}
                                onChange={(event) => {
                                  const nextCode = event.target.value.toUpperCase();
                                  setLeftoverProductCode(nextCode);
                                  const matchingProduct = products.find((product) => product.code === nextCode);
                                  if (matchingProduct?.type) {
                                    setLeftoverProductType(String(matchingProduct.type).toUpperCase());
                                  }
                                }}
                                placeholder="Ex.: RV001496"
                              />
                              <datalist id="products-codes-list">
                                {products.map((product) => (
                                  <option key={`leftover-code-${product.code}`} value={product.code}>
                                    {product.description}
                                  </option>
                                ))}
                              </datalist>
                            </div>
                            <div>
                              <InlineText>Quantidade *</InlineText>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={leftoverQuantityInput}
                                onChange={(event) => setLeftoverQuantityInput(event.target.value)}
                              />
                            </div>
                            <div>
                              <InlineText>Tipo *</InlineText>
                              <select
                                aria-label="Unidade do produto da sobra"
                                value={leftoverProductType}
                                onChange={(event) => setLeftoverProductType(event.target.value)}
                              >
                                <option value="">Selecione</option>
                                {leftoverTypeOptions.map((typeOption) => (
                                  <option key={`leftover-type-${typeOption}`} value={typeOption}>
                                    {typeOption}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </Grid>

                          <div className="mt-3 rounded-md border border-border bg-surface px-3 py-2">
                            <label className="flex cursor-pointer items-start gap-2 text-[0.83rem] text-text">
                              <input
                                type="checkbox"
                                checked={leftoverIsInversion}
                                onChange={(event) => setLeftoverIsInversion(event.target.checked)}
                                className="mt-[2px]"
                              />
                              Marcar como inversao (produto veio no lugar de outro)
                            </label>
                          </div>

                          {leftoverIsInversion && (
                            <>
                              <Grid style={{ marginTop: '12px' }}>
                                <div>
                                  <InlineText>NF relacionada *</InlineText>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={leftoverInversionInvoiceNumber}
                                      onChange={(event) => {
                                        const nextValue = event.target.value.replace(/\D/g, '').slice(0, 9);
                                        setLeftoverInversionInvoiceNumber(nextValue);
                                      }}
                                      placeholder="Ex.: 1694432"
                                      maxLength={9}
                                    />
                                    <button
                                      type="button"
                                      onClick={handleSearchSurplusInversionNf}
                                      disabled={leftoverInversionLookupLoading || !leftoverInversionInvoiceNumber.trim()}
                                      className="h-10 rounded-md border border-warning bg-warning px-3 text-[0.75rem] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {leftoverInversionLookupLoading ? 'Buscando...' : 'Buscar NF'}
                                    </button>
                                  </div>
                                  {leftoverInversionLookupError ? (
                                    <InfoText>{leftoverInversionLookupError}</InfoText>
                                  ) : null}
                                  {leftoverInversionDanfe ? (
                                    <InfoText>
                                      NF carregada: {leftoverInversionDanfe.invoice_number}
                                      {' | '}
                                      Cliente: {leftoverInversionDanfe.Customer?.name_or_legal_entity || 'Nao informado'}
                                    </InfoText>
                                  ) : null}
                                </div>
                                <div>
                                  <InlineText>Produto que faltou na NF *</InlineText>
                                  <input
                                    type="text"
                                    list="leftover-inversion-products-list"
                                    value={leftoverInversionMissingProductCode}
                                    onChange={(event) => setLeftoverInversionMissingProductCode(event.target.value.toUpperCase())}
                                    placeholder="Ex.: RV001899"
                                    disabled={!leftoverInversionDanfe}
                                  />
                                  <datalist id="leftover-inversion-products-list">
                                    {leftoverInversionProducts.map((item) => (
                                      <option key={`leftover-inversion-${item.Product.code}`} value={item.Product.code}>
                                        {item.Product.description}
                                      </option>
                                    ))}
                                  </datalist>
                                </div>
                                <div>
                                  <InlineText>Quantidade para esta NF *</InlineText>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={leftoverInversionQuantityInput}
                                    onChange={(event) => setLeftoverInversionQuantityInput(event.target.value)}
                                    placeholder="Ex.: 3,5"
                                  />
                                </div>
                              </Grid>
                              <Actions style={{ marginTop: '10px' }}>
                                <button
                                  type="button"
                                  onClick={addSurplusInversionAllocation}
                                  className="h-10 rounded-md border border-warning bg-warning px-4 text-[0.8rem] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={leftoverInversionLookupLoading}
                                >
                                  Adicionar NF afetada
                                </button>
                              </Actions>
                              {leftoverInversionAllocations.length ? (
                                <List style={{ marginTop: '8px' }}>
                                  {leftoverInversionAllocations.map((allocation, index) => (
                                    <li key={`leftover-allocation-${allocation.invoice_number}-${allocation.missing_product_code}-${index}`}>
                                      <span>
                                        NF {allocation.invoice_number}
                                        {` | Produto faltante: ${allocation.missing_product_code}`}
                                        {` | Qtd: ${formatKgInputValue(allocation.quantity)}`}
                                      </span>
                                      <Actions>
                                        <button
                                          className="danger"
                                          onClick={() => removeSurplusInversionAllocation(index)}
                                          type="button"
                                        >
                                          Remover
                                        </button>
                                      </Actions>
                                    </li>
                                  ))}
                                </List>
                              ) : null}
                              <InfoText style={{ marginTop: '8px' }}>
                                {`Total sobra: ${parsedLeftoverTotalQty > QUANTITY_EPSILON ? formatKgInputValue(parsedLeftoverTotalQty) : '0'} | Distribuido: ${formatKgInputValue(leftoverInversionAllocatedQty)} | Restante: ${formatKgInputValue(leftoverInversionRemainingQty)}`}
                              </InfoText>
                              {surplusInversionSummary ? (
                                <InfoText style={{ marginTop: '8px' }}>{surplusInversionSummary}</InfoText>
                              ) : null}
                              {leftoverInversionMissingProductCode && !selectedLeftoverMissingProduct ? (
                                <InfoText style={{ marginTop: '4px' }}>
                                  O produto informado nao pertence a NF relacionada carregada.
                                </InfoText>
                              ) : null}
                            </>
                          )}
                        </>
                      )}

                      <Actions style={{ marginTop: '12px' }}>
                        <button
                          className="primary"
                          onClick={handleAddNf}
                          disabled={Boolean(selectedBatch && !isSelectedBatchEditableByTransportadora)}
                          type="button"
                        >
                          {returnType === 'sobra'
                            ? (selectedBatch ? 'Adicionar sobra no lote' : 'Adicionar sobra na lista')
                            : (selectedBatch ? 'Adicionar NF no lote' : 'Adicionar NF na lista')}
                        </button>
                      </Actions>
                      </>
                      )}
                    </>
                    )}
                  </div>

                  <div className={isReturnWizardMode && returnWizardStep !== 4 ? 'hidden' : ''}>
                  {isReturnWizardMode && (
                    <div className="mt-4 rounded-lg border border-border bg-card p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Transporte selecionado</p>
                      <p className="mt-1 text-sm font-bold text-text">
                        {drivers.find((driver) => String(driver.id) === String(returnDriverId))?.name || 'Motorista'}
                        {' · '}
                        {cars.find((car) => String(car.id) === String(selectedCarId))?.license_plate || 'Placa'}
                      </p>
                    </div>
                  )}
                  <ListHeaderRow>
                    <h2 style={{ marginTop: '18px' }}>
                      {selectedBatch ? `Notas fiscais do lote ${selectedBatch.batch_code}` : 'Lista de NFs'}
                    </h2>
                    {isReturnWizardMode && (
                      <button
                        type="button"
                        onClick={() => {
                          clearNfBuilder();
                          setReturnWizardStep(2);
                        }}
                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-accent-strong bg-accent px-5 py-2 text-sm font-bold text-white shadow-soft transition hover:bg-accent-strong"
                      >
                        + Adicionar outra NF
                      </button>
                    )}
                    {selectedBatch && isSelectedBatchEditableByTransportadora && (
                      <SaveBatchButton
                        onClick={handleSaveBatch}
                        disabled={!selectedBatchHasUnsavedChanges || !isSelectedBatchEditableByTransportadora}
                        type="button"
                      >
                        Salvar lote
                      </SaveBatchButton>
                    )}
                  </ListHeaderRow>
                  {selectedBatch ? (
                    !batchDraftNotes.length ? (
                      <InlineText>Nenhuma NF no lote selecionado.</InlineText>
                    ) : (
                      <List>
                        {batchDraftNotes.map((note) => (
                          <li key={note.id}>
                            <span>
                              <strong>{getNoteDisplayLabel(note)}</strong>
                              {` | Tipo: ${getReturnTypeLabel(note.return_type)}`}
                              {` | Itens: ${note.items?.length || 0}`}
                              {note.return_type === 'sobra' && note.is_inversion ? ' | Inversao' : ''}
                              {getNoteInversionSummary(note) ? ` | ${getNoteInversionSummary(note)}` : ''}
                            </span>
                            {isSelectedBatchEditableByTransportadora && (
                              <Actions>
                                <button
                                  className="danger"
                                  onClick={() => handleRemoveNoteFromBatch(note.id)}
                                  type="button"
                                >
                                  Remover NF
                                </button>
                              </Actions>
                            )}
                          </li>
                        ))}
                      </List>
                    )
                  ) : (
                    !draftNotes.length ? (
                      <InlineText>Nenhuma NF adicionada ainda.</InlineText>
                    ) : (
                      <List>
                        {draftNotes.map((note) => (
                          <li key={note.invoice_number}>
                            <span>
                              <strong>{getNoteDisplayLabel(note)}</strong>
                              {` | Tipo: ${getReturnTypeLabel(note.return_type)}`}
                              {` | Itens: ${note.items.length}`}
                              {note.return_type === 'sobra' && note.is_inversion ? ' | Inversao' : ''}
                              {getNoteInversionSummary(note) ? ` | ${getNoteInversionSummary(note)}` : ''}
                              {note.items.some((item) => item.is_missing) ? ' | Possui faltante' : ''}
                              {note.items.some((item) => item.keep_in_stock) ? ' | Possui item para estoque' : ''}
                            </span>
                            <Actions>
                              <button className="danger" onClick={() => removeDraftNf(note.invoice_number)} type="button">
                                Remover NF
                              </button>
                            </Actions>
                          </li>
                        ))}
                      </List>
                    )
                  )}
                  {!selectedBatch && recentlyRemovedDraft && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted">
                      <span>{getNoteDisplayLabel(recentlyRemovedDraft.note)} removida da lista.</span>
                      <button
                        type="button"
                        onClick={undoRemoveDraftNf}
                        className="font-bold text-text-accent underline underline-offset-2"
                      >
                        Desfazer
                      </button>
                    </div>
                  )}

                  {selectedBatch && !!selectedBatchAggregatedPreview.length && (
                    <>
                      <InlineText style={{ marginTop: '12px' }}>
                        Pre-visualizacao dos produtos consolidados do lote:
                      </InlineText>
                      <List>
                        {selectedBatchAggregatedPreview.map((item) => (
                          <li key={`batch-item-${getReturnItemKey(item)}`}>
                            <span>
                              <strong>{item.product_id}</strong> - {item.product_description}
                              {` | Tipo: ${normalizeProductType(item.product_type) || 'N/A'} | Qtd total: ${item.quantity}`}
                            </span>
                          </li>
                        ))}
                      </List>
                    </>
                  )}

                  {!selectedBatch && (
                    <>
                      <div className="mt-4 min-w-0 md:max-w-[240px]">
                        <div className="min-w-0 md:w-[240px] md:shrink-0">
                          <InlineText>Data da devolucao</InlineText>
                          <input
                            type="date"
                            value={returnDate}
                            onChange={(event) => setReturnDate(event.target.value)}
                            className="w-full rounded-sm border border-border bg-card px-3 py-2 text-text"
                          />
                        </div>
                      </div>

                      {!!draftAggregatedItems.length && (
                        <>
                          <InlineText style={{ marginTop: '12px' }}>
                            Pre-visualizacao dos produtos consolidados: {draftAggregatedItems.length}
                          </InlineText>
                          <List>
                            {draftAggregatedItems.map((item) => (
                              <li key={`draft-item-${getReturnItemKey(item)}`}>
                                <span>
                                  <strong>{item.product_id}</strong> - {item.product_description}
                                  {` | Tipo: ${normalizeProductType(item.product_type) || 'N/A'} | Qtd total: ${item.quantity}`}
                                  {item.is_missing ? ' | FALTANTE' : ''}
                                  {item.keep_in_stock ? ' | FICA EM ESTOQUE' : ''}
                                </span>
                              </li>
                            ))}
                          </List>
                        </>
                      )}

                      <div className="mt-6 flex justify-end border-t border-border pt-5">
                        <button
                          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-600 px-7 py-3 text-base font-bold text-white shadow-soft transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[280px]"
                          onClick={handleConcludeBatch}
                          disabled={draftNotes.length === 0}
                          type="button"
                        >
                          <CheckCircle2 size={19} />
                          Concluir devolucao
                        </button>
                      </div>
                    </>
                  )}
                  </div>
                </Card>
                      </div>
                    </div>
                  </>
                )}

                {!!returnBatches.length && (
                  <Card>
                    <h2>Lotes encontrados ({returnBatches.length})</h2>
                    <List>
                      {returnBatches.map((batch) => {
                        const batchWorkflowStatus = resolveReturnBatchWorkflowStatus(batch);
                        const canEditBatch = batchWorkflowStatus === 'pending_transportadora';

                        return (
                          <li key={batch.batch_code}>
                            <BatchItemContent>
                              <span>
                                <strong>{batch.batch_code}</strong>
                                {` | Motorista: ${batch.Driver?.name || batch.driver_id}`}
                                {` | Placa: ${batch.vehicle_plate}`}
                                {` | Data: ${formatDateBR(batch.return_date)}`}
                                {` | NFs: ${batch.notes.length}`}
                                {` | Status: ${RETURN_BATCH_WORKFLOW_LABELS[batchWorkflowStatus]}`}
                              </span>
                              <BatchActionsRow>
                                <button className="secondary" onClick={() => handleOpenBatchPdf(batch)} type="button">
                                  Abrir PDF
                                </button>
                                {batchWorkflowStatus === 'pending_transportadora' && canManageBatchTransportadora && (
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmBatchSubmission(batch)}
                                    className="rounded-md border border-warning bg-warning px-4 py-[0.65rem] text-[0.82rem] font-bold text-white transition hover:brightness-110"
                                  >
                                    Confirmar envio
                                  </button>
                                )}
                                {isAdminUser && (
                                  <IconButton
                                    icon={History}
                                    label="Histórico do lote"
                                    onClick={() => handleViewBatchHistory(batch.batch_code)}
                                    className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0"
                                  />
                                )}
                                <IconButton
                                  icon={Pencil}
                                  label={canEditBatch ? 'Editar lote' : 'Abrir lote (somente leitura)'}
                                  onClick={() => handleOpenReturnBatchModal(batch.batch_code)}
                                  className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0"
                                />
                              </BatchActionsRow>
                            </BatchItemContent>
                          </li>
                        );
                      })}
                    </List>
                  </Card>
                )}

              </SingleColumn>
            )}

            {activeTab === 'occurrences' && (
              <SingleColumn>
                <Card>
                  <CardHeaderRow>
                    <h2>Ocorrencias Cadastradas</h2>
                    {canManageOccurrenceStatus && (
                      <button
                        onClick={openCreateOccurrenceBuilder}
                        type="button"
                        className="rounded-md border border-warning bg-warning px-4 py-[0.65rem] font-bold text-white transition hover:brightness-110"
                      >
                        Criar ocorrencia
                      </button>
                    )}
                  </CardHeaderRow>
                  {hasSavedOccurrenceDraft && canManageOccurrenceStatus ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border semantic-panel-info px-3 py-2 text-sm">
                      <span>Existe um rascunho de ocorrência salvo neste aparelho.</span>
                      <div className="flex gap-2">
                        <button type="button" className="primary" onClick={openCreateOccurrenceBuilder}>Continuar</button>
                        <button type="button" className="secondary" onClick={clearSavedOccurrenceDraft}>Descartar</button>
                      </div>
                    </div>
                  ) : null}
                  <Grid className="mt-[5px] grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <InlineText>Status</InlineText>
                      <select
                        value={isControlTowerUser ? 'awaiting_control_tower' : occurrenceStatusFilter}
                        onChange={(event) => setOccurrenceStatusFilter(event.target.value as OccurrenceWorkflowFilter)}
                        disabled={isControlTowerUser}
                      >
                        {isControlTowerUser ? (
                          <option value="awaiting_control_tower">Aguardando finalizacao (Talão)</option>
                        ) : (
                          <>
                            <option value="pending_transportadora">Pendentes da transportadora</option>
                            <option value="awaiting_control_tower">Aguardando finalizacao da torre</option>
                            <option value="finalized">Finalizadas</option>
                            <option value="all">Todas</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <InlineText>Filtro por NF</InlineText>
                      <input
                        value={occurrenceNfFilter}
                        onChange={(event) => setOccurrenceNfFilter(event.target.value)}
                        placeholder="Ex.: 12345"
                      />
                    </div>
                    <div>
                      <InlineText>Data inicial</InlineText>
                      <input
                        type="date"
                        value={occurrenceStartDate}
                        onChange={(event) => setOccurrenceStartDate(event.target.value)}
                      />
                    </div>
                    <div>
                      <InlineText>Data final</InlineText>
                      <input
                        type="date"
                        value={occurrenceEndDate}
                        onChange={(event) => setOccurrenceEndDate(event.target.value)}
                      />
                    </div>
                  </Grid>

                  {!occurrences.length ? (
                    <InlineText style={{ marginTop: '12px' }}>Nenhuma ocorrencia encontrada.</InlineText>
                  ) : (
                    <List>
                      {occurrences.map((occurrence) => {
                        const reasonLabel = OCCURRENCE_REASON_LABELS[occurrence.reason || 'legacy_outros'] || 'Legado / outros';
                        const occurrenceItemSummaries = buildOccurrenceCardItemSummary(occurrence);
                        const workflowStatus = occurrence.workflow_status || resolveOccurrenceWorkflowStatus(occurrence);
                        const workflowStatusLabel = OCCURRENCE_WORKFLOW_LABELS[workflowStatus];

                        return (
                          <li key={occurrence.id}>
                            <OccurrenceItemContent>
                              <span>
                                <strong>NF: {occurrence.invoice_number}</strong>
                                {` | CLIENTE: ${occurrence.customer_name || '-'}`}
                              </span>
                              <span>{`CIDADE: ${occurrence.city || '-'}`}</span>
                              {!isMissingCargoOccurrence(occurrence) ? (
                                <span className="flex flex-col gap-1">
                                  <strong>ITENS:</strong>
                                  {occurrenceItemSummaries.length ? (
                                    occurrenceItemSummaries.map((item, index) => (
                                      <span key={`occ-summary-${occurrence.id}-${item.label}-${index}`} className="pl-2">
                                        {item.label} | <strong>{`Qtd: ${item.quantityWithType}`}</strong>
                                      </span>
                                    ))
                                  ) : (
                                    <span className="pl-2">NF total</span>
                                  )}
                                </span>
                              ) : null}
                              <span>{`MOTIVO: ${reasonLabel}`}</span>
                              <MissingCargoOccurrenceDetails occurrence={occurrence} />
                              <span>{`STATUS: ${workflowStatusLabel}`}</span>
                              {occurrence.resolution_type && (
                                <span>
                                  Resolucao: {RESOLUTION_LABELS[occurrence.resolution_type] || occurrence.resolution_type}
                                  {occurrence.resolution_note ? ` | Obs: ${occurrence.resolution_note}` : ''}
                                </span>
                              )}

                              <OccurrenceCardFooter>
                                <OccurrenceActionsRow>
                                  <OccurrenceActionsLeft>
                                    {isOccurrencePendingForTransportadora(occurrence) && canManageOccurrenceStatus && (
                                      <>
                                        <button
                                          className="primary hidden md:inline-flex md:items-center md:gap-1.5 md:px-3"
                                          onClick={() => {
                                            setResolvingOccurrence(occurrence);
                                            setResolutionType('');
                                            setResolutionNote('');
                                          }}
                                          type="button"
                                        >
                                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                          Marcar como resolvida
                                        </button>
                                        <IconButton
                                          icon={CheckCircle2}
                                          label="Marcar ocorrência como resolvida"
                                          onClick={() => {
                                            setResolvingOccurrence(occurrence);
                                            setResolutionType('');
                                            setResolutionNote('');
                                          }}
                                          className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0 !border-accent/60 !bg-accent/20 !text-text-accent hover:!bg-accent/35 md:!hidden"
                                        />
                                      </>
                                    )}
                                  </OccurrenceActionsLeft>

                                  <OccurrenceActionsRight>
                                    {isOccurrencePendingForTransportadora(occurrence) && canManageOccurrenceStatus && (
                                      <IconButton
                                        icon={Pencil}
                                        label="Editar ocorrencia"
                                        onClick={() => startEditOccurrence(occurrence)}
                                        className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0"
                                      />
                                    )}
                                    {isAdminUser && (
                                      <IconButton
                                        icon={History}
                                        label="Histórico da ocorrência"
                                        onClick={() => handleViewOccurrenceHistory(occurrence.id)}
                                        className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0"
                                      />
                                    )}
                                    {canManageOccurrenceStatus && (
                                      <IconButton
                                        icon={Trash2}
                                        label="Excluir ocorrencia"
                                        variant="danger"
                                        onClick={() => handleDeleteOccurrence(occurrence.id)}
                                        className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0"
                                      />
                                    )}
                                  </OccurrenceActionsRight>
                                </OccurrenceActionsRow>
                              </OccurrenceCardFooter>
                            </OccurrenceItemContent>
                          </li>
                        );
                      })}
                    </List>
                  )}
                </Card>
              </SingleColumn>
            )}

            {isOccurrenceBuilderOpen && canManageOccurrenceStatus && (
              <>
                <ModalOverlay onClick={closeOccurrenceBuilder} />
                <ModalCard className="max-h-[88vh] w-[min(96vw,760px)] overflow-y-auto">
                  <button
                    type="button"
                    onClick={closeOccurrenceBuilder}
                    className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md border semantic-solid-danger transition hover:brightness-110"
                    aria-label="Fechar popup"
                    title="Fechar"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <h3 className="text-center">{editingOccurrenceId ? `Editar ocorrencia #${editingOccurrenceId}` : 'Registrar Ocorrencia'}</h3>
                  {!isOnline ? (
                    <div className="mt-3 rounded-md border semantic-panel-warning px-3 py-2 text-sm">
                      Sem conexão. Continue preenchendo: o rascunho fica salvo neste aparelho, mas o envio deve ser feito quando a internet voltar.
                    </div>
                  ) : null}
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
                        className="text-[1rem] tracking-[0.04em]"
                        wrapperClassName="mx-auto max-w-[280px] max-md:max-w-full"
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
                            onChange={async (event) => {
                              const nextProductCode = event.target.value;
                              const switchingToTotal = nextProductCode === OCCURRENCE_TOTAL_OPTION;

                              if (editingOccurrenceId && switchingToTotal && occurrenceItems.length) {
                                const confirmed = await showConfirm(
                                  'Deseja trocar a ocorrencia para NF total? Os itens selecionados serao removidos.',
                                  {
                                    title: 'Trocar escopo da ocorrência',
                                    confirmLabel: 'Trocar para NF total',
                                    cancelLabel: 'Cancelar',
                                  },
                                );
                                if (!confirmed) return;
                              }

                              setOccurrenceProductType('');
                              setOccurrenceProductCode(nextProductCode);
                            }}
                          >
                            <option value={OCCURRENCE_TOTAL_OPTION}>Total da NF</option>
                            {occurrenceDanfe.DanfeProducts.map((item) => (
                              <option key={`occ-select-${item.Product.code}`} value={item.Product.code}>
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
                                <option key={`occ-type-${typeOption}`} value={typeOption}>
                                  {typeOption}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      </Grid>

                      {!isOccurrenceTotal && (
                        <>
                          <div className="mt-2">
                            <div className="grid grid-cols-[minmax(150px,220px)_auto] items-end justify-start gap-2 max-[430px]:grid-cols-[minmax(118px,160px)_auto] max-[430px]:gap-1">
                              <div className="min-w-0">
                                <InlineText>Quantidade</InlineText>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={occurrenceQuantityInput}
                                  onChange={(event) => setOccurrenceQuantityInput(event.target.value)}
                                  disabled={!selectedOccurrenceProduct}
                                />
                              </div>
                              <button
                                className="mb-3 h-[42px] shrink-0 whitespace-nowrap rounded-md border border-border bg-surface px-3 font-semibold text-text disabled:cursor-not-allowed disabled:opacity-45 max-[430px]:px-2 max-[430px]:text-[0.8rem]"
                                onClick={addOccurrenceItem}
                                type="button"
                                disabled={!selectedOccurrenceProduct || occurrenceProductRemainingQty <= 0}
                              >
                                Adicionar item
                              </button>
                            </div>
                            {!!selectedOccurrenceProduct && (
                              <InfoText className="mt-1">
                                Limite da NF: {occurrenceProductMaxQty} | Restante: {occurrenceProductRemainingQty}
                              </InfoText>
                            )}
                          </div>
                          <List>
                            {!occurrenceItems.length ? (
                              <li>
                                <span>Nenhum item selecionado.</span>
                              </li>
                            ) : occurrenceItems.map((item) => (
                              <li key={`occ-item-${item.product_id}-${normalizeProductType(item.product_type) || 'NA'}`}>
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
                    {occurrenceDanfe && (
                      <button className="primary" onClick={handleCreateOrEditOccurrence} type="button" disabled={!isOnline}>
                        {editingOccurrenceId ? 'Salvar alteracoes' : 'Registrar ocorrencia'}
                      </button>
                    )}
                  </Actions>
                </ModalCard>
              </>
            )}

            {resolvingOccurrence && (
              <>
                <ModalOverlay onClick={() => setResolvingOccurrence(null)} />
                <ModalCard>
                  <h3>Resolver ocorrencia #{resolvingOccurrence.id}</h3>
                  <InlineText>
                    Motivo: {OCCURRENCE_REASON_LABELS[resolvingOccurrence.reason || 'legacy_outros'] || 'Legado / outros'}
                  </InlineText>
                  <InlineText style={{ marginTop: '10px' }}>Como foi resolvida?</InlineText>
                  <select
                    value={resolutionType}
                    onChange={(event) => setResolutionType(event.target.value)}
                    style={{ width: '100%', marginTop: 6, minHeight: 40 }}
                  >
                    <option value="">Selecione</option>
                    {availableResolutionOptions.map((option) => (
                      <option key={`res-${option.value}`} value={option.value}>{option.label}</option>
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
                    <button className="secondary" onClick={() => setResolvingOccurrence(null)} type="button">Cancelar</button>
                  </Actions>
                </ModalCard>
              </>
            )}

          </section>

          {historyModalOpen && (
            <>
              <ModalOverlay onClick={() => setHistoryModalOpen(false)} />
              <ModalCard>
                <h3>{historyModalTitle}</h3>
                {!historyEntries.length ? (
                  <InlineText>Nenhum evento de historico encontrado.</InlineText>
                ) : (
                  <List>
                    {historyEntries.map((entry) => (
                      <li key={entry.id}>
                        <span>
                          <strong>{entry.action}</strong>
                          {` | Usuario: ${entry.actor_username || entry.actor_user_id || 'nao identificado'}`}
                          {` | Data: ${formatDateTimeBR(entry.created_at)}`}
                        </span>
                      </li>
                    ))}
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
        </PageContainer>
      </Container>
    </div>
  );
}

export default ReturnsOccurrences;
