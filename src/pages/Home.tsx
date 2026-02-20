import { useEffect, useMemo, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { CalendarDays, CheckCircle2, History, MessageSquare, Pencil, Printer, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import axios from 'axios';

import Header from '../components/Header';
import CollectionRequestPDF from '../components/CollectionRequestPDF';
import IconButton from '../components/ui/IconButton';
import SearchInput from '../components/ui/SearchInput';
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
  product_type: string | null;
  quantity: number;
};
type OccurrenceCardItemSummary = {
  label: string;
  quantityWithType: string;
};

const normalizeProductType = (value?: string | null) => String(value || '').trim().toUpperCase();
const formatOccurrenceQtyWithType = (quantity: number, productType?: string | null) => {
  const normalizedType = normalizeProductType(productType);
  return `${Number(quantity || 0)}${normalizedType || ''}`;
};
const formatUrgencyLabel = (level?: string | null) => {
  const normalized = String(level || '').trim().toLowerCase();
  if (normalized === 'critica') return 'Crítica';
  if (normalized === 'alta') return 'Alta';
  if (normalized === 'baixa') return 'Baixa';
  return 'Média';
};
const COLLECTION_STATUS_LABELS: Record<string, string> = {
  solicitada: 'Coleta solicitada',
  aceita_agendada: 'Coleta agendada',
  coletada: 'Coletada',
  enviada_em_lote: 'Enviada em lote',
  recebida: 'Recebida',
  cancelada: 'Cancelada',
};

type AuditHistoryEntry = {
  id: number;
  action: string;
  actor_user_id: number | null;
  actor_username: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

const resolveCollectionStatus = (request: ICollectionRequest) => (
  String(request.workflow_status || request.display_status || request.status || '').trim().toLowerCase()
);

const getCollectionStatusLabel = (request: ICollectionRequest) => {
  const status = resolveCollectionStatus(request);
  return COLLECTION_STATUS_LABELS[status] || status || 'Status nao informado';
};

const normalizeTextValue = (value: unknown) => String(value || '').trim();

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
  ['solicitada', 'pending', 'aceita_agendada'].includes(
    resolveCollectionStatus(request),
  )
);

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
  const [occurrenceQuantity, setOccurrenceQuantity] = useState<number>(1);
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

  const [collectionPdfPrintingId, setCollectionPdfPrintingId] = useState<number | null>(null);

  const isAdminUser = userPermission === 'admin';
  const canManageOccurrenceStatus = userPermission !== 'control_tower';

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
      setOccurrenceQuantity(1);
      return;
    }

    const defaultType = normalizeProductType(selectedOccurrenceProduct.type || selectedOccurrenceProduct.Product.type)
      || DEFAULT_OCCURRENCE_UNIT_TYPES[0];
    setOccurrenceProductType((current) => normalizeProductType(current) || defaultType);
    setOccurrenceQuantity(defaultType.includes('KG') ? 0.1 : 1);
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
      const safeData = Array.isArray(data) ? data : [];

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
              customer_name: danfe?.Customer?.name_or_legal_entity || occurrence.customer_name || null,
              city: danfe?.Customer?.city || occurrence.city || null,
              product_description: fallbackProductDescription,
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
        if (!fallback) return occurrence;
        return {
          ...occurrence,
          customer_name: fallback.customer_name ?? occurrence.customer_name ?? null,
          city: fallback.city ?? occurrence.city ?? null,
          product_description: fallback.product_description ?? occurrence.product_description ?? null,
          product_type: fallback.product_type ?? occurrence.product_type ?? null,
        };
      });

      setPendingOccurrences(merged);
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
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

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

  function resetOccurrenceEditor() {
    setEditingOccurrenceId(null);
    setOccurrenceNf('');
    setOccurrenceDanfe(null);
    setOccurrenceReason('faltou_no_carregamento');
    setOccurrenceProductCode(OCCURRENCE_TOTAL_OPTION);
    setOccurrenceProductType('');
    setOccurrenceQuantity(1);
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

      setOccurrenceDanfe(data);
      setOccurrenceProductCode(OCCURRENCE_TOTAL_OPTION);
      setOccurrenceProductType('');
      setOccurrenceQuantity(1);
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

    setOccurrenceQuantity(occurrenceQuantityMin);
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
                    Coletas da Torre de Controle (solicitadas e agendadas, com prioridade de atendimento)
                  </InfoText>
                  <List className="mt-2">
                    {pendingCollectionRequests.map((request) => (
                      <li
                        key={`home-pickup-${request.id}`}
                        className={resolveCollectionStatus(request) === 'aceita_agendada'
                          ? '!border-sky-500/55 !bg-[linear-gradient(135deg,rgba(10,39,62,0.52)_0%,rgba(9,30,49,0.7)_100%)]'
                          : '!border-amber-500/55 !bg-[linear-gradient(135deg,rgba(95,45,8,0.45)_0%,rgba(58,28,5,0.62)_100%)]'}
                      >
                        <OccurrenceItemContent>
                          <span className="flex flex-wrap items-center gap-2">
                            <strong className={resolveCollectionStatus(request) === 'aceita_agendada' ? 'text-sky-200' : 'text-amber-200'}>
                              {resolveCollectionStatus(request) === 'aceita_agendada' ? 'COLETA AGENDADA' : 'COLETA SOLICITADA'}
                            </strong>
                            <span className={resolveCollectionStatus(request) === 'aceita_agendada'
                              ? 'rounded-full border border-sky-300/35 bg-sky-300/15 px-2 py-0.5 text-[11px] font-semibold text-sky-200'
                              : 'rounded-full border border-amber-300/35 bg-amber-300/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200'}
                            >
                              Destaque
                            </span>
                          </span>
                          <span>
                            <strong>NF: {request.invoice_number || '-'}</strong>
                            {` | CLIENTE: ${request.customer_name || '-'}`}
                          </span>
                          <span>{`CIDADE: ${request.city || '-'}`}</span>
                          <span>{`STATUS: ${getCollectionStatusLabel(request)}`}</span>
                          {request.scheduled_for ? <span>{`DATA PREVISTA: ${formatDateBR(request.scheduled_for)}`}</span> : null}
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
                                <button
                                  className="primary hidden md:inline-flex md:items-center md:gap-1.5 md:px-3"
                                  onClick={() => openCollectionScheduleModal(request)}
                                  type="button"
                                >
                                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                                  {resolveCollectionStatus(request) === 'aceita_agendada' ? 'Editar data' : 'Agendar coleta'}
                                </button>
                                <IconButton
                                  icon={CalendarDays}
                                  label={resolveCollectionStatus(request) === 'aceita_agendada' ? 'Editar data da coleta' : 'Agendar coleta'}
                                  onClick={() => openCollectionScheduleModal(request)}
                                  className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 !py-0 !border-accent/60 !bg-accent/20 !text-text-accent hover:!bg-accent/35 md:!hidden"
                                />
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

              {!!pendingOccurrences.length && (
                <>
                  <InfoText style={{ marginTop: '12px' }}>Ocorrências pendentes</InfoText>
                  <List>
                    {pendingOccurrences.map((occurrence) => {
                      const reasonLabel = OCCURRENCE_REASON_LABELS[occurrence.reason || 'legacy_outros'] || 'Legado / outros';
                      const itemsSummary = getItemsSummary(occurrence);

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
                              {itemsSummary.length ? (
                                itemsSummary.map((item, index) => (
                                  <span key={`home-occ-summary-${occurrence.id}-${item.label}-${index}`} className="pl-2">
                                    {item.label} | <strong>{`Qtd: ${item.quantityWithType}`}</strong>
                                  </span>
                                ))
                              ) : (
                                <span className="pl-2">NF total</span>
                              )}
                            </span>
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
                                        onClick={() => openResolveModal(occurrence)}
                                        type="button"
                                      >
                                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                        Marcar como resolvida
                                      </button>
                                      <IconButton
                                        icon={CheckCircle2}
                                        label="Marcar ocorrência como resolvida"
                                        onClick={() => openResolveModal(occurrence)}
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
                        setOccurrenceQuantity(nextType.includes('KG') ? 0.1 : 1);
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
                          type="number"
                          min={occurrenceQuantityMin}
                          max={occurrenceProductRemainingQty || undefined}
                          step={occurrenceQuantityStep}
                          value={occurrenceQuantity}
                          onChange={(event) => setOccurrenceQuantity(Number(event.target.value))}
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

      {resolvingOccurrence && (
        <>
          <ModalOverlay onClick={closeResolveModal} />
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
