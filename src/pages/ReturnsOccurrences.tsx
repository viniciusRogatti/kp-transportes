import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import { useSearchParams } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import { CheckCircle2, History, Pencil, Search, Trash2 } from 'lucide-react';

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
  TwoColumns,
} from '../style/returnsOccurrences';
import { ICar, IDanfe, IDriver, IInvoiceReturn, IInvoiceReturnItem, IOccurrence, IProduct, IReturnBatch } from '../types/types';
import verifyToken from '../utils/verifyToken';

const DEFAULT_RETURN_UNIT_TYPES = ['KG', 'CX', 'UN', 'PCT'];

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
type OccurrenceReasonValue = (typeof OCCURRENCE_REASONS)[number]['value'] | 'legacy_outros';
type OccurrenceDraftItem = {
  product_id: string;
  product_description: string;
  quantity: number;
};

const normalizeProductType = (value?: string | null) => String(value || '').trim().toUpperCase();
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
  const getTodayDate = () => new Date().toISOString().split('T')[0];
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
  const [draftNotes, setDraftNotes] = useState<Array<{
    invoice_number: string;
    return_type: 'total' | 'partial' | 'sobra' | 'coleta';
    items: IInvoiceReturnItem[];
  }>>([]);
  const [returnDriverId, setReturnDriverId] = useState('');
  const [selectedCarId, setSelectedCarId] = useState('');
  const [returnDate, setReturnDate] = useState(getTodayDate());

  const [batchesDate, setBatchesDate] = useState(getTodayDate());
  const [returnBatches, setReturnBatches] = useState<IReturnBatch[]>([]);
  const [selectedBatchCode, setSelectedBatchCode] = useState('');
  const [batchDraftNotes, setBatchDraftNotes] = useState<IInvoiceReturn[]>([]);
  const [isBatchSearchOpen, setIsBatchSearchOpen] = useState(false);

  const [occurrenceNf, setOccurrenceNf] = useState('');
  const [occurrenceDanfe, setOccurrenceDanfe] = useState<IDanfe | null>(null);
  const [occurrenceReason, setOccurrenceReason] = useState<OccurrenceReasonValue>('faltou_no_carregamento');
  const [occurrenceProductCode, setOccurrenceProductCode] = useState(OCCURRENCE_TOTAL_OPTION);
  const [occurrenceQuantity, setOccurrenceQuantity] = useState<number>(1);
  const [occurrenceItems, setOccurrenceItems] = useState<OccurrenceDraftItem[]>([]);
  const [editingOccurrenceId, setEditingOccurrenceId] = useState<number | null>(null);
  const [resolvingOccurrence, setResolvingOccurrence] = useState<IOccurrence | null>(null);
  const [resolutionType, setResolutionType] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [occurrences, setOccurrences] = useState<IOccurrence[]>([]);
  const [occurrenceStatusFilter, setOccurrenceStatusFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
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
  const isAdminUser = userPermission === 'admin';
  const canManageOccurrenceStatus = userPermission !== 'control_tower';

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
  const getNoteDisplayLabel = (note: { invoice_number: string; return_type: 'total' | 'partial' | 'sobra' | 'coleta' }) => {
    if (note.return_type === 'sobra') {
      return note.invoice_number.replace(/^SOBRA-/, 'Sobra ');
    }

    return `NF ${note.invoice_number}`;
  };
  const occurrenceProducts = useMemo(() => occurrenceDanfe?.DanfeProducts || [], [occurrenceDanfe]);
  const selectedOccurrenceProduct = useMemo(() => (
    occurrenceProducts.find((item) => item.Product.code === occurrenceProductCode) || null
  ), [occurrenceProducts, occurrenceProductCode]);
  const isOccurrenceTotal = occurrenceProductCode === OCCURRENCE_TOTAL_OPTION;
  const occurrenceScope = isOccurrenceTotal ? 'invoice_total' : 'items';
  const occurrenceProductIsKg = useMemo(() => {
    if (!selectedOccurrenceProduct) return false;
    return normalizeProductType(selectedOccurrenceProduct.type || selectedOccurrenceProduct.Product.type).includes('KG');
  }, [selectedOccurrenceProduct]);
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
    if (!occurrenceProductCode || !selectedOccurrenceProduct) {
      setOccurrenceQuantity(1);
      return;
    }

    setOccurrenceQuantity(occurrenceProductIsKg ? 0.1 : 1);
  }, [occurrenceProductCode, selectedOccurrenceProduct, occurrenceProductIsKg]);

  useEffect(() => {
    if (isOccurrenceTotal && occurrenceItems.length) {
      setOccurrenceItems([]);
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

  async function loadReturnBatches() {
    try {
      const params = new URLSearchParams();
      if (batchesDate) {
        params.append('date', batchesDate);
      }

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

  async function loadOccurrences() {
    try {
      const params = new URLSearchParams();

      if (occurrenceStatusFilter !== 'all') {
        params.append('status', occurrenceStatusFilter);
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

  async function handleAddNf() {
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

    const noteInvoiceNumber = returnType === 'sobra'
      ? `SOBRA-${noteItems[0].product_id}`
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

      try {
        const { data } = await axios.post(`${API_URL}/returns/batches/create`, {
          driver_id: Number(returnDriverId),
          vehicle_plate: selectedCar.license_plate,
          return_date: returnDate,
          notes: draftNotes,
        });
        batchCodeForPdf = data?.batch_code || batchCodeForPdf;
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          throw error;
        }

        // Compatibilidade com backend antigo em producao (sem rotas de lote)
        await Promise.all(draftNotes.map((note) => (
          axios.post(`${API_URL}/returns/create`, {
            invoice_number: note.invoice_number,
            return_type: note.return_type,
            driver_id: Number(returnDriverId),
            vehicle_plate: selectedCar.license_plate,
            return_date: returnDate,
            items: note.items,
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
    setBatchDraftNotes((previous) => previous.filter((note) => note.id !== noteId));
  }

  async function handleSaveBatch() {
    if (!selectedBatch) {
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
        axios.post(`${API_URL}/returns/batches/${selectedBatch.batch_code}/add-note`, {
          invoice_number: note.invoice_number,
          return_type: note.return_type,
          items: note.items,
        })
      )));

      alert('Lote salvo com sucesso.');
      await loadReturnBatches();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar alteracoes do lote.');
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
      setOccurrenceQuantity(1);
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
    setOccurrenceQuantity(1);
    setOccurrenceItems([]);
    setOccurrenceDanfe(null);
    setOccurrenceNf('');
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

    if (!occurrenceQuantity || occurrenceQuantity <= 0) {
      alert('Informe uma quantidade valida.');
      return;
    }

    if (!occurrenceProductIsKg && !Number.isInteger(occurrenceQuantity)) {
      alert('Para este produto, utilize quantidade inteira.');
      return;
    }

    const normalizedQty = occurrenceProductIsKg
      ? Math.round(Number(occurrenceQuantity) * 10) / 10
      : Number(occurrenceQuantity);

    if (normalizedQty < occurrenceQuantityMin) {
      alert(`Quantidade minima permitida: ${occurrenceQuantityMin}.`);
      return;
    }

    if (normalizedQty + occurrenceProductAlreadyAddedQty > occurrenceProductMaxQty) {
      alert(`Quantidade excede o limite da NF. Restante disponivel: ${occurrenceProductRemainingQty}.`);
      return;
    }

    setOccurrenceItems((previous) => {
      const existing = previous.find((item) => item.product_id === occurrenceProductCode);
      if (!existing) {
        return [
          ...previous,
          {
            product_id: occurrenceProductCode,
            product_description: selectedOccurrenceProduct.Product.description,
            quantity: normalizedQty,
          },
        ];
      }

      return previous.map((item) => (
        item.product_id === occurrenceProductCode
          ? { ...item, quantity: Number(item.quantity) + normalizedQty }
          : item
      ));
    });

    setOccurrenceQuantity(occurrenceQuantityMin);
  }

  function removeOccurrenceItem(productId: string) {
    setOccurrenceItems((previous) => previous.filter((item) => item.product_id !== productId));
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
      resetOccurrenceBuilder();
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
    if (occurrence.status !== 'pending') return;

    setEditingOccurrenceId(occurrence.id);
    setOccurrenceNf(String(occurrence.invoice_number || ''));
    setOccurrenceReason((occurrence.reason || 'legacy_outros') as OccurrenceReasonValue);
    const scopeFromOccurrence = (occurrence.scope || 'items') as 'invoice_total' | 'items';
    setOccurrenceItems(
      (occurrence.items || [])
        .map((item) => ({
          product_id: String(item.product_id || '').trim(),
          product_description: String(item.product_description || '').trim(),
          quantity: Number(item.quantity || 0),
        }))
        .filter((item) => item.product_id && item.quantity > 0),
    );
    setOccurrenceProductCode(
      scopeFromOccurrence === 'invoice_total'
        ? OCCURRENCE_TOTAL_OPTION
        : String(occurrence.items?.[0]?.product_id || '').trim() || OCCURRENCE_TOTAL_OPTION,
    );
    setOccurrenceQuantity(1);

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
      setResolvingOccurrence(null);
      setResolutionType('');
      setResolutionNote('');
      await loadOccurrences();
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
              <IconButton
                icon={Search}
                label="Buscar lote por data"
                onClick={() => setIsBatchSearchOpen(true)}
                className="ml-auto"
              />
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
                  </TopActionBar>
                )}

                <Card>
                  <BoxDescription className="flex-col gap-1">
                    <h2 className="leading-tight max-[768px]:text-[0.92rem]">
                      {selectedBatch ? (
                        `Editando lote ${selectedBatch.batch_code}`
                      ) : (
                        <>
                          <span className="max-[768px]:hidden">Nova devolucao (lista de NFs)</span>
                          <span className="hidden max-[768px]:inline">Nova devolucao - lista de NFs</span>
                        </>
                      )}
                    </h2>
                    {selectedBatch ? (
                      <InlineText>
                        Motorista: {selectedBatch.Driver?.name || selectedBatch.driver_id} | Placa: {selectedBatch.vehicle_plate} | Data: {selectedBatch.return_date}
                      </InlineText>
                    ) : (
                      <>
                        <InlineText className="max-[768px]:hidden">Busque NF ou cadastre sobra, escolha o tipo e adicione na lista.</InlineText>
                        <InlineText className="hidden max-[768px]:block">Busque a NF, escolha o tipo e adicione na lista.</InlineText>
                      </>
                    )}

                  </BoxDescription>
                  <InlineText style={{ margin: '10px 0 6px 0' }}>NF + tipo de devolucao</InlineText>
                  <div className="space-y-2">
                    <div className="min-w-0">
                      <SearchInput
                        type="number"
                        value={returnNf}
                        onChange={(event) => setReturnNf(event.target.value)}
                        placeholder="Digite a NF"
                        onSearch={handleSearchReturnNf}
                        searchLabel="Buscar NF de devolucao"
                        className="border-white/10 bg-[rgba(11,27,42,0.6)]"
                      />
                    </div>
                    <ReturnSearchRow>
                    <label>
                      <input
                        type="checkbox"
                        checked={returnType === 'total'}
                        onChange={() => setReturnType('total')}
                      />
                      Total
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={returnType === 'partial'}
                        onChange={() => setReturnType('partial')}
                      />
                      Parcial
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={returnType === 'coleta'}
                        onChange={() => setReturnType('coleta')}
                      />
                      Coleta
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={returnType === 'sobra'}
                        onChange={() => setReturnType('sobra')}
                      />
                      Sobra
                    </label>
                    </ReturnSearchRow>
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
                              className="secondary"
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
                        <Grid style={{ marginTop: '12px' }}>
                          <div>
                            <InlineText>Codigo do produto</InlineText>
                            <input
                              type="text"
                              list="products-codes-list"
                              value={leftoverProductCode}
                              onChange={(event) => setLeftoverProductCode(event.target.value)}
                              placeholder="Ex.: 12345"
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
                            <InlineText>Quantidade</InlineText>
                            <input
                              type="number"
                              min={0.1}
                              step={0.1}
                              value={leftoverQuantity}
                              onChange={(event) => setLeftoverQuantity(Number(event.target.value))}
                            />
                          </div>
                          <div>
                            <InlineText>Tipo</InlineText>
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
                      )}

                      <Actions style={{ marginTop: '12px' }}>
                        <button className="primary" onClick={handleAddNf} type="button">
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
                        disabled={!selectedBatchHasUnsavedChanges}
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
                            </span>
                            <Actions>
                              <button className="danger" onClick={() => handleRemoveNoteFromBatch(note.id)} type="button">
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
                        <div style={{ gridColumn: '1 / -1' }}>
                          <InlineText>Data da devolucao</InlineText>
                          <input
                            type="date"
                            value={returnDate}
                            onChange={(event) => setReturnDate(event.target.value)}
                          />
                        </div>
                      </Grid>

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

                      <Actions style={{ marginTop: '12px' }}>
                        <button className="primary" onClick={handleConcludeBatch} disabled={draftNotes.length === 0} type="button">
                          Concluir devolucao
                        </button>
                      </Actions>
                    </>
                  )}
                </Card>

                {!!returnBatches.length && (
                  <Card>
                    <h2>Lotes encontrados ({returnBatches.length})</h2>
                    <List>
                      {returnBatches.map((batch) => (
                        <li key={batch.batch_code}>
                          <BatchItemContent>
                            <span>
                              <strong>{batch.batch_code}</strong>
                              {` | Motorista: ${batch.Driver?.name || batch.driver_id}`}
                              {` | Placa: ${batch.vehicle_plate}`}
                              {` | Data: ${batch.return_date}`}
                              {` | NFs: ${batch.notes.length}`}
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
                                label="Editar lote"
                                onClick={() => setSelectedBatchCode(batch.batch_code)}
                                className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0"
                              />
                            </BatchActionsRow>
                          </BatchItemContent>
                        </li>
                      ))}
                    </List>
                  </Card>
                )}

                {isBatchSearchOpen && (
                  <>
                    <ModalOverlay onClick={() => setIsBatchSearchOpen(false)} />
                    <ModalCard>
                      <h3>Buscar lote por data</h3>
                      <input
                        type="date"
                        value={batchesDate}
                        onChange={(event) => setBatchesDate(event.target.value)}
                      />
                      <Actions>
                        <IconButton
                          icon={Search}
                          label="Buscar lote"
                          onClick={async () => {
                            await loadReturnBatches();
                            setIsBatchSearchOpen(false);
                          }}
                          className="!h-10 !w-10 !min-h-10 !min-w-10 !px-0 !py-0"
                          size="lg"
                        />
                        <button className="secondary" onClick={() => setIsBatchSearchOpen(false)} type="button">
                          Fechar
                        </button>
                      </Actions>
                    </ModalCard>
                  </>
                )}
              </SingleColumn>
            )}

            {activeTab === 'occurrences' && (
              <TwoColumns>
                <div className="flex flex-col gap-2 max-[768px]:gap-1">
                  <h2 className="px-1 text-[1.04rem] font-semibold text-text max-[768px]:text-[0.96rem]">
                    {editingOccurrenceId ? `Editar ocorrencia #${editingOccurrenceId}` : 'Registrar Ocorrencia'}
                  </h2>
                  <Card className="pt-3 max-[768px]:pt-2">
                  <Grid className="grid-cols-1">
                    <div className="min-w-0">
                      <SearchInput
                        type="text"
                        inputMode="numeric"
                        value={occurrenceNf}
                        onChange={(event) => setOccurrenceNf(event.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder="Digite a NF"
                        maxLength={8}
                        onSearch={handleSearchOccurrenceNf}
                        searchLabel="Buscar NF de ocorrencia"
                        aria-label="NF da ocorrencia"
                        className="text-[1rem] tracking-[0.04em] max-[768px]:h-[46px] max-[768px]:text-[1.05rem] max-[768px]:font-semibold"
                      />
                    </div>
                  </Grid>

                  {occurrenceDanfe && (
                    <>
                      <InlineText style={{ marginTop: '12px' }}>
                        NF selecionada: {occurrenceDanfe.invoice_number} | Cliente: {occurrenceDanfe.Customer.name_or_legal_entity}
                      </InlineText>

                      <Grid className="mt-3 grid-cols-1 md:grid-cols-2">
                        <div>
                          <InlineText>Motivo</InlineText>
                          <select
                            value={occurrenceReason}
                            onChange={(event) => setOccurrenceReason(event.target.value as OccurrenceReasonValue)}
                            className="max-[768px]:text-[0.95rem]"
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
                            className="max-[768px]:text-[0.97rem]"
                            onChange={(event) => {
                              const nextProductCode = event.target.value;
                              const switchingToTotal = nextProductCode === OCCURRENCE_TOTAL_OPTION;

                              if (editingOccurrenceId && switchingToTotal && occurrenceItems.length) {
                                const confirmed = window.confirm('Deseja trocar a ocorrencia para NF total? Os itens selecionados serao removidos.');
                                if (!confirmed) return;
                              }

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
                      </Grid>

                      {!isOccurrenceTotal && (
                        <>
                          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                            <div>
                              <InlineText>Quantidade</InlineText>
                              <input
                                type="number"
                                min={occurrenceQuantityMin}
                                max={occurrenceProductRemainingQty || undefined}
                                step={occurrenceQuantityStep}
                                value={occurrenceQuantity}
                                onChange={(event) => setOccurrenceQuantity(Number(event.target.value))}
                                disabled={!selectedOccurrenceProduct}
                                className="max-[768px]:text-[0.98rem]"
                              />
                              {!!selectedOccurrenceProduct && (
                                <InfoText>
                                  Limite da NF: {occurrenceProductMaxQty} | Restante: {occurrenceProductRemainingQty}
                                </InfoText>
                              )}
                            </div>
                            <button
                              className="secondary h-[42px] shrink-0 rounded-md border-none bg-white/15 px-4 font-semibold text-text disabled:cursor-not-allowed disabled:opacity-45 max-[768px]:px-3 max-[768px]:text-[0.85rem]"
                              onClick={addOccurrenceItem}
                              type="button"
                              disabled={!selectedOccurrenceProduct || occurrenceProductRemainingQty <= 0}
                            >
                              Adicionar item
                            </button>
                          </div>
                          <List className="max-[768px]:gap-2 max-[768px]:[&>li]:items-start max-[768px]:[&>li]:py-3 max-[768px]:[&>li>span]:text-[0.94rem] max-[768px]:[&>li>span]:leading-snug">
                            {!occurrenceItems.length ? (
                              <li>
                                <span>Nenhum item selecionado.</span>
                              </li>
                            ) : occurrenceItems.map((item) => (
                              <li key={`occ-item-${item.product_id}`}>
                                <span className="text-[0.95rem] leading-snug">
                                  <strong>{item.product_id}</strong> - {item.product_description} | Qtd: {item.quantity}
                                </span>
                                <Actions>
                                  <button className="danger" onClick={() => removeOccurrenceItem(item.product_id)} type="button">Remover</button>
                                </Actions>
                              </li>
                            ))}
                          </List>
                        </>
                      )}

                      <Actions style={{ marginTop: '12px' }}>
                        <button className="primary" onClick={handleCreateOrEditOccurrence} type="button">
                          {editingOccurrenceId ? 'Salvar alteracoes' : 'Registrar ocorrencia'}
                        </button>
                        {editingOccurrenceId && (
                          <button className="secondary" onClick={resetOccurrenceBuilder} type="button">
                            Cancelar edicao
                          </button>
                        )}
                      </Actions>
                    </>
                  )}
                  </Card>
                </div>

                <Card>
                  <CardHeaderRow>
                    <h2>Ocorrencias Cadastradas</h2>
                    <button className="secondary" onClick={loadOccurrences} type="button">Atualizar lista</button>
                  </CardHeaderRow>
                  <Grid style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                    <div>
                      <InlineText>Status</InlineText>
                      <select
                        value={occurrenceStatusFilter}
                        onChange={(event) => setOccurrenceStatusFilter(event.target.value as 'all' | 'pending' | 'resolved')}
                      >
                        <option value="pending">Pendentes</option>
                        <option value="resolved">Resolvidas</option>
                        <option value="all">Todas</option>
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
                        const itemsSummary = occurrence.items?.length
                          ? occurrence.items
                            .map((item) => {
                              const id = String(item.product_id || '').trim();
                              const description = String(item.product_description || '').trim();
                              if (id && description) return `${id} - ${description}`;
                              return id || description || '';
                            })
                            .filter(Boolean)
                            .join(', ')
                          : (() => {
                            const productId = String(occurrence.product_id || '').trim();
                            const productDescription = String(occurrence.product_description || '').trim();
                            if (productId && productDescription) return `${productId} - ${productDescription}`;
                            if (productId) return productId;
                            if (productDescription) return productDescription;
                            return 'NF total';
                          })();

                        return (
                        <li key={occurrence.id}>
                          <OccurrenceItemContent>
                            <span>
                              <strong>NF: {occurrence.invoice_number}</strong>
                              {` | CLIENTE: ${occurrence.customer_name || '-'}`}
                            </span>
                            <span>{`CIDADE: ${occurrence.city || '-'}`}</span>
                            <span>{`ITENS: ${itemsSummary || 'NF total'}`}</span>
                            <span>{`MOTIVO: ${reasonLabel}`}</span>
                            {occurrence.resolution_type && (
                              <span>
                                Resolucao: {RESOLUTION_LABELS[occurrence.resolution_type] || occurrence.resolution_type}
                                {occurrence.resolution_note ? ` | Obs: ${occurrence.resolution_note}` : ''}
                              </span>
                            )}

                            <OccurrenceCardFooter>
                              <OccurrenceActionsRow>
                                <OccurrenceActionsLeft>
                                  {occurrence.status === 'pending' && canManageOccurrenceStatus && (
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
                                  {occurrence.status === 'pending' && canManageOccurrenceStatus && (
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
              </TwoColumns>
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
                          {` | Data: ${new Date(entry.created_at).toLocaleString('pt-BR')}`}
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
