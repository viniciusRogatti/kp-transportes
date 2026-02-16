import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, History, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import axios from 'axios';

import Header from '../components/Header';
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
import { IDanfe, IOccurrence } from '../types/types';
import verifyToken from '../utils/verifyToken';

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

function Home() {
  const navigate = useNavigate();

  const [pendingOccurrences, setPendingOccurrences] = useState<IOccurrence[]>([]);
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
  const [historyEntries, setHistoryEntries] = useState<Array<{
    id: number;
    action: string;
    actor_user_id: number | null;
    actor_username: string | null;
    created_at: string;
  }>>([]);

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
      await loadPendingOccurrences();
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

  return (
    <HomeStyle>
      <Header />
      <HomeContent>
        <Card>
          <CardHeaderRow>
            <h2>Ocorrencias Pendentes</h2>
            <button className="secondary" onClick={loadPendingOccurrences} type="button">Atualizar lista</button>
          </CardHeaderRow>

          {!pendingOccurrences.length ? (
            <InlineText style={{ marginTop: '12px' }}>Nenhuma ocorrencia pendente no momento.</InlineText>
          ) : (
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
                      <span>
                        ITENS:{' '}
                        {itemsSummary.length ? (
                          itemsSummary.map((item, index) => (
                            <span key={`home-occ-summary-${occurrence.id}-${item.label}-${index}`}>
                              {index > 0 ? ', ' : ''}
                              {item.label} | <strong>{`Qtd: ${item.quantityWithType}`}</strong>
                            </span>
                          ))
                        ) : 'NF total'}
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
    </HomeStyle>
  );
}

export default Home;
