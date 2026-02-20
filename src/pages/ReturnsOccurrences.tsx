import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import { useSearchParams } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import { CheckCircle2, History, Pencil, Trash2, X } from 'lucide-react';

import Header from '../components/Header';
import ReturnReceiptPDF from '../components/ReturnReceiptPDF';
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
import { ICar, IDanfe, IDriver, IInvoiceReturn, IInvoiceReturnItem, IOccurrence, IProduct, IReturnBatch } from '../types/types';
import verifyToken from '../utils/verifyToken';
import { formatDateBR } from '../utils/dateDisplay';

const DEFAULT_RETURN_UNIT_TYPES = ['UN', 'CX', 'FD', 'KG', 'PCT'];
const RETURN_BATCH_LOOKBACK_OPTIONS = [
  { value: '7', label: 'Ultimos 7 dias' },
  { value: '30', label: 'Ultimos 30 dias' },
] as const;
type ReturnBatchLookbackValue = (typeof RETURN_BATCH_LOOKBACK_OPTIONS)[number]['value'];

const OCCURRENCE_REASONS = [
  { value: 'faltou_no_carregamento', label: 'Faltou no carregamento' },
  { value: 'faltou_na_carga', label: 'Faltou na carga' },
  { value: 'produto_avariado', label: 'Produto avariado' },
  { value: 'produto_invertido', label: 'Produto invertido' },
  { value: 'produto_sem_etiqueta_ou_data', label: 'Produto sem etiqueta de identificacao ou data' },
] as const;

const OCCURRENCE_TOTAL_OPTION = '__INVOICE_TOTAL__';

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
type OccurrenceCardItemSummary = {
  label: string;
  quantityWithType: string;
};
type SurplusInversionDraft = {
  invoice_number: string;
  missing_product_code: string;
};
type ReturnDraftNote = {
  invoice_number: string;
  return_type: 'total' | 'partial' | 'sobra' | 'coleta';
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
const sanitizeSurplusReferenceToken = (value: string, fallback = 'SEMVALOR') => {
  const normalized = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized || fallback;
};
const buildSurplusReferenceInvoiceNumber = (loadNumber: string, productCode: string) => (
  `SOBRA-${sanitizeSurplusReferenceToken(loadNumber, 'SEMCARGA')}-${sanitizeSurplusReferenceToken(productCode, 'SEMPRODUTO')}`
);
const formatOccurrenceQtyWithType = (quantity: number, productType?: string | null) => {
  const normalizedType = normalizeProductType(productType);
  return `${Number(quantity || 0)}${normalizedType || ''}`;
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
const getReturnItemKey = (item: Pick<IInvoiceReturnItem, 'product_id' | 'product_type'>) => (
  `${item.product_id}::${normalizeProductType(item.product_type)}`
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

  const [returnNf, setReturnNf] = useState('');
  const [returnDanfe, setReturnDanfe] = useState<IDanfe | null>(null);
  const [returnType, setReturnType] = useState<'total' | 'partial' | 'sobra' | 'coleta'>('total');
  const [partialProductCode, setPartialProductCode] = useState('');
  const [partialProductType, setPartialProductType] = useState('');
  const [partialQuantity, setPartialQuantity] = useState<number>(1);
  const [partialItems, setPartialItems] = useState<IInvoiceReturnItem[]>([]);
  const [leftoverProductCode, setLeftoverProductCode] = useState('');
  const [leftoverQuantity, setLeftoverQuantity] = useState<number>(1);
  const [leftoverProductType, setLeftoverProductType] = useState('');
  const [leftoverLoadNumber, setLeftoverLoadNumber] = useState('');
  const [leftoverIsInversion, setLeftoverIsInversion] = useState(false);
  const [leftoverInversionInvoiceNumber, setLeftoverInversionInvoiceNumber] = useState('');
  const [leftoverInversionMissingProductCode, setLeftoverInversionMissingProductCode] = useState('');
  const [leftoverInversionDanfe, setLeftoverInversionDanfe] = useState<IDanfe | null>(null);
  const [leftoverInversionLookupLoading, setLeftoverInversionLookupLoading] = useState(false);
  const [leftoverInversionLookupError, setLeftoverInversionLookupError] = useState('');
  const [draftNotes, setDraftNotes] = useState<ReturnDraftNote[]>([]);
  const [returnDriverId, setReturnDriverId] = useState('');
  const [selectedCarId, setSelectedCarId] = useState('');
  const [returnDate, setReturnDate] = useState(getTodayDate());

  const [batchLookbackDays, setBatchLookbackDays] = useState<ReturnBatchLookbackValue>('7');
  const [returnBatches, setReturnBatches] = useState<IReturnBatch[]>([]);
  const [selectedBatchCode, setSelectedBatchCode] = useState('');
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
  const [occurrences, setOccurrences] = useState<IOccurrence[]>([]);
  const [occurrenceStatusFilter, setOccurrenceStatusFilter] = useState<OccurrenceWorkflowFilter>('pending_transportadora');
  const [occurrenceNfFilter, setOccurrenceNfFilter] = useState('');
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

  function setTab(nextTab: 'returns' | 'occurrences') {
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
    if (!selectedBatch) {
      setBatchDraftNotes([]);
      return;
    }

    setBatchDraftNotes(selectedBatch.notes);
  }, [selectedBatch]);

  const selectedBatchHasUnsavedChanges = useMemo(() => {
    if (!selectedBatch) {
      return false;
    }

    const originalInvoices = selectedBatch.notes.map((note) => note.invoice_number).sort();
    const draftInvoices = batchDraftNotes.map((note) => note.invoice_number).sort();

    if (originalInvoices.length !== draftInvoices.length) {
      return true;
    }

    return originalInvoices.some((invoiceNumber, index) => invoiceNumber !== draftInvoices[index]);
  }, [selectedBatch, batchDraftNotes]);

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

  const isSelectedPartialProductKg = useMemo(() => {
    if (!selectedPartialDanfeProduct || !partialProductType) {
      return false;
    }

    return normalizeProductType(partialProductType).includes('KG');
  }, [selectedPartialDanfeProduct, partialProductType]);

  const selectedPartialMinQty = isSelectedPartialProductKg ? 0.1 : 1;
  const selectedPartialMaxQty = selectedPartialDanfeProduct ? Number(selectedPartialDanfeProduct.quantity) : 0;
  const selectedPartialAlreadyAddedQty = partialProductCode && partialProductType
    ? partialItems
      .filter((item) => (
        item.product_id === partialProductCode
        && normalizeProductType(item.product_type) === normalizeProductType(partialProductType)
      ))
      .reduce((sum, item) => sum + Number(item.quantity), 0)
    : 0;
  const selectedPartialRemainingQty = Math.max(0, selectedPartialMaxQty - selectedPartialAlreadyAddedQty);
  const selectedPartialStep = isSelectedPartialProductKg ? 0.1 : 1;
  const selectedLeftoverProduct = useMemo(() => (
    products.find((product) => product.code === leftoverProductCode) || null
  ), [products, leftoverProductCode]);
  const leftoverInversionProducts = useMemo(() => (
    leftoverInversionDanfe?.DanfeProducts || []
  ), [leftoverInversionDanfe]);
  const selectedLeftoverMissingProduct = useMemo(() => (
    leftoverInversionProducts.find((item) => item.Product.code === leftoverInversionMissingProductCode) || null
  ), [leftoverInversionProducts, leftoverInversionMissingProductCode]);
  const surplusInversionSummary = useMemo(() => {
    if (!leftoverIsInversion) return '';

    const surplusProductCode = leftoverProductCode.trim().toUpperCase();
    const missingProductCode = leftoverInversionMissingProductCode.trim().toUpperCase();
    const invoiceNumber = leftoverInversionInvoiceNumber.trim();

    if (!surplusProductCode || !missingProductCode || !invoiceNumber) return '';
    return `Inversao: Veio ${surplusProductCode} (sobra) no lugar de ${missingProductCode} (falta) na NF ${invoiceNumber}`;
  }, [leftoverIsInversion, leftoverProductCode, leftoverInversionMissingProductCode, leftoverInversionInvoiceNumber]);
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
  const getReturnTypeLabel = (value: 'total' | 'partial' | 'sobra' | 'coleta') => {
    if (value === 'total') return 'Total';
    if (value === 'partial') return 'Parcial';
    if (value === 'coleta') return 'Coleta';
    return 'Sobra';
  };
  const getNoteDisplayLabel = (note: {
    invoice_number: string;
    return_type: 'total' | 'partial' | 'sobra' | 'coleta';
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
    return_type: 'total' | 'partial' | 'sobra' | 'coleta';
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
    return_type: 'total' | 'partial' | 'sobra' | 'coleta';
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
      return_type: 'total' | 'partial' | 'sobra' | 'coleta';
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
  const occurrenceQuantityStep = occurrenceProductIsKg ? 0.1 : 1;
  const occurrenceQuantityMin = occurrenceProductIsKg ? 0.1 : 1;
  const occurrenceProductMaxQty = selectedOccurrenceProduct ? Number(selectedOccurrenceProduct.quantity) : 0;
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
      return;
    }

    const defaultType = normalizeProductType(selectedPartialDanfeProduct.type)
      || normalizeProductType(selectedPartialDanfeProduct.Product.type)
      || DEFAULT_RETURN_UNIT_TYPES[0];

    setPartialProductType(defaultType);
  }, [partialProductCode, selectedPartialDanfeProduct]);

  useEffect(() => {
    if (!partialProductCode || !partialProductType) {
      setPartialQuantity(1);
      return;
    }

    setPartialQuantity(normalizeProductType(partialProductType).includes('KG') ? 0.1 : 1);
  }, [partialProductCode, partialProductType]);

  useEffect(() => {
    if (!occurrenceProductCode || !selectedOccurrenceProduct || isOccurrenceTotal) {
      setOccurrenceProductType('');
      setOccurrenceQuantityInput('1');
      return;
    }

    const defaultType = normalizeProductType(selectedOccurrenceProduct.type || selectedOccurrenceProduct.Product.type)
      || DEFAULT_RETURN_UNIT_TYPES[0];
    setOccurrenceProductType((current) => normalizeProductType(current) || defaultType);
    setOccurrenceQuantityInput(defaultType.includes('KG') ? '0.1' : '1');
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
    setLeftoverInversionDanfe(null);
    setLeftoverInversionLookupError('');
    setLeftoverInversionLookupLoading(false);
  }, [leftoverIsInversion]);

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
      await Promise.all([loadDrivers(), loadCars(), loadProducts(), loadOccurrences(), loadReturnBatches()]);
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

  async function loadProducts() {
    try {
      const { data } = await axios.get(`${API_URL}/products`);
      setProducts(data);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  }

  async function loadReturnBatches(lookbackDaysOverride?: ReturnBatchLookbackValue | number) {
    try {
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

  async function handleLoadLatestBatches() {
    await loadReturnBatches(batchLookbackDays);
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
    return data;
  }

  function resetSurplusInversionBuilder() {
    setLeftoverIsInversion(false);
    setLeftoverInversionInvoiceNumber('');
    setLeftoverInversionMissingProductCode('');
    setLeftoverInversionDanfe(null);
    setLeftoverInversionLookupError('');
    setLeftoverInversionLookupLoading(false);
  }

  function handleChangeReturnType(nextType: 'total' | 'partial' | 'sobra' | 'coleta') {
    setReturnType(nextType);

    if (nextType === 'sobra') {
      setReturnDanfe(null);
      setPartialItems([]);
      setPartialProductCode('');
      setPartialProductType('');
      setPartialQuantity(1);
      return;
    }

    setLeftoverProductCode('');
    setLeftoverQuantity(1);
    setLeftoverProductType('');
    setLeftoverLoadNumber('');
    resetSurplusInversionBuilder();
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

  async function handleSearchReturnNf() {
    if (returnType === 'sobra') {
      alert('Para sobra, informe codigo, quantidade e tipo do produto.');
      return;
    }

    if (!returnNf.trim()) {
      alert('Digite a NF para buscar.');
      return;
    }

    try {
      const data = await findDanfeByNf(returnNf.trim());

      if (!data) {
        alert('NF nao encontrada.');
        return;
      }

      setReturnDanfe(data);
      setPartialItems([]);
      setPartialProductCode('');
      setPartialProductType('');
      setPartialQuantity(1);
    } catch (error) {
      console.error(error);
      alert('Erro ao buscar NF para devolucao.');
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

    if (!partialQuantity || partialQuantity <= 0) {
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
    const minAllowed = isKg ? 0.1 : 1;
    const maxAllowed = Number(foundProduct.quantity);
    const existingQty = partialItems
      .filter((item) => (
        item.product_id === foundProduct.Product.code
        && normalizeProductType(item.product_type) === normalizedType
      ))
      .reduce((sum, item) => sum + Number(item.quantity), 0);

    if (!isKg && !Number.isInteger(partialQuantity)) {
      alert('Para este produto, use apenas quantidades inteiras.');
      return;
    }

    const normalizedQuantity = isKg
      ? Math.round(Number(partialQuantity) * 10) / 10
      : Number(partialQuantity);

    if (normalizedQuantity < minAllowed) {
      alert(`Quantidade minima permitida para este produto: ${minAllowed}.`);
      return;
    }

    if (normalizedQuantity + existingQty > maxAllowed) {
      const remaining = Math.max(0, maxAllowed - existingQty);
      alert(`Quantidade excede o limite da NF, de: ${remaining}.`);
      return;
    }

    setPartialItems((previous) => {
      const existingItem = previous.find((item) => (
        item.product_id === foundProduct.Product.code
        && normalizeProductType(item.product_type) === normalizedType
      ));
      if (!existingItem) {
        return [
          ...previous,
          {
            product_id: foundProduct.Product.code,
            product_description: foundProduct.Product.description,
            product_type: normalizedType,
            quantity: normalizedQuantity,
          },
        ];
      }

      return previous.map((item) => (
        item.product_id === foundProduct.Product.code
          && normalizeProductType(item.product_type) === normalizedType
          ? { ...item, quantity: Number(item.quantity) + normalizedQuantity }
          : item
      ));
    });

    setPartialQuantity(minAllowed);
  }

  function removePartialItem(productId: string, productType?: string | null) {
    const normalizedType = normalizeProductType(productType);
    setPartialItems((previous) => previous.filter((item) => !(
      item.product_id === productId
      && normalizeProductType(item.product_type) === normalizedType
    )));
  }

  function getCurrentNoteItems() {
    if (returnType === 'sobra') {
      const normalizedCode = leftoverProductCode.trim().toUpperCase();
      const normalizedType = leftoverProductType.trim().toUpperCase();

      if (!normalizedCode) {
        alert('Informe o codigo do produto da sobra.');
        return [];
      }

      if (!leftoverQuantity || Number(leftoverQuantity) <= 0) {
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
        quantity: Math.round(Number(leftoverQuantity) * 1000) / 1000,
      }];
    }

    if (!returnDanfe) {
      return [];
    }

    if (returnType === 'total') {
      return returnDanfe.DanfeProducts.map((item) => ({
        product_id: item.Product.code,
        product_description: item.Product.description,
        product_type: normalizeProductType(item.type) || normalizeProductType(item.Product.type) || null,
        quantity: Number(item.quantity),
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

    if (returnType !== 'sobra' && !returnDanfe) {
      alert('Busque uma NF para adicionar na lista.');
      return;
    }

    const noteItems = getCurrentNoteItems();
    if (!noteItems.length) {
      if (returnType === 'partial' || returnType === 'coleta') {
        alert(`Adicione ao menos um item na devolucao ${returnType === 'coleta' ? 'de coleta' : 'parcial'}.`);
      }
      return;
    }

    let noteLoadNumber: string | null = null;
    let noteIsInversion = false;
    let noteInversion: SurplusInversionDraft | undefined;

    if (returnType === 'sobra') {
      const normalizedLoadNumber = leftoverLoadNumber.trim().toUpperCase();
      if (!normalizedLoadNumber) {
        alert('Informe o numero da carga da sobra.');
        return;
      }

      noteLoadNumber = normalizedLoadNumber;

      if (leftoverIsInversion) {
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

        noteIsInversion = true;
        noteInversion = {
          invoice_number: relatedInvoice,
          missing_product_code: missingProductCode,
        };
      }
    }

    const noteInvoiceNumber = returnType === 'sobra'
      ? buildSurplusReferenceInvoiceNumber(noteLoadNumber || '', noteItems[0].product_id)
      : String(returnDanfe?.invoice_number);

    if (selectedBatch) {
      const existsInBatch = batchDraftNotes.some((note) => note.invoice_number === noteInvoiceNumber);
      if (existsInBatch) {
        alert(returnType === 'sobra'
          ? 'Essa sobra ja existe no lote selecionado.'
          : 'Essa NF ja existe no lote selecionado.');
        return;
      }

      setBatchDraftNotes((previous) => ([
        ...previous,
        {
          id: -(Date.now()),
          invoice_number: noteInvoiceNumber,
          return_type: returnType,
          driver_id: Number(selectedBatch.driver_id),
          vehicle_plate: selectedBatch.vehicle_plate,
          return_date: selectedBatch.return_date,
          batch_code: selectedBatch.batch_code,
          batch_status: selectedBatch.batch_status,
          load_number: noteLoadNumber,
          is_inversion: noteIsInversion,
          ...(noteInversion
            ? {
              inversion_invoice_number: noteInversion.invoice_number,
              inversion_missing_product_code: noteInversion.missing_product_code,
              inversion: noteInversion,
            }
            : {}),
          items: noteItems,
        },
      ]));

      alert(returnType === 'sobra'
        ? 'Sobra adicionada na edicao do lote. Clique em "Salvar lote" para persistir.'
        : 'NF adicionada na edicao do lote. Clique em "Salvar lote" para persistir.');
      clearNfBuilder();
      return;
    }

    const existsInDraft = draftNotes.some((note) => note.invoice_number === noteInvoiceNumber);
    if (existsInDraft) {
      alert(returnType === 'sobra'
        ? 'Essa sobra ja esta na lista atual.'
        : 'Essa NF ja esta na lista atual.');
      return;
    }

    setDraftNotes((previous) => ([
      ...previous,
      {
        invoice_number: noteInvoiceNumber,
        return_type: returnType,
        load_number: noteLoadNumber,
        is_inversion: noteIsInversion,
        ...(noteInversion ? { inversion: noteInversion } : {}),
        items: noteItems,
      },
    ]));

    clearNfBuilder();
  }

  function clearNfBuilder() {
    setReturnNf('');
    setReturnDanfe(null);
    setReturnType('total');
    setPartialItems([]);
    setPartialProductCode('');
    setPartialProductType('');
    setPartialQuantity(1);
    setLeftoverProductCode('');
    setLeftoverQuantity(1);
    setLeftoverProductType('');
    setLeftoverLoadNumber('');
    resetSurplusInversionBuilder();
  }

  function removeDraftNf(invoiceNumber: string) {
    setDraftNotes((previous) => previous.filter((note) => note.invoice_number !== invoiceNumber));
  }

  function handleCreateNewBatch() {
    setSelectedBatchCode('');
    setDraftNotes([]);
    clearNfBuilder();
    setReturnDriverId('');
    setSelectedCarId('');
    setReturnDate(getTodayDate());
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

    const notesToAdd = batchDraftNotes.filter((note) => !originalInvoices.has(note.invoice_number));
    const notesToRemove = originalNotes.filter((note) => !draftInvoices.has(note.invoice_number));

    if (!notesToAdd.length && !notesToRemove.length) {
      alert('Nenhuma alteracao para salvar no lote.');
      return;
    }

    try {
      await Promise.all(notesToRemove.map((note) => axios.delete(`${API_URL}/returns/notes/${note.id}`)));
      await Promise.all(notesToAdd.map((note) => (
        axios.post(
          `${API_URL}/returns/batches/${selectedBatch.batch_code}/add-note`,
          serializeReturnNotePayload(note),
        )
      )));

      alert('Lote salvo com sucesso.');
      await loadReturnBatches();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar alteracoes do lote.');
    }
  }

  async function handleConfirmBatchSubmission() {
    if (!selectedBatch) {
      return;
    }

    if (selectedBatchHasUnsavedChanges) {
      alert('Salve as alteracoes do lote antes de confirmar o envio.');
      return;
    }

    if (!canManageBatchTransportadora || selectedBatchWorkflowStatus !== 'pending_transportadora') {
      alert('Apenas lotes pendentes da transportadora podem ser confirmados para envio.');
      return;
    }

    const confirmed = window.confirm(
      'Ao confirmar o envio da devolucao, este lote nao podera mais ser editado. Deseja continuar?',
    );
    if (!confirmed) {
      return;
    }

    try {
      await axios.put(`${API_URL}/returns/batches/${selectedBatch.batch_code}/confirm-submission`);
      alert('Envio do lote confirmado. O lote agora aguarda confirmacao da Torre de Controle.');
      await loadReturnBatches();
    } catch (error) {
      console.error(error);
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

    const confirmed = window.confirm(
      'Confirma que a Torre de Controle recebeu esta devolucao e deseja finalizar o lote?',
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

  function openCreateOccurrenceBuilder() {
    resetOccurrenceBuilder();
    setIsOccurrenceBuilderOpen(true);
  }

  function closeOccurrenceBuilder() {
    setIsOccurrenceBuilderOpen(false);
    resetOccurrenceBuilder();
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

    const parsedQuantity = Number(rawQuantity.replace(',', '.'));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      alert('Informe uma quantidade valida.');
      return;
    }

    if (!occurrenceProductIsKg && !Number.isInteger(parsedQuantity)) {
      alert('Para este produto, utilize quantidade inteira.');
      return;
    }

    const normalizedQty = occurrenceProductIsKg
      ? Math.round(parsedQuantity * 10) / 10
      : parsedQuantity;

    if (normalizedQty < occurrenceQuantityMin) {
      alert(`Quantidade minima permitida: ${occurrenceQuantityMin}.`);
      return;
    }

    if (normalizedQty + occurrenceProductAlreadyAddedQty > occurrenceProductMaxQty) {
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
      closeOccurrenceBuilder();
      await loadOccurrences();
    } catch (error) {
      console.error(error);
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
    const confirmed = window.confirm('Deseja realmente excluir esta ocorrencia? O historico sera preservado.');
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
          <TabsRow className="max-[768px]:gap-2">
            <Tabs className="w-auto">
              <button
                className={`relative -mb-px rounded-t-[10px] border px-4 py-2 text-sm font-semibold transition ${activeTab === 'returns'
                  ? 'z-10 border-border border-b-transparent bg-surface/70 text-text shadow-none after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-surface/70 after:content-[""]'
                  : 'border-white/10 bg-[rgba(6,14,25,0.95)] text-muted shadow-[0_6px_12px_rgba(2,8,16,0.28)] hover:text-text'
                  }`}
                onClick={() => setTab('returns')}
                type="button"
              >
                Devolucoes
              </button>
              <button
                className={`relative -mb-px rounded-t-[10px] border px-4 py-2 text-sm font-semibold transition ${activeTab === 'occurrences'
                  ? 'z-10 border-border border-b-transparent bg-surface/70 text-text shadow-none after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-surface/70 after:content-[""]'
                  : 'border-white/10 bg-[rgba(6,14,25,0.95)] text-muted shadow-[0_6px_12px_rgba(2,8,16,0.28)] hover:text-text'
                  }`}
                onClick={() => setTab('occurrences')}
                type="button"
              >
                Ocorrencias
              </button>
            </Tabs>
            {activeTab === 'returns' && (
              <div className="ml-auto flex w-full flex-col gap-2 min-[860px]:w-auto min-[860px]:flex-row min-[860px]:items-center">
                <div className="min-w-0 min-[860px]:w-[190px]">
                  <select
                    value={batchLookbackDays}
                    onChange={(event) => setBatchLookbackDays(event.target.value as ReturnBatchLookbackValue)}
                    className="h-10 w-full rounded-sm border border-white/15 bg-[rgba(11,27,42,0.7)] px-3 text-sm text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                    aria-label="Periodo de devolucoes"
                  >
                    {RETURN_BATCH_LOOKBACK_OPTIONS.map((option) => (
                      <option key={`return-lookback-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleLoadLatestBatches}
                  className="h-10 rounded-md border border-[#ffca3a]/70 bg-[linear-gradient(135deg,#ffe082_0%,#ffca3a_45%,#ff9f1c_100%)] px-4 text-[0.85rem] font-bold text-[#1f1300] transition hover:brightness-105"
                >
                  Trazer ultimas devolucoes
                </button>
              </div>
            )}
          </TabsRow>

          <section className="-mt-px w-full min-w-0 rounded-b-lg rounded-tr-lg border border-border border-t-0 bg-surface/70 p-3 shadow-[var(--shadow-2)]">
            {activeTab === 'returns' && (
              <SingleColumn>
                {selectedBatch && (
                  <TopActionBar>
                    <button className="secondary" onClick={handleCreateNewBatch} type="button">
                      Criar novo lote
                    </button>
                    <button className="secondary" onClick={() => handleOpenBatchPdf(selectedBatch)} type="button">
                      Abrir PDF
                    </button>
                    {selectedBatchWorkflowStatus === 'pending_transportadora' && canManageBatchTransportadora && (
                      <button
                        type="button"
                        onClick={handleConfirmBatchSubmission}
                        className="rounded-md border border-amber-500/70 bg-[linear-gradient(135deg,#ffd166_0%,#f7b733_100%)] px-4 py-[0.65rem] text-[0.82rem] font-bold text-[#2b1b00] transition hover:brightness-105"
                      >
                        Confirmar envio da devolucao
                      </button>
                    )}
                    {isSelectedBatchAwaitingControlTower && canConfirmBatchReceipt && (
                      <button
                        type="button"
                        onClick={handleConfirmBatchReceipt}
                        className="rounded-md border border-emerald-500/70 bg-[linear-gradient(135deg,#9ae6b4_0%,#38a169_100%)] px-4 py-[0.65rem] text-[0.82rem] font-bold text-[#052814] transition hover:brightness-105"
                      >
                        Confirmar recebimento da devolucao
                      </button>
                    )}
                  </TopActionBar>
                )}

                <Card>
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
                    {selectedBatch ? (
                      <>
                        <InlineText>
                          Motorista: {selectedBatch.Driver?.name || selectedBatch.driver_id} | Placa: {selectedBatch.vehicle_plate} | Data: {formatDateBR(selectedBatch.return_date)}
                        </InlineText>
                        <InlineText>
                          Status do lote: {RETURN_BATCH_WORKFLOW_LABELS[selectedBatchWorkflowStatus || 'pending_transportadora']}
                          {selectedBatch.sent_to_control_tower_at ? ` | Enviado em: ${formatDateBR(selectedBatch.sent_to_control_tower_at)}` : ''}
                          {selectedBatch.received_by_control_tower_at ? ` | Recebido em: ${formatDateBR(selectedBatch.received_by_control_tower_at)}` : ''}
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
                        {isSelectedBatchEditableByTransportadora && (
                          <>
                            <InfoText>
                              Lote em rascunho: NFs adicionadas aqui ainda nao bloqueiam coleta/ocorrencia ate a confirmacao do envio.
                            </InfoText>
                            <InfoText>
                              Ao confirmar o envio da devolucao, o lote sera bloqueado para edicao.
                            </InfoText>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <InlineText className="max-[768px]:hidden">Busque NF ou cadastre sobra, escolha o tipo e adicione na lista.</InlineText>
                        <InlineText className="hidden max-[768px]:block">Busque a NF, escolha o tipo e adicione na lista.</InlineText>
                      </>
                    )}

                  </BoxDescription>
                  <InlineText style={{ margin: '10px 0 6px 0' }}>NF + tipo de devolucao</InlineText>
                  <div className="space-y-2">
                    <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-end md:gap-3">
                      <div className="min-w-0 md:w-[220px] md:shrink-0">
                        {returnType === 'sobra' ? (
                          <div className="rounded-md border border-white/10 bg-[rgba(11,27,42,0.6)] px-3 py-[11px] text-[0.82rem] text-slate-300">
                            Cadastro manual de sobra
                          </div>
                        ) : (
                          <SearchInput
                            type="text"
                            inputMode="numeric"
                            value={returnNf}
                            onChange={(event) => setReturnNf(event.target.value.replace(/\D/g, '').slice(0, 9))}
                            placeholder="Digite a NF"
                            maxLength={9}
                            onSearch={handleSearchReturnNf}
                            searchLabel="Buscar NF de devolucao"
                            className="border-white/10 bg-[rgba(11,27,42,0.6)] tracking-[0.03em]"
                          />
                        )}
                      </div>
                      <ReturnSearchRow className="md:min-w-0 md:flex-1 md:flex-nowrap md:items-center md:gap-3 md:[&_label]:px-1 md:[&_label]:text-[0.86rem] md:[&_label]:leading-none">
                        <label>
                          <input
                            type="checkbox"
                            checked={returnType === 'total'}
                            onChange={() => handleChangeReturnType('total')}
                          />
                          Total
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={returnType === 'partial'}
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

                      {(returnType === 'partial' || returnType === 'coleta') && returnDanfe && (
                        <>
                          <Grid style={{ marginTop: '12px' }}>
                            <div>
                              <InlineText>Produto</InlineText>
                              <select
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
                                type="number"
                                min={selectedPartialMinQty}
                                max={selectedPartialRemainingQty || undefined}
                                step={selectedPartialStep}
                                value={partialQuantity}
                                onChange={(event) => setPartialQuantity(Number(event.target.value))}
                              />
                              {!!partialProductCode && (
                                <InfoText>
                                  Limite da NF para o tipo selecionado: {selectedPartialMaxQty} | Restante para adicionar: {selectedPartialRemainingQty}
                                </InfoText>
                              )}
                            </div>
                          </Grid>
                          <Actions style={{ marginTop: '12px' }}>
                            <button
                              className="bg-[linear-gradient(135deg,#ffe082_0%,#ffca3a_45%,#ff9f1c_100%)] text-[#1f1300]"
                              onClick={addPartialItem}
                              disabled={!partialProductCode || !partialProductType || selectedPartialRemainingQty <= 0}
                              type="button"
                            >
                              {returnType === 'coleta' ? 'Adicionar item de coleta' : 'Adicionar item parcial'}
                            </button>
                          </Actions>
                        </>
                      )}

                      {!!partialItems.length && (returnType === 'partial' || returnType === 'coleta') && returnDanfe && (
                        <List>
                          {partialItems.map((item, index) => (
                            <li key={`${getReturnItemKey(item)}-${index}`}>
                              <span>
                                <strong>{item.product_id}</strong> - {item.product_description}
                                {` | Tipo: ${normalizeProductType(item.product_type) || 'N/A'} | Qtd: ${item.quantity}`}
                              </span>
                              <Actions>
                                <button className="danger" onClick={() => removePartialItem(item.product_id, item.product_type)} type="button">Remover</button>
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
                                onChange={(event) => setLeftoverProductCode(event.target.value.toUpperCase())}
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
                                type="number"
                                min={0.1}
                                step={0.1}
                                value={leftoverQuantity}
                                onChange={(event) => setLeftoverQuantity(Number(event.target.value))}
                              />
                            </div>
                            <div>
                              <InlineText>Tipo *</InlineText>
                              <select
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

                          <div className="mt-3 rounded-md border border-white/10 bg-[rgba(11,27,42,0.45)] px-3 py-2">
                            <label className="flex cursor-pointer items-start gap-2 text-[0.83rem] text-slate-200">
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
                                      className="h-10 rounded-md border border-[#ffca3a]/70 bg-[linear-gradient(135deg,#ffe082_0%,#ffca3a_45%,#ff9f1c_100%)] px-3 text-[0.75rem] font-semibold text-[#1f1300] transition disabled:cursor-not-allowed disabled:opacity-60"
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
                              </Grid>
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

                  <ListHeaderRow>
                    <h2 style={{ marginTop: '18px' }}>Lista de NFs</h2>
                    {selectedBatch && (
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
                            <Actions>
                              <button
                                className="danger"
                                onClick={() => handleRemoveNoteFromBatch(note.id)}
                                disabled={!isSelectedBatchEditableByTransportadora}
                                type="button"
                              >
                                Remover NF
                              </button>
                            </Actions>
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
                      <Grid style={{ marginTop: '12px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                        <div>
                          <InlineText>Motorista</InlineText>
                          <select value={returnDriverId} onChange={(event) => setReturnDriverId(event.target.value)}>
                            <option value="">Selecione</option>
                            {drivers.map((driver) => (
                              <option key={driver.id} value={driver.id}>{driver.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <InlineText>Veiculo / Placa</InlineText>
                          <select value={selectedCarId} onChange={(event) => setSelectedCarId(event.target.value)}>
                            <option value="">Selecione</option>
                            {cars.map((car) => (
                              <option key={car.id} value={car.id}>
                                {car.model} - {car.license_plate}
                              </option>
                            ))}
                          </select>
                        </div>
                      </Grid>

                      <div className="mt-3 flex min-w-0 flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div className="min-w-0 md:w-[240px] md:shrink-0">
                          <InlineText>Data da devolucao</InlineText>
                          <input
                            type="date"
                            value={returnDate}
                            onChange={(event) => setReturnDate(event.target.value)}
                            className="w-full rounded-sm border border-white/10 bg-[rgba(11,27,42,0.6)] px-3 py-2 text-text"
                          />
                        </div>
                        <Actions className="md:justify-end">
                          <button className="primary" onClick={handleConcludeBatch} disabled={draftNotes.length === 0} type="button">
                            Concluir devolucao
                          </button>
                        </Actions>
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
                                </span>
                              </li>
                            ))}
                          </List>
                        </>
                      )}
                    </>
                  )}
                </Card>

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
                                  onClick={() => setSelectedBatchCode(batch.batch_code)}
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
                        className="rounded-md border border-amber-500/60 bg-[linear-gradient(135deg,#ffba2b_0%,#ff7a18_100%)] px-4 py-[0.65rem] font-bold text-[#1f1300] transition hover:brightness-105"
                      >
                        Criar ocorrencia
                      </button>
                    )}
                  </CardHeaderRow>
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
                              <span>{`MOTIVO: ${reasonLabel}`}</span>
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
                    className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-800/70 bg-rose-950/35 text-rose-200 transition hover:bg-rose-900/45"
                    aria-label="Fechar popup"
                    title="Fechar"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <h3 className="text-center">{editingOccurrenceId ? `Editar ocorrencia #${editingOccurrenceId}` : 'Registrar Ocorrencia'}</h3>
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
                              setOccurrenceQuantityInput(nextType.includes('KG') ? '0.1' : '1');
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
                                  type="number"
                                  min={occurrenceQuantityMin}
                                  max={occurrenceProductRemainingQty || undefined}
                                  step={occurrenceQuantityStep}
                                  value={occurrenceQuantityInput}
                                  onChange={(event) => setOccurrenceQuantityInput(event.target.value)}
                                  disabled={!selectedOccurrenceProduct}
                                />
                              </div>
                              <button
                                className="mb-3 h-[42px] shrink-0 whitespace-nowrap rounded-md border-none bg-white/15 px-3 font-semibold text-text disabled:cursor-not-allowed disabled:opacity-45 max-[430px]:px-2 max-[430px]:text-[0.8rem]"
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
                      <button className="primary" onClick={handleCreateOrEditOccurrence} type="button">
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
                          {` | Data: ${formatDateBR(entry.created_at)}`}
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
