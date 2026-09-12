import OperationalPageIntro from '../components/OperationalPageIntro';
import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  ArrowRight,
  ClipboardCheck,
  RefreshCcw,
  Search,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import CentralBotAlerts from '../components/CentralBotAlerts';
import Badge from '../components/ui/Badge';
import Header from '../components/Header';
import MissingCargoOccurrenceDetails from '../components/occurrences/MissingCargoOccurrenceDetails';
import { Container } from '../style/invoices';
import verifyToken from '../utils/verifyToken';
import {
  listDriversForReceiptFilters,
  listReceiptBacklog,
  resolveIncorrectInvoiceReceiptNotification,
} from '../services/receiptsService';
import {
  IDriver,
  IOccurrence,
  IReceiptBacklogRow,
  IReceiptBacklogRouteHistoryRow,
  IReceiptBacklogSummary,
  ReceiptBacklogQueueType,
} from '../types/types';
import {
  getOperationalStatusLabel,
  getOperationalStatusTone,
  getSemanticToneClassName,
  SemanticTone,
} from '../utils/statusStyles';
import {
  getManualStopStatusLabel,
  MANUAL_STOP_STATUS_ACTIONS,
  ManualStopStatus,
} from './deliveryMonitoring/stopStatusActions';
import { API_URL } from '../data';
import { getApiErrorMessage, handleAuthenticationError } from '../utils/authErrorHandler';
import { getOccurrenceAgeDays, isTreatmentOverdue } from '../utils/operationalTreatments';
import { showConfirm } from '../utils/dialog';
import { formatDateBR, formatDateTimeBR } from '../utils/dateDisplay';

type BacklogStatusUpdateState = {
  companyId?: number;
  invoiceNumber: string;
  nextStatus: ManualStopStatus;
};

type BacklogStatusFeedback = {
  companyId?: number;
  invoiceNumber: string;
  tone: SemanticTone;
  message: string;
};

type CancelledReplacementDraft = {
  companyId?: number;
  invoiceNumber: string;
  tripNoteId: number;
  tripId: number | null;
  motoristaId: number;
  motoristaName: string | null;
  currentStatus: string;
};

type BacklogTabConfig = {
  label: string;
  summaryLabel: string;
  emptyMessage: string;
  tone: SemanticTone;
};

const BACKLOG_TAB_CONFIG: Record<ReceiptBacklogQueueType, BacklogTabConfig> = {
  redelivery: {
    label: 'Reentregas sem nova rota',
    summaryLabel: 'Reentregas',
    emptyMessage: 'Nenhuma reentrega aguardando inclusão em uma nova rota.',
    tone: 'danger',
  },
  unassigned: {
    label: 'NFs sem rota',
    summaryLabel: 'Sem rota',
    emptyMessage: 'Nenhuma NF aberta sem atribuição de rota.',
    tone: 'warning',
  },
  returned: {
    label: 'Devoluções fora de lote',
    summaryLabel: 'Devoluções fora de lote',
    emptyMessage: 'Nenhuma devolução aguardando inclusão em lote.',
    tone: 'danger',
  },
  retained: {
    label: 'Canhotos retidos',
    summaryLabel: 'Retidos',
    emptyMessage: 'Nenhum canhoto retido encontrado para os filtros atuais.',
    tone: 'warning',
  },
  pending: {
    label: 'Canhotos pendentes',
    summaryLabel: 'NFs sem canhoto',
    emptyMessage: 'Nenhuma rota de dia anterior sem canhoto postado.',
    tone: 'info',
  },
};

const EMPTY_BACKLOG_SUMMARY: IReceiptBacklogSummary = {
  redelivery: 0,
  unassigned: 0,
  returned: 0,
  retained: 0,
  pending: 0,
  total: 0,
};

const OCCURRENCE_REASON_LABELS: Record<string, string> = {
  faltou_no_carregamento: 'Faltou no carregamento',
  faltou_na_carga: 'Faltou na carga',
  produto_avariado: 'Produto avariado',
  produto_invertido: 'Produto invertido',
  produto_sem_etiqueta_ou_data: 'Produto sem etiqueta ou data',
  legacy_outros: 'Outros',
};

const getBacklogInvoiceKey = (row: IReceiptBacklogRow) => {
  const rawInvoiceNumber = String(row.nf_id || row.invoice_number || '').trim();
  const digits = rawInvoiceNumber.replace(/\D/g, '');
  return digits ? digits.replace(/^0+(?=\d)/, '') : rawInvoiceNumber.toUpperCase();
};

const deduplicateBacklogRows = (backlogRows: IReceiptBacklogRow[]) => {
  const seenInvoiceKeys = new Set<string>();
  return backlogRows.filter((row) => {
    const invoiceKey = `${row.company_id || ''}::${getBacklogInvoiceKey(row)}`;
    if (!invoiceKey || seenInvoiceKeys.has(invoiceKey)) return false;
    seenInvoiceKeys.add(invoiceKey);
    return true;
  });
};

const getInitialNotificationSearchParams = () => {
  const hashQuery = typeof window !== 'undefined' ? String(window.location.hash || '').split('?')[1] : '';
  const query = typeof window !== 'undefined' && window.location.search
    ? window.location.search
    : hashQuery ? `?${hashQuery}` : '';
  return new URLSearchParams(query);
};

const formatDateTime = (value: string | number | null | undefined) => {
  return formatDateTimeBR(value);
};

const formatDateOnly = (value: string | null | undefined) => {
  return formatDateBR(value);
};

const getBacklogTabClassName = (tab: ReceiptBacklogQueueType, active: boolean) => (
  active ? getSemanticToneClassName(BACKLOG_TAB_CONFIG[tab].tone) : 'border-border bg-card text-text'
);

const getAgeBadgeTone = (row: IReceiptBacklogRow): SemanticTone => {
  if ((row.age_days || 0) <= 0) return 'info';
  if (row.queue_type === 'returned') return 'neutral';
  if (row.queue_type === 'retained') return 'warning';
  return 'danger';
};

const shouldExpandRouteHistory = (row: IReceiptBacklogRow) => {
  const historyLength = Array.isArray(row.route_history) ? row.route_history.length : 0;
  if (historyLength <= 1) return false;
  return row.queue_type === 'returned' || row.source_status === 'redelivery';
};

const getRouteHistoryEntryKey = (
  row: IReceiptBacklogRow,
  historyRow: IReceiptBacklogRouteHistoryRow,
  index: number,
) => (
  `${row.invoice_number}-${historyRow.trip_id || 'sem-trip'}-${historyRow.trip_note_id || historyRow.created_at || index}`
);

const isCurrentRouteHistoryEntry = (row: IReceiptBacklogRow, historyRow: IReceiptBacklogRouteHistoryRow) => {
  if (row.trip_id && historyRow.trip_id) {
    return Number(row.trip_id) === Number(historyRow.trip_id);
  }

  if (row.trip_date && historyRow.trip_date && row.motorista_id && historyRow.motorista_id) {
    return row.trip_date === historyRow.trip_date && Number(row.motorista_id) === Number(historyRow.motorista_id);
  }

  return false;
};

const BACKLOG_MANUAL_STATUS_SET = new Set<ManualStopStatus>(['returned', 'redelivery', 'retained', 'cancelled']);

const canCorrectBacklogStatus = (currentStatus: unknown, nextStatus: ManualStopStatus) => {
  const normalizedCurrent = String(currentStatus || '').trim().toLowerCase() as ManualStopStatus;
  if (!BACKLOG_MANUAL_STATUS_SET.has(nextStatus)) return false;
  if (!normalizedCurrent) return false;

  if (BACKLOG_MANUAL_STATUS_SET.has(normalizedCurrent)) {
    return normalizedCurrent !== nextStatus;
  }

  return true;
};

const resolveBacklogOperationalTarget = (row: IReceiptBacklogRow) => {
  const routeHistory = Array.isArray(row.route_history) ? row.route_history : [];
  const fallbackHistoryRow = routeHistory.find((historyRow) => (
    Boolean(historyRow?.trip_note_id) && Boolean(historyRow?.motorista_id)
  )) || null;

  return {
    tripNoteId: Number(row.trip_note_id || fallbackHistoryRow?.trip_note_id || 0),
    motoristaId: Number(row.motorista_id || fallbackHistoryRow?.motorista_id || 0),
    motoristaName: row.motorista_name || fallbackHistoryRow?.motorista_name || null,
    tripId: Number(row.trip_id || fallbackHistoryRow?.trip_id || 0) || null,
  };
};

function OperationalPendencies() {
  const navigate = useNavigate();
  const initialSearchParams = useMemo(() => getInitialNotificationSearchParams(), []);
  const receiptCorrectionNotificationId = String(initialSearchParams.get('receiptCorrection') || '').trim();
  const receiptCorrectionReportedNf = String(initialSearchParams.get('reportedNf') || '').trim();
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);
  const occurrenceSectionRef = useRef<HTMLElement | null>(null);

  const [activeTab, setActiveTab] = useState<ReceiptBacklogQueueType | 'all' | 'occurrences' | 'alerts'>(() => {
    const requestedTab = initialSearchParams.get('tab') as ReceiptBacklogQueueType | null;
    return requestedTab && requestedTab in BACKLOG_TAB_CONFIG ? requestedTab : initialSearchParams.get('tab') === 'occurrences' ? 'occurrences' : 'all';
  });
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [rows, setRows] = useState<IReceiptBacklogRow[]>([]);
  const [summary, setSummary] = useState<IReceiptBacklogSummary>(EMPTY_BACKLOG_SUMMARY);
  const [pendingOccurrences, setPendingOccurrences] = useState<IOccurrence[]>([]);
  const [botAlertCount, setBotAlertCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [occurrenceError, setOccurrenceError] = useState('');
  const requestIdRef = useRef(0);
  const [cutoffDate, setCutoffDate] = useState('');
  const [nfFilter, setNfFilter] = useState(() => String(initialSearchParams.get('nf') || '').replace(/\D/g, '').slice(0, 9));
  const [motoristaFilter, setMotoristaFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [statusUpdate, setStatusUpdate] = useState<BacklogStatusUpdateState | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<BacklogStatusFeedback | null>(null);
  const [cancelledReplacementDraft, setCancelledReplacementDraft] = useState<CancelledReplacementDraft | null>(null);
  const [replacementInvoiceNumber, setReplacementInvoiceNumber] = useState('');
  const [replacementReason, setReplacementReason] = useState('Refaturada');
  const [replacementModalError, setReplacementModalError] = useState('');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadNfId, setUploadNfId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const selectedMotoristaFilterId = useMemo(() => {
    const parsed = Number(motoristaFilter);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [motoristaFilter]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const ensureToken = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      const valid = await verifyToken(token);
      if (!valid) {
        navigate('/');
      }
    };

    ensureToken();
  }, [navigate]);

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const driverRows = await listDriversForReceiptFilters();
        setDrivers(Array.isArray(driverRows) ? driverRows : []);
      } catch {
        setDrivers([]);
      }
    };

    loadDrivers();
  }, []);

  async function loadPendingOccurrences() {
    try {
      const { data } = await axios.get<IOccurrence[]>(`${API_URL}/occurrences/pending`);
      const uniqueById = new Map<number, IOccurrence>();
      (Array.isArray(data) ? data : []).forEach((occurrence) => {
        if (occurrence?.id) uniqueById.set(occurrence.id, occurrence);
      });
      setPendingOccurrences(Array.from(uniqueById.values()));
      setOccurrenceError('');
    } catch (error) {
      console.error('Erro ao carregar ocorrencias abertas:', error);
      setOccurrenceError('Não foi possível carregar as ocorrências. Tente atualizar.');
    }
  }

  useEffect(() => {
    loadPendingOccurrences();
  }, []);

  useEffect(() => {
    if (initialSearchParams.get('tab') !== 'occurrences') return;
    window.setTimeout(() => {
      occurrenceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [initialSearchParams]);

  useEffect(() => { if (receiptCorrectionNotificationId) setIsUploadModalOpen(true); }, [receiptCorrectionNotificationId]);

  function openNativeDatePicker(input: HTMLInputElement | null) {
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
  }

  async function loadBacklog(
    tab: ReceiptBacklogQueueType | 'all' | 'occurrences' | 'alerts' = activeTab,
    overrides: {
      nf?: string;
      motoristaId?: number | null;
      startDate?: string;
      endDate?: string;
    } = {},
  ) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setPageError('');

    try {
      const params = {
        nf: (overrides.nf ?? nfFilter).trim() || undefined,
        motoristaId: overrides.motoristaId !== undefined ? overrides.motoristaId : selectedMotoristaFilterId,
        startDate: (overrides.startDate ?? startDate) || undefined,
        endDate: (overrides.endDate ?? endDate) || undefined,
        limit: 300,
      };
      let response = await listReceiptBacklog(params);
      let allRows = Array.isArray(response?.rows) ? response.rows : [];
      while (allRows.length < Number(response?.total || 0)) {
        const next = await listReceiptBacklog({ ...params, offset: allRows.length });
        const combined = deduplicateBacklogRows([...allRows, ...(next.rows || [])]);
        if (combined.length === allRows.length) { setPageError('Parte das pendências não pôde ser carregada. Tente atualizar a lista.'); break; }
        allRows = combined;
      }
      if (requestId !== requestIdRef.current) return;
      setRows(deduplicateBacklogRows(allRows));
      setSummary(response?.summary || EMPTY_BACKLOG_SUMMARY);
      setCutoffDate(String(response?.cutoff_date || ''));
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error(error);
      if (handleAuthenticationError(error)) return;
      const apiMessage = getApiErrorMessage(error);
      setPageError(apiMessage || (error instanceof Error ? error.message : 'Não foi possível carregar as pendências.'));
      setRows([]);
      setSummary(EMPTY_BACKLOG_SUMMARY);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    loadBacklog(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch() {
    setRefreshKey((key) => key + 1);
    await Promise.all([loadBacklog(activeTab), loadPendingOccurrences()]);
  }

  async function handleClearFilters() {
    setNfFilter('');
    setMotoristaFilter('');
    setStartDate('');
    setEndDate('');
    await Promise.all([
      loadBacklog(activeTab, {
        nf: '',
        motoristaId: null,
        startDate: '',
        endDate: '',
      }),
      loadPendingOccurrences(),
    ]);
  }

  function closeReplacementModal() {
    if (statusUpdate?.nextStatus === 'cancelled') return;
    setCancelledReplacementDraft(null); setReplacementInvoiceNumber('');
    setReplacementReason('Refaturada'); setReplacementModalError('');
  }

  function closeUploadModal() { setIsUploadModalOpen(false); setUploadError(''); }

  async function handleReceiptCorrectionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const correctedInvoiceNumber = uploadNfId.trim();
    if (!correctedInvoiceNumber) {
      setUploadError('Informe o numero correto da NF.');
      return;
    }
    if (correctedInvoiceNumber === receiptCorrectionReportedNf) {
      setUploadError('A NF correta deve ser diferente do numero digitado pelo motorista.');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      await resolveIncorrectInvoiceReceiptNotification(
        receiptCorrectionNotificationId,
        correctedInvoiceNumber,
      );
      closeUploadModal();
      window.alert(`Correção registrada. Poste novamente a foto no grupo com somente ${correctedInvoiceNumber} na legenda para confirmar a entrega.`);
      navigate('/home', { replace: true });
    } catch (error) {
      console.error(error);
      setUploadError(getApiErrorMessage(error) || 'Nao foi possivel solicitar a correcao do canhoto.');
    } finally {
      setUploading(false);
    }
  }

  async function submitBacklogStatusUpdate({
    row,
    nextStatus,
    replacementInvoice,
    replacementReasonValue,
  }: {
    row: IReceiptBacklogRow;
    nextStatus: ManualStopStatus;
    replacementInvoice?: string | null;
    replacementReasonValue?: string | null;
  }) {
    const {
      tripNoteId,
      motoristaId,
      motoristaName,
      tripId,
    } = resolveBacklogOperationalTarget(row);
    if (!tripNoteId) {
      throw new Error('Esta NF nao possui identificador operacional para correcao de status.');
    }
    if (!motoristaId) {
      throw new Error('Esta NF nao possui motorista vinculado para correcao operacional.');
    }

    const metadata: Record<string, unknown> = {
      origin: 'operational_pendencies',
      trip_id: tripId,
      invoice_number: row.invoice_number,
    };

    const normalizedReplacementInvoice = String(replacementInvoice || '').trim();
    if (nextStatus === 'cancelled' && normalizedReplacementInvoice) {
      metadata.replacement_invoice_number = normalizedReplacementInvoice;
      metadata.replacement_reason = String(replacementReasonValue || '').trim() || 'Refaturada';
    }
    if (nextStatus === 'cancelled' && !normalizedReplacementInvoice) {
      throw new Error('Informe a NF substituta para concluir o cancelamento.');
    }

    await axios.post(`${API_URL}/driver-app/trip-stops/${tripNoteId}/status`, {
      status: nextStatus,
      driver_id: motoristaId,
      driver_name: motoristaName,
      source: 'operational_pendencies_manual_update',
      metadata,
    });

  }

  async function handleManualStatusUpdate(row: IReceiptBacklogRow, nextStatus: ManualStopStatus) {
    const currentStatus = String(row.latest_stop_status || row.source_status || '').trim().toLowerCase() || 'pending';
    if (!canCorrectBacklogStatus(currentStatus, nextStatus)) {
      setStatusFeedback({
        invoiceNumber: row.invoice_number, companyId: row.company_id,
        tone: 'warning',
        message: 'Este status atual nao permite essa correcao manual.',
      });
      return;
    }

    if (nextStatus === 'cancelled') {
      const operationalTarget = resolveBacklogOperationalTarget(row);
      setCancelledReplacementDraft({
        invoiceNumber: row.invoice_number, companyId: row.company_id,
        tripNoteId: operationalTarget.tripNoteId,
        tripId: operationalTarget.tripId,
        motoristaId: operationalTarget.motoristaId,
        motoristaName: operationalTarget.motoristaName,
        currentStatus,
      });
      setReplacementInvoiceNumber('');
      setReplacementReason('Refaturada');
      setReplacementModalError('');
      return;
    }

    const confirmed = await showConfirm(
      `Confirmar ${getManualStopStatusLabel(nextStatus)} para NF ${row.invoice_number}?`,
      { title: 'Alterar status da entrega', confirmLabel: 'Alterar status' },
    );

    if (!confirmed) return;

    setStatusUpdate({ invoiceNumber: row.invoice_number, companyId: row.company_id, nextStatus });
    setStatusFeedback(null);

    try {
      await submitBacklogStatusUpdate({ row, nextStatus });
      await loadBacklog(activeTab);
      setStatusFeedback({
        invoiceNumber: row.invoice_number, companyId: row.company_id,
        tone: 'success',
        message: `NF ${row.invoice_number} atualizada com sucesso para ${getManualStopStatusLabel(nextStatus)}.`,
      });
    } catch (error) {
      if (handleAuthenticationError(error)) return;
      setStatusFeedback({
        invoiceNumber: row.invoice_number, companyId: row.company_id,
        tone: 'danger',
        message: axios.isAxiosError(error)
          ? String(error.response?.data?.message || error.response?.data?.error || 'Nao foi possivel corrigir o status desta NF.')
          : error instanceof Error
            ? error.message
            : 'Nao foi possivel corrigir o status desta NF.',
      });
    } finally {
      setStatusUpdate((current) => (
        current?.invoiceNumber === row.invoice_number ? null : current
      ));
    }
  }

  async function handleConfirmCancelledReplacement() {
    if (!cancelledReplacementDraft) return;

    const replacementInvoice = String(replacementInvoiceNumber || '').trim();
    if (!replacementInvoice) {
      setReplacementModalError('Informe a NF nova para concluir o cancelamento.');
      return;
    }

    if (replacementInvoice === cancelledReplacementDraft.invoiceNumber) {
      setReplacementModalError('A NF nova precisa ser diferente da NF cancelada.');
      return;
    }

    const row = rows.find((candidate) => candidate.invoice_number === cancelledReplacementDraft.invoiceNumber && candidate.company_id === cancelledReplacementDraft.companyId);
    if (!row) {
      setReplacementModalError('Nao foi possivel localizar a NF na lista atual.');
      return;
    }

    setStatusUpdate({
      invoiceNumber: cancelledReplacementDraft.invoiceNumber, companyId: cancelledReplacementDraft.companyId,
      nextStatus: 'cancelled',
    });
    setReplacementModalError('');

    try {
      await submitBacklogStatusUpdate({
        row,
        nextStatus: 'cancelled',
        replacementInvoice,
        replacementReasonValue: replacementReason,
      });
      await loadBacklog(activeTab);
      setStatusFeedback({
        invoiceNumber: cancelledReplacementDraft.invoiceNumber, companyId: cancelledReplacementDraft.companyId,
        tone: 'success',
        message: `NF ${cancelledReplacementDraft.invoiceNumber} cancelada e vinculada à NF ${replacementInvoice}.`,
      });
      setCancelledReplacementDraft(null);
      setReplacementInvoiceNumber('');
      setReplacementReason('Refaturada');
    } catch (error) {
      if (handleAuthenticationError(error)) return;
      setReplacementModalError(axios.isAxiosError(error)
        ? String(error.response?.data?.message || error.response?.data?.error || 'Nao foi possivel concluir o cancelamento.')
        : error instanceof Error
          ? error.message
          : 'Nao foi possivel concluir o cancelamento.');
    } finally {
      setStatusUpdate((current) => (
        current?.invoiceNumber === cancelledReplacementDraft.invoiceNumber ? null : current
      ));
    }
  }

  const summaryCards: ReceiptBacklogQueueType[] = ['redelivery', 'unassigned', 'returned', 'retained', 'pending'];
  const activeTabConfig = activeTab in BACKLOG_TAB_CONFIG ? BACKLOG_TAB_CONFIG[activeTab as ReceiptBacklogQueueType] : { label: 'Pendências de entrega', emptyMessage: 'Nenhuma pendência encontrada.', tone: 'info' as SemanticTone };
  const visibleRows = rows.filter((row) => activeTab === 'all' || row.queue_type === activeTab);
  const visiblePendingOccurrences = pendingOccurrences.filter((occurrence) => (
    (!nfFilter || String(occurrence.invoice_number || '').includes(nfFilter))
    && (!selectedMotoristaFilterId || Number(occurrence.motorista_id) === selectedMotoristaFilterId)
    && (!startDate || String(occurrence.trip_date || occurrence.created_at || '').slice(0, 10) >= startDate)
    && (!endDate || String(occurrence.trip_date || occurrence.created_at || '').slice(0, 10) <= endDate)
  ));

  return (
    <div>
      <Header />
      <Container className="operation-page">
        <div className="w-full max-w-[var(--content-max-width)] space-y-3">
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <OperationalPageIntro title="Central de Tratativas" description="Todas as pendências da operação, reunidas por assunto. Filtre para encontrar o que precisa de atenção." />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-muted">
                  Dados desde {formatDateOnly(cutoffDate) || '-'}
                </span>
                <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${getSemanticToneClassName('info')}`}>
                  {`Total em tratativa: ${summary.total + pendingOccurrences.length + botAlertCount}`}
                </span>
                <button
                  type="button"
                  onClick={handleSearch}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-text transition hover:bg-surface-2"
                >
                  <RefreshCcw className="h-4 w-4" /> Atualizar
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_150px_150px_auto_auto]">
              <label className="text-xs text-muted">
                NF
                <input
                  value={nfFilter}
                  onChange={(event) => setNfFilter(event.target.value)}
                  placeholder="Buscar por NF"
                  className="mt-1 h-9 w-full rounded-sm border border-border bg-card px-3 text-sm text-text"
                />
              </label>

              <label className="text-xs text-muted">
                Motorista
                <select
                  value={motoristaFilter}
                  onChange={(event) => setMotoristaFilter(event.target.value)}
                  className="mt-1 h-9 w-full rounded-sm border border-border bg-card px-3 text-sm text-text"
                >
                  <option value="">Todos</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-muted">
                Data inicio
                <input
                  ref={startDateInputRef}
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  onClick={() => openNativeDatePicker(startDateInputRef.current)}
                  className="mt-1 h-9 w-full cursor-pointer rounded-sm border border-border bg-card px-3 text-sm text-text"
                />
              </label>

              <label className="text-xs text-muted">
                Data fim
                <input
                  ref={endDateInputRef}
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  onClick={() => openNativeDatePicker(endDateInputRef.current)}
                  className="mt-1 h-9 w-full cursor-pointer rounded-sm border border-border bg-card px-3 text-sm text-text"
                />
              </label>

              <button
                type="button"
                onClick={handleSearch}
                className="h-9 self-end rounded-md border border-border bg-surface-2 px-3 text-sm font-semibold text-text-accent transition hover:bg-surface-2"
              >
                <span className="inline-flex items-center gap-2"><Search className="h-4 w-4" /> Buscar</span>
              </button>

              <button
                type="button"
                onClick={handleClearFilters}
                className="h-9 self-end rounded-md border border-border bg-card px-3 text-sm text-text transition hover:bg-surface-2"
              >
                Limpar
              </button>
            </div>

            {pageError ? (
              <div className="mt-3 rounded-md border semantic-panel-danger px-3 py-2 text-sm">
                {pageError}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <button type="button" onClick={() => setActiveTab('all')} aria-pressed={activeTab === 'all'} className={`rounded-xl border p-3 text-left ${activeTab === 'all' ? 'semantic-solid-info' : 'border-border bg-card'}`}><p className="text-xs font-bold uppercase">Todas as pendências</p><p className="mt-1 text-2xl font-black">{summary.total + pendingOccurrences.length + botAlertCount}</p></button>
              <button
                type="button"
                onClick={() => setActiveTab('occurrences')}
                className="rounded-md border border-border bg-surface-2 px-3 py-2 text-left text-text transition hover:bg-surface-2"
              >
                <p className="text-xs uppercase tracking-[0.12em]">Ocorrências abertas</p>
                <p className="mt-1 text-2xl font-semibold">{pendingOccurrences.length}</p>
              </button>
              <button type="button" onClick={() => setActiveTab('alerts')} aria-pressed={activeTab === 'alerts'} className="rounded-xl border border-border bg-card p-3 text-left font-bold">Alertas do bot <span className="mt-1 block text-2xl font-black">{botAlertCount}</span></button>
              {summaryCards.map((tab) => (
                <button
                  key={`summary-${tab}`}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  aria-pressed={activeTab === tab}
                  className={`rounded-md border px-3 py-2 text-left transition hover:brightness-95 ${getBacklogTabClassName(tab, activeTab === tab)}`}
                >
                  <p className="text-xs uppercase tracking-[0.18em]">{BACKLOG_TAB_CONFIG[tab].summaryLabel}</p>
                  <p className="mt-1 text-2xl font-semibold">{summary[tab] || 0}</p>
                </button>
              ))}
            </div>

            {['all', 'occurrences'].includes(activeTab) && <section ref={occurrenceSectionRef} className="mt-3 scroll-mt-24 rounded-md border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
                    <ClipboardCheck className="h-4 w-4 text-accent" /> Ocorrências abertas
                  </h3>
                  <p className="text-xs text-muted">
                    As ocorrências permanecem nesta fila até a conclusão da tratativa. Após 3 dias, também ganham destaque no início.
                  </p>
                </div>
                <Badge tone={pendingOccurrences.length ? 'warning' : 'success'} className="h-auto px-2 py-1 text-[11px]">
                  {`${visiblePendingOccurrences.length} ocorrência(s)`}
                </Badge>
              </div>

              {occurrenceError ? <p role="alert" className="mt-3 text-sm">{occurrenceError}</p> : !visiblePendingOccurrences.length ? (
                <p className="mt-3 text-sm text-muted">
                  {nfFilter ? 'Nenhuma ocorrência aberta encontrada para esta NF.' : 'Nenhuma ocorrência aberta no momento.'}
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 lg:grid-cols-2">
                  {visiblePendingOccurrences.map((occurrence) => {
                    const ageDays = getOccurrenceAgeDays(occurrence);
                    const isOverdue = isTreatmentOverdue(ageDays);
                    return (
                      <li
                        key={`central-occurrence-${occurrence.id}`}
                        className={`rounded-xl border p-4 ${isOverdue ? 'semantic-panel-danger' : 'border-border bg-surface'}`}
                      >
                        <div className="flex h-full flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-text">NF {occurrence.invoice_number || '-'}</p>
                            <Badge tone={isOverdue ? 'danger' : 'warning'} className="h-auto px-2 py-0.5 text-[10px]">
                              {ageDays === 0 ? 'Aberta hoje' : `${ageDays} dia(s) em aberto`}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted">
                            {OCCURRENCE_REASON_LABELS[String(occurrence.reason || '')] || 'Ocorrência operacional'}
                          </p>
                          <p className="text-xs text-muted">
                            {occurrence.customer_name || 'Cliente não informado'} · {occurrence.city || '-'}
                          </p>
                          <MissingCargoOccurrenceDetails occurrence={occurrence} />
                          <button
                            type="button"
                            onClick={() => navigate(`/returns-occurrences?tab=occurrences&nf=${encodeURIComponent(occurrence.invoice_number || '')}`)}
                            className="mt-auto inline-flex h-8 self-end items-center justify-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-xs font-semibold text-text-accent hover:bg-surface-2"
                          >
                            Abrir tratativa <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>}

            {!['occurrences', 'alerts'].includes(activeTab) && <div className="mt-3 rounded-md border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-text">{activeTabConfig.label}</h3>
                  <p className="text-xs text-muted">
                    {activeTab === 'all' ? 'Notas que precisam de ação. Consulte o motorista, a carga e a última viagem em cada card.' : activeTab === 'redelivery'
                      ? 'Reentregas aguardando inclusão em uma NOVA rota. Ao atribuir a rota, a NF sai desta fila.'
                      : activeTab === 'unassigned'
                        ? 'NFs abertas que ainda não receberam nenhuma rota ou motorista.'
                        : activeTab === 'returned'
                          ? 'Devoluções que ainda exigem encaminhamento operacional.'
                      : activeTab === 'retained'
                        ? 'NFs marcadas como canhoto retido para acompanhar a coleta do comprovante na proxima entrega.'
                        : 'NFs que já passaram de um dia para outro em rota, mas continuam sem foto de canhoto.'}
                  </p>
                </div>
                <Badge tone={activeTabConfig.tone} className="h-auto px-2 py-1 text-[11px]">
                  {`${visibleRows.length} NF(s) exibidas`}
                </Badge>
              </div>

              {loading ? (
                <p className="mt-3 text-sm text-muted">Carregando pendencias operacionais...</p>
              ) : !visibleRows.length ? (
                <p className="mt-3 text-sm text-muted">{activeTabConfig.emptyMessage}</p>
              ) : (
                <ul className="mt-3 grid gap-3 xl:grid-cols-2">
                  {visibleRows.map((row) => {
                    const operationalStatus = row.latest_stop_status || row.source_status || '';
                    const ageDays = Number(row.age_days || 0);
                    const ageLabel = ageDays > 0 ? `${ageDays} dia(s) em aberto` : 'Movimento do dia';
                    const normalizedOperationalStatus = String(operationalStatus || '').trim().toLowerCase() || 'pending';
                    const operationalTarget = resolveBacklogOperationalTarget(row);
                    const canEditStatus = Boolean(operationalTarget.tripNoteId && operationalTarget.motoristaId);
                    const availableStatusActions = canEditStatus
                      ? MANUAL_STOP_STATUS_ACTIONS.filter((action) => canCorrectBacklogStatus(normalizedOperationalStatus, action.status))
                      : [];
                    const currentStatusUpdate = statusUpdate?.invoiceNumber === row.invoice_number && statusUpdate.companyId === row.company_id ? statusUpdate : null;
                    const currentStatusFeedback = statusFeedback?.invoiceNumber === row.invoice_number && statusFeedback.companyId === row.company_id ? statusFeedback : null;

                    return (
                      <li key={`${row.company_id}-${row.queue_type}-${row.invoice_number}-${row.trip_id || 'sem-rota'}`} className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-text">NF {row.invoice_number}</p>
                              <Badge tone={getOperationalStatusTone(operationalStatus)} className="h-auto px-2 py-0.5 text-[10px]">
                                {getOperationalStatusLabel(operationalStatus)}
                              </Badge>
                              <Badge tone={BACKLOG_TAB_CONFIG[row.queue_type].tone} className="h-auto px-2 py-0.5 text-[10px]">
                                {BACKLOG_TAB_CONFIG[row.queue_type].summaryLabel}
                              </Badge>
                              <Badge tone={getAgeBadgeTone(row)} className="h-auto px-2 py-0.5 text-[10px]">
                                {ageLabel}
                              </Badge>
                              {!row.motorista_name ? (
                                <Badge tone="neutral" className="h-auto px-2 py-0.5 text-[10px]">
                                  Sem motorista
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-muted">{row.customer_name || 'Cliente nao informado'} · {row.city || '-'}</p>
                            <p className="text-muted">{row.company_name || ''} · Motorista: {row.motorista_name || '-'}</p>
                            <p className="text-muted">Data NF: {formatDateOnly(row.invoice_date)} · Data rota: {formatDateOnly(row.trip_date || null)}</p>
                            <p className="text-muted">Carga: {row.load_number || '-'} · Viagem: {row.trip_id || '-'} · Rota: {row.rota_id || '-'}</p>
                            <p className="text-muted">Ultimo canhoto: {formatDateTime(row.receipt_created_at || null)}</p>

                            {Array.isArray(row.route_history) && row.route_history.length ? (
                              <details
                                className="mt-2 rounded-md border border-border bg-card p-2"
                                open={shouldExpandRouteHistory(row)}
                              >
                                <summary className="cursor-pointer list-none text-[11px] font-semibold text-text">
                                  Historico de saidas ({row.route_history.length})
                                </summary>
                                <div className="mt-2 space-y-2">
                                  {row.route_history.map((historyRow, index) => {
                                    const isCurrent = isCurrentRouteHistoryEntry(row, historyRow);
                                    const historyStatus = historyRow.note_status || '';

                                    return (
                                      <div
                                        key={getRouteHistoryEntryKey(row, historyRow, index)}
                                        className="rounded-sm border border-border bg-surface px-2 py-2"
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="text-[11px] font-semibold text-text">
                                            {formatDateOnly(historyRow.trip_date || null)}
                                          </p>
                                          <Badge tone={getOperationalStatusTone(historyStatus)} className="h-auto px-2 py-0.5 text-[10px]">
                                            {getOperationalStatusLabel(historyStatus)}
                                          </Badge>
                                          {isCurrent ? (
                                            <Badge tone="info" className="h-auto px-2 py-0.5 text-[10px]">
                                              Saida atual
                                            </Badge>
                                          ) : (
                                            <Badge tone="neutral" className="h-auto px-2 py-0.5 text-[10px]">
                                              Historico
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="mt-1 text-muted">
                                          Motorista: {historyRow.motorista_name || '-'} · Viagem: {historyRow.trip_id || '-'}
                                        </p>
                                        <p className="text-muted">
                                          Registro: {formatDateTime(historyRow.updated_at || historyRow.created_at || null)}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </details>
                            ) : null}
                          </div>

                          <div className="flex min-w-[180px] flex-col items-stretch gap-2">
                            <p className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted">Publique a foto no grupo com somente o número da NF na legenda. O sistema atualiza a entrega automaticamente.</p>
                            {availableStatusActions.length ? (
                              <div className="rounded-md border border-border bg-card px-3 py-2">
                                <p className="text-[11px] font-semibold text-text">Corrigir status</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {availableStatusActions.map((action) => {
                                    const isLoading = currentStatusUpdate?.nextStatus === action.status;
                                    const disabled = Boolean(currentStatusUpdate);

                                    return (
                                      <button
                                        key={`${row.invoice_number}-${action.status}`}
                                        type="button"
                                        onClick={() => handleManualStatusUpdate(row, action.status)}
                                        disabled={disabled}
                                        className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${getSemanticToneClassName(action.tone)} ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:brightness-95'}`}
                                      >
                                        {isLoading ? 'Salvando...' : action.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                {currentStatusFeedback ? (
                                  <div className={`mt-2 rounded-md border px-2 py-1.5 text-[11px] ${getSemanticToneClassName(currentStatusFeedback.tone, 'panel')}`}>
                                    {currentStatusFeedback.message}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>}
            <div hidden={!['all', 'alerts'].includes(activeTab)}><CentralBotAlerts nf={nfFilter} refreshKey={refreshKey} onCount={setBotAlertCount} /></div>
          </section>
        </div>

        {isUploadModalOpen && receiptCorrectionNotificationId ? (
          <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/65 p-3">
            <form onSubmit={handleReceiptCorrectionSubmit} className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-bold">Corrigir número informado</h2>
              <p className="text-sm text-muted">A postagem informou {receiptCorrectionReportedNf || 'uma NF incorreta'}. Registre a correção e publique uma nova foto no grupo com somente o número correto.</p>
              <label className="block text-sm">NF correta<input value={uploadNfId} onChange={(event) => setUploadNfId(event.target.value.replace(/\D/g, '').slice(0, 9))} className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3" /></label>
              {uploadError && <p role="alert">{uploadError}</p>}
              <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={closeUploadModal} className="rounded-lg border border-border px-4 py-2">Voltar</button><button type="submit" disabled={uploading} className="rounded-lg semantic-solid-info px-4 py-2">Registrar NF correta</button></div>
            </form>
          </div>
        ) : null}

        {cancelledReplacementDraft ? (
          <div className="fixed inset-0 z-[1320] flex items-center justify-center bg-black/65 p-3">
            <div className="w-full max-w-[520px] rounded-md border border-border bg-surface p-4 shadow-[var(--shadow-3)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-text">
                    {`Cancelar NF ${cancelledReplacementDraft.invoiceNumber} por refaturamento`}
                  </h3>
                  <p className="text-xs text-muted">
                    Informe a NF nova para manter o vínculo visível nas buscas e auditorias.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeReplacementModal}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-text disabled:opacity-50"
                  disabled={statusUpdate?.invoiceNumber === cancelledReplacementDraft.invoiceNumber}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 space-y-3">
                <label className="text-xs text-muted">
                  NF nova
                  <input
                    value={replacementInvoiceNumber}
                    onChange={(event) => setReplacementInvoiceNumber(event.target.value)}
                    placeholder="Ex.: 1722999"
                    className="mt-1 h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-text"
                    disabled={statusUpdate?.invoiceNumber === cancelledReplacementDraft.invoiceNumber}
                  />
                </label>

                <label className="text-xs text-muted">
                  Motivo/observacao
                  <input
                    value={replacementReason}
                    onChange={(event) => setReplacementReason(event.target.value)}
                    placeholder="Refaturada"
                    className="mt-1 h-10 w-full rounded-sm border border-border bg-card px-3 text-sm text-text"
                    disabled={statusUpdate?.invoiceNumber === cancelledReplacementDraft.invoiceNumber}
                  />
                </label>

                {replacementModalError ? (
                  <div className="rounded-md border semantic-panel-danger px-3 py-2 text-sm">
                    {replacementModalError}
                  </div>
                ) : null}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeReplacementModal}
                    className="h-10 rounded-md border border-border bg-card px-4 text-sm text-text disabled:opacity-50"
                    disabled={statusUpdate?.invoiceNumber === cancelledReplacementDraft.invoiceNumber}
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCancelledReplacement}
                    className={`h-10 rounded-md border px-4 text-sm font-semibold ${getSemanticToneClassName('neutral')} ${statusUpdate?.invoiceNumber === cancelledReplacementDraft.invoiceNumber ? 'cursor-not-allowed opacity-70' : 'hover:brightness-95'}`}
                    disabled={statusUpdate?.invoiceNumber === cancelledReplacementDraft.invoiceNumber}
                  >
                    {statusUpdate?.invoiceNumber === cancelledReplacementDraft.invoiceNumber ? 'Salvando...' : 'Confirmar cancelamento'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Container>
    </div>
  );
}

export default OperationalPendencies;
