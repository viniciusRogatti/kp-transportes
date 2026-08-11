import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FilePlus2,
  Link2,
  PackageCheck,
  RefreshCcw,
  RotateCcw,
  Search,
  Undo2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { Container } from '../style/invoices';
import { showAlert, showConfirm } from '../utils/dialog';
import { formatDateBR, formatDateTimeBR } from '../utils/dateDisplay';
import verifyToken from '../utils/verifyToken';
import {
  ReceiptBag,
  ReceiptBagApiError,
  ReceiptBagItem,
  ReceiptBagItemStatus,
  ReceiptBagListResponse,
  ReceiptBagListRow,
  ReceiptBagPendingItem,
  ReceiptBagStatus,
  HistoricalReceiptRoutesResponse,
  addExtraReceiptBagInvoice,
  finishReceiptBagClosing,
  getReceiptBagClosing,
  listHistoricalReceiptRoutes,
  listReceiptBagClosings,
  markRemainingReceiptBagItemsAbsent,
  startReceiptBagClosing,
  updateReceiptBagItem,
} from '../services/receiptBagClosingService';

type ViewFilter = 'pending' | 'overdue' | 'completed' | 'all';
type ItemFilter = 'all' | 'pending' | 'confirmed' | 'absent' | 'exceptions';

const todayInput = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const formatDate = (value: string) => {
  return formatDateBR(value);
};
const formatDateTime = (value?: string | null) => {
  return formatDateTimeBR(value);
};

const BAG_STATUS: Record<ReceiptBagStatus, { label: string; className: string }> = {
  not_started: { label: 'Não iniciado', className: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200' },
  in_progress: { label: 'Em conferência', className: 'border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200' },
  completed: { label: 'Conferido', className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  completed_with_pending: { label: 'Conferido com pendências', className: 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200' },
};
const ITEM_STATUS: Record<ReceiptBagItemStatus, { label: string; badge: string; row: string }> = {
  pending: { label: 'Aguardando', badge: 'semantic-solid-neutral', row: 'semantic-panel-neutral shadow-sm hover:border-slate-500' },
  confirmed: { label: 'Presente', badge: 'semantic-solid-success', row: 'semantic-panel-success' },
  absent: { label: 'Ausente', badge: 'semantic-solid-danger', row: 'semantic-panel-danger' },
  recovered: { label: 'Recuperado', badge: 'semantic-solid-success', row: 'semantic-panel-success' },
  resolved_elsewhere: { label: 'Em outro malote', badge: 'semantic-solid-info', row: 'semantic-panel-info' },
  returned: { label: 'Devolução', badge: 'semantic-solid-danger', row: 'semantic-panel-danger' },
  retained: { label: 'Retido no cliente', badge: 'semantic-solid-warning', row: 'semantic-panel-warning' },
  redelivery: { label: 'Reentrega', badge: 'semantic-solid-redelivery', row: 'semantic-panel-redelivery' },
  cancelled: { label: 'Cancelada', badge: 'semantic-solid-neutral', row: 'semantic-panel-neutral' },
};
const CLOSED_STATUSES = ['confirmed', 'recovered', 'resolved_elsewhere'];
const EXEMPT_STATUSES = ['returned', 'retained', 'redelivery', 'cancelled'];
const DELIVERY_STATUSES = ['delivered', 'completed'];

const errorPayload = (error: unknown): ReceiptBagApiError => (
  axios.isAxiosError(error) ? (error.response?.data || {}) as ReceiptBagApiError : {}
);
const errorMessage = (error: unknown, fallback: string) => {
  const payload = errorPayload(error);
  return payload.error || (error instanceof Error ? error.message : '') || fallback;
};

export const getRecoveredReceiptOrigin = (
  bag: ReceiptBag,
  reference: { itemId?: number; invoiceNumber?: string },
) => {
  const normalizedInvoice = String(reference.invoiceNumber || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const item = bag.items.find((candidate) => {
    const matchesReference = reference.itemId
      ? candidate.id === reference.itemId
      : String(candidate.invoice_number).replace(/\D/g, '').replace(/^0+(?=\d)/, '') === normalizedInvoice;
    return matchesReference
      && candidate.status === 'recovered'
      && candidate.origin_bag
      && candidate.origin_bag.trip_id !== bag.trip_id;
  });
  return item?.origin_bag || null;
};

const showRecoveredReceiptAlert = async (invoiceNumber: string, origin: NonNullable<ReceiptBagItem['origin_bag']>) => {
  await showAlert(
    `O canhoto da NF ${invoiceNumber} estava AUSENTE no malote da rota #${origin.trip_id}`
    + `${origin.driver_name ? `, do motorista ${origin.driver_name}` : ''}.\n\n`
    + 'Ele foi localizado e confirmado neste malote.',
    { title: 'Canhoto ausente localizado', okLabel: 'Entendi' },
  );
};

function BagBadge({ status }: { status: ReceiptBagStatus }) {
  const config = BAG_STATUS[status];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${config.className}`}>{config.label}</span>;
}

function SummaryCard({ label, value, icon, tone = '' }: {
  label: string; value: number; icon: JSX.Element; tone?: 'red' | 'amber' | 'green' | '';
}) {
  const toneClass = tone === 'red' ? 'semantic-panel-danger'
    : tone === 'amber' ? 'semantic-panel-warning'
      : tone === 'green' ? 'semantic-panel-success'
        : 'border-border bg-card';
  return (
    <div className={`rounded-lg border px-2.5 py-2 shadow-sm ${toneClass}`}>
      <div className="flex items-start justify-between gap-1.5 text-muted">
        <span className="text-[10px] font-bold uppercase leading-tight tracking-[0.08em]">{label}</span>
        <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </div>
      <p className="mt-1 text-2xl font-black leading-none text-text">{value}</p>
    </div>
  );
}

function ReceiptBagClosing() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayInput);
  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('pending');
  const [looseReceiptSearch, setLooseReceiptSearch] = useState('');
  const [data, setData] = useState<ReceiptBagListResponse | null>(null);
  const [activeBag, setActiveBag] = useState<ReceiptBag | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [itemFilter, setItemFilter] = useState<ItemFilter>('all');
  const [itemSearch, setItemSearch] = useState('');
  const [extraInvoice, setExtraInvoice] = useState('');
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [historicalRoutes, setHistoricalRoutes] = useState<HistoricalReceiptRoutesResponse | null>(null);
  const [selectedHistoricalTripId, setSelectedHistoricalTripId] = useState<number | null>(null);
  const [historicalRouteDate, setHistoricalRouteDate] = useState('');
  const [historicalReasonNotes, setHistoricalReasonNotes] = useState('');
  const [loadingHistoricalRoutes, setLoadingHistoricalRoutes] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }
    void verifyToken(token).then((valid) => {
      if (!valid) navigate('/');
    });
  }, [navigate]);

  const loadList = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError('');
    try {
      setData(await listReceiptBagClosings(date));
    } catch (requestError) {
      if (!silent) setError(errorMessage(requestError, 'Não foi possível carregar os malotes.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void loadList();
    const interval = window.setInterval(() => void loadList(true), 20000);
    return () => window.clearInterval(interval);
  }, [loadList]);

  const activeBagId = activeBag?.id || null;
  useEffect(() => {
    if (!activeBagId) return undefined;
    const interval = window.setInterval(async () => {
      try { setActiveBag(await getReceiptBagClosing(activeBagId)); } catch { /* atualização silenciosa */ }
    }, 12000);
    return () => window.clearInterval(interval);
  }, [activeBagId]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return (data?.rows || []).filter((row) => {
      const matchesFilter = viewFilter === 'all'
        || (viewFilter === 'overdue' && row.is_overdue)
        || (viewFilter === 'completed' && row.status === 'completed')
        || (viewFilter === 'pending' && row.status !== 'completed');
      return matchesFilter && (!term || [
        row.trip_id, row.driver?.name, row.car?.license_plate, row.company?.name, row.company?.code,
      ].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term)));
    });
  }, [data, search, viewFilter]);

  const looseReceiptMatches = useMemo(() => {
    const term = looseReceiptSearch.trim().toLocaleLowerCase('pt-BR');
    if (!term) return (data?.pending_items || []).slice(0, 8);
    return (data?.pending_items || []).filter((item) => (
      [item.invoice_number, item.customer_name, item.city, item.driver?.name, item.trip_id]
        .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term))
    )).slice(0, 12);
  }, [data, looseReceiptSearch]);

  const visibleItems = useMemo(() => {
    const term = itemSearch.trim().toLocaleLowerCase('pt-BR');
    return (activeBag?.items || []).filter((item) => {
      const matchesFilter = itemFilter === 'all'
        || (itemFilter === 'pending' && item.status === 'pending')
        || (itemFilter === 'confirmed' && CLOSED_STATUSES.includes(item.status))
        || (itemFilter === 'absent' && item.status === 'absent')
        || (itemFilter === 'exceptions' && EXEMPT_STATUSES.includes(item.status));
      return matchesFilter && (!term || [item.invoice_number, item.customer_name, item.city]
        .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term)));
    }).sort((left, right) => {
      const leftPending = left.status === 'pending' ? 0 : 1;
      const rightPending = right.status === 'pending' ? 0 : 1;
      return leftPending - rightPending
        || Number(left.route_order ?? Number.MAX_SAFE_INTEGER) - Number(right.route_order ?? Number.MAX_SAFE_INTEGER)
        || left.invoice_number.localeCompare(right.invoice_number, 'pt-BR', { numeric: true });
    });
  }, [activeBag, itemFilter, itemSearch]);
  const selectedItem = activeBag?.items.find((item) => item.id === selectedItemId) || null;

  const applyBag = (bag: ReceiptBag, message: string) => {
    setActiveBag(bag);
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 2500);
  };

  const confirmLooseReceipt = async (item: ReceiptBagPendingItem) => {
    if (mutating || !['pending', 'absent'].includes(item.status)) return;
    if (!await showConfirm(
      `Confirmar que o canhoto avulso da NF ${item.invoice_number} foi localizado?\n\n`
      + `Ele pertence ao malote da rota #${item.trip_id}${item.driver?.name ? `, de ${item.driver.name}` : ''}.`,
      { title: 'Canhoto avulso', confirmLabel: 'Confirmar localização' },
    )) return;
    setMutating(true);
    setError('');
    try {
      await updateReceiptBagItem(item.bag_id, item.item_id, 'confirm');
      setLooseReceiptSearch('');
      setFeedback(`NF ${item.invoice_number} localizada. O malote aguardará a postagem da foto no grupo.`);
      await loadList(true);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Não foi possível confirmar o canhoto avulso.'));
    } finally {
      setMutating(false);
    }
  };

  const openClosing = async (row: ReceiptBagListRow) => {
    setMutating(true);
    setError('');
    try {
      const bag = row.status === 'not_started'
        ? await startReceiptBagClosing(row.trip_id)
        : await getReceiptBagClosing(row.bag_id as number);
      setActiveBag(bag);
      setSelectedItemId(null);
      setItemFilter('all');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Não foi possível iniciar a conferência.'));
    } finally { setMutating(false); }
  };

  const mutateItem = useCallback(async (
    item: ReceiptBagItem,
    action: 'confirm' | 'absent' | 'returned',
    forceTransfer = false,
  ): Promise<boolean> => {
    if (!activeBag || mutating) return false;
    if (action === 'absent' && item.is_suggested_extra) {
      setError('Uma NF apenas sugerida para este malote não pode ser marcada como ausente aqui.');
      return false;
    }
    if (
      action === 'confirm'
      && !forceTransfer
      && !item.has_whatsapp_photo
      && !await showConfirm(
        `A NF ${item.invoice_number} ainda está sem foto de canhoto.\n\n`
        + 'O documento físico está realmente neste malote?',
        { title: 'Canhoto sem foto', confirmLabel: 'Confirmar presença' },
      )
    ) return false;
    if (action === 'returned' && !await showConfirm(
      `Registrar a NF ${item.invoice_number} como devolução?\n\nIsso removerá a necessidade do canhoto e atualizará a jornada da NF.`,
      { title: 'Registrar devolução', confirmLabel: 'Registrar devolução', tone: 'danger' },
    )) return false;
    setMutating(true);
    setError('');
    try {
      const bag = await updateReceiptBagItem(activeBag.id, item.id, action, { forceTransfer });
      const recoveredOrigin = action === 'confirm'
        ? getRecoveredReceiptOrigin(bag, { itemId: item.id })
        : null;
      applyBag(bag, action === 'confirm'
        ? item.status === 'absent' ? `NF ${item.invoice_number} recuperada.` : `NF ${item.invoice_number} confirmada.`
        : action === 'absent' ? `NF ${item.invoice_number} marcada como ausente.`
          : `Devolução da NF ${item.invoice_number} registrada.`);
      setSelectedItemId(null);
      void loadList(true);
      if (recoveredOrigin) await showRecoveredReceiptAlert(item.invoice_number, recoveredOrigin);
      return true;
    } catch (requestError) {
      const payload = errorPayload(requestError);
      if (payload.code === 'RECEIPT_ALREADY_CONFIRMED' && !forceTransfer) {
        const correction = await showConfirm(
          `${payload.error || 'Esta NF já foi confirmada em outro malote.'}\n\n`
          + `Local atual: ${payload.details?.driver_name || 'outro motorista'}`
          + `${payload.details?.trip_id ? ` — rota #${payload.details.trip_id}` : ''}.\n\n`
          + `Corrigir a localização para o malote de ${activeBag.driver?.name || 'motorista atual'}?`,
          { title: 'Canhoto em outro malote', confirmLabel: 'Corrigir localização' },
        );
        if (correction) {
          setMutating(false);
          return await mutateItem(item, action, true);
        }
      } else setError(errorMessage(requestError, 'Não foi possível atualizar o canhoto.'));
      return false;
    } finally { setMutating(false); }
  }, [activeBag, loadList, mutating]);

  useEffect(() => {
    if (!activeBag) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [activeBag]);

  const openHistoricalRouteSelection = useCallback(async (invoiceNumber: string, routeDate = '') => {
    if (!activeBag) return;
    setLoadingHistoricalRoutes(true);
    setError('');
    try {
      const response = await listHistoricalReceiptRoutes(activeBag.id, invoiceNumber, routeDate);
      setHistoricalRoutes(response);
      setHistoricalRouteDate(routeDate);
      setSelectedHistoricalTripId(response.routes[0]?.id || null);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Não foi possível buscar as rotas anteriores.'));
    } finally {
      setLoadingHistoricalRoutes(false);
    }
  }, [activeBag]);

  const addExtra = useCallback(async (forceTransfer = false) => {
    if (!activeBag || mutating || !extraInvoice.trim()) return;
    const invoice = extraInvoice.trim();
    setMutating(true);
    setError('');
    try {
      const bag = await addExtraReceiptBagInvoice(activeBag.id, invoice, { forceTransfer });
      const recoveredOrigin = getRecoveredReceiptOrigin(bag, { invoiceNumber: invoice });
      applyBag(bag, recoveredOrigin
        ? `NF ${invoice} recuperada de outro malote.`
        : `NF ${invoice} adicionada neste malote.`);
      setExtraInvoice('');
      void loadList(true);
      if (recoveredOrigin) await showRecoveredReceiptAlert(invoice, recoveredOrigin);
    } catch (requestError) {
      const payload = errorPayload(requestError);
      if (payload.code === 'RECEIPT_ALREADY_CONFIRMED' && !forceTransfer) {
        const correction = await showConfirm(
          `${payload.error || 'Esta NF já foi confirmada em outro malote.'}\n\n`
          + `Registro atual: rota #${payload.details?.trip_id || 'não identificada'}`
          + `${payload.details?.driver_name ? ` · ${payload.details.driver_name}` : ''}.\n\n`
          + 'Confira se este é o mesmo documento físico colocado no malote errado ou se existem dois canhotos duplicados. '
          + `Se for o mesmo documento, transfira a custódia para o malote de ${activeBag.driver?.name || 'motorista atual'}.`,
          { title: 'Possível canhoto duplicado', confirmLabel: 'Transferir custódia' },
        );
        if (correction) {
          setMutating(false);
          await addExtra(true);
          return;
        }
      } else if (payload.code === 'INVOICE_REQUIRES_HISTORICAL_ROUTE') {
        setMutating(false);
        await openHistoricalRouteSelection(invoice);
        return;
      } else setError(errorMessage(requestError, 'Não foi possível adicionar a NF.'));
    } finally { setMutating(false); }
  }, [activeBag, extraInvoice, loadList, mutating, openHistoricalRouteSelection]);

  const confirmHistoricalRoute = async () => {
    if (!activeBag || !historicalRoutes || !selectedHistoricalTripId || mutating) return;
    const route = historicalRoutes.routes.find((candidate) => candidate.id === selectedHistoricalTripId);
    if (!route) return;
    if (!await showConfirm(
      `Vincular a NF ${historicalRoutes.invoice.invoice_number} retroativamente à rota #${route.id}?\n\n`
      + `${route.driver?.name || 'Motorista'} · ${formatDate(route.date)} · ${route.car?.license_plate || 'sem placa'}\n\n`
      + (historicalRoutes.invoice.has_whatsapp_photo
        ? 'A postagem já localizada será preservada e a alteração ficará registrada na jornada.'
        : 'A NF será incluída como atribuída. Ela só ficará entregue depois que a foto for publicada no grupo com a legenda correta.'),
      { title: 'Vincular à rota histórica', confirmLabel: 'Vincular NF' },
    )) return;
    setMutating(true);
    setError('');
    try {
      const bag = await addExtraReceiptBagInvoice(activeBag.id, historicalRoutes.invoice.invoice_number, {
        historicalTripId: route.id,
        reasonNotes: historicalReasonNotes,
      });
      applyBag(bag, `NF ${historicalRoutes.invoice.invoice_number} vinculada à rota #${route.id} e confirmada.`);
      setHistoricalRoutes(null);
      setSelectedHistoricalTripId(null);
      setHistoricalRouteDate('');
      setHistoricalReasonNotes('');
      setExtraInvoice('');
      void loadList(true);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Não foi possível vincular a NF à rota histórica.'));
    } finally {
      setMutating(false);
    }
  };

  const confirmUnroutedExtra = async () => {
    if (!activeBag || !historicalRoutes || mutating) return;
    if (!await showConfirm(
      `Registrar a NF ${historicalRoutes.invoice.invoice_number} somente neste malote?\n\n`
      + 'A NF continuará pendente e sem vínculo com uma rota.',
      { title: 'Registrar sem rota', confirmLabel: 'Registrar no malote' },
    )) return;
    setMutating(true);
    setError('');
    try {
      const bag = await addExtraReceiptBagInvoice(activeBag.id, historicalRoutes.invoice.invoice_number, {
        allowUnrouted: true,
      });
      applyBag(bag, `NF ${historicalRoutes.invoice.invoice_number} registrada no malote sem alterar a entrega.`);
      setHistoricalRoutes(null);
      setSelectedHistoricalTripId(null);
      setHistoricalRouteDate('');
      setHistoricalReasonNotes('');
      setExtraInvoice('');
      void loadList(true);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Não foi possível registrar a NF no malote.'));
    } finally {
      setMutating(false);
    }
  };

  const markRemainingAbsent = async () => {
    if (!activeBag?.counts.pending || mutating) return;
    if (!await showConfirm(
      `Marcar ${activeBag.counts.pending} canhoto(s) restante(s) como ausente(s)?`,
      { title: 'Ausentar canhotos restantes', confirmLabel: 'Marcar como ausentes', tone: 'danger' },
    )) return;
    setMutating(true);
    try {
      applyBag(await markRemainingReceiptBagItemsAbsent(activeBag.id), 'Canhotos restantes marcados como ausentes.');
      void loadList(true);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Não foi possível atualizar os canhotos.'));
    } finally { setMutating(false); }
  };

  const finish = async () => {
    if (!activeBag || mutating) return;
    setMutating(true);
    setError('');
    try {
      let bag = activeBag;
      if (bag.counts.pending) {
        setMutating(false);
        if (!await showConfirm(
          `Ainda existem ${bag.counts.pending} canhoto(s) sem definição.\n\nMarcá-los como ausentes e finalizar?`,
          { title: 'Finalizar com pendências', confirmLabel: 'Ausentar e finalizar', tone: 'danger' },
        )) return;
        setMutating(true);
        bag = await markRemainingReceiptBagItemsAbsent(bag.id);
      }
      const finishedBag = await finishReceiptBagClosing(bag.id);
      await loadList(true);
      setActiveBag(null);
      setSelectedItemId(null);
      setItemSearch('');
      setExtraInvoice('');
      setHistoricalRoutes(null);
      setFeedback(finishedBag.status === 'completed_with_pending'
        ? 'Conferência registrada com divergências.'
        : 'Conferência finalizada.');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Não foi possível finalizar a conferência.'));
    } finally { setMutating(false); }
  };

  const closeBag = useCallback(() => {
    setActiveBag(null);
    setSelectedItemId(null);
    setItemSearch('');
    setExtraInvoice('');
    setHistoricalRoutes(null);
    setError('');
    void loadList(true);
  }, [loadList]);

  useEffect(() => {
    if (!activeBag) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '');
      if (event.key === 'Escape' && !typing && historicalRoutes && !loadingHistoricalRoutes && !mutating) {
        setHistoricalRoutes(null);
        return;
      }
      if (event.key === 'Escape' && !typing) return closeBag();
      if (typing || !selectedItem || mutating) return;
      if (event.key === 'Enter') { event.preventDefault(); void mutateItem(selectedItem, 'confirm'); }
      else if (event.key.toLowerCase() === 'a') { event.preventDefault(); void mutateItem(selectedItem, 'absent'); }
      else if (event.key.toLowerCase() === 'd') { event.preventDefault(); void mutateItem(selectedItem, 'returned'); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const index = visibleItems.findIndex((item) => item.id === selectedItem.id);
        const nextIndex = Math.max(0, Math.min(visibleItems.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
        if (visibleItems[nextIndex]) setSelectedItemId(visibleItems[nextIndex].id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeBag, closeBag, historicalRoutes, loadingHistoricalRoutes, mutateItem, mutating, selectedItem, visibleItems]);

  return (
    <>
      <Header />
      <Container className="h-dvh min-h-0 overflow-hidden pb-0">
        <main className="mx-auto flex h-full min-h-0 w-full max-w-[1500px] flex-col px-2 py-3 sm:px-4">
          <section data-tutorial="bag-page-intro" className="mb-3 flex shrink-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-600">Controle físico</p>
              <h1 className="text-2xl font-black text-text">Fechamento de Canhotos</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <label data-tutorial="bag-date-filter" className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold">
                <CalendarDays className="h-4 w-4 text-muted" />
                <input type="date" min={data?.operation_start_date || '2026-08-01'} value={date} onChange={(event) => setDate(event.target.value)} className="bg-transparent outline-none" />
              </label>
              <button type="button" onClick={() => void loadList()} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold hover:bg-muted/40">
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar
              </button>
            </div>
          </section>

          {error && !activeBag ? <ErrorBanner message={error} /> : null}
          {feedback && !activeBag ? <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-400 bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100"><CheckCircle2 className="h-5 w-5" />{feedback}</div> : null}

          <section className="grid shrink-0 grid-cols-2 gap-1.5 md:grid-cols-3 lg:grid-cols-6">
            <SummaryCard label="Malotes" value={data?.summary.bags || 0} icon={<PackageCheck className="h-5 w-5" />} />
            <SummaryCard label="Esperados" value={data?.summary.expected || 0} icon={<ClipboardCheck className="h-5 w-5" />} />
            <SummaryCard label="Conferidos" value={data?.summary.confirmed || 0} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
            <SummaryCard label="Canhotos pendentes" value={data?.summary.pending_receipts || 0} icon={<AlertCircle className="h-5 w-5" />} tone="amber" />
            <SummaryCard label="Malotes atrasados" value={data?.summary.overdue_bags || 0} icon={<Clock3 className="h-5 w-5" />} tone="red" />
            <SummaryCard label="Divergentes" value={data?.summary.divergent_bags || 0} icon={<Undo2 className="h-5 w-5" />} tone="amber" />
          </section>

          <section className="mt-3 shrink-0 rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black">Canhotos pendentes e avulsos</p>
                <p className="text-xs text-muted">Consulte por NF ou cliente. Cada NF aparece vinculada a um único malote responsável.</p>
              </div>
              <SearchBox value={looseReceiptSearch} onChange={setLooseReceiptSearch} placeholder="Digite a NF ou cliente do canhoto avulso..." />
            </div>
            {looseReceiptSearch.trim() ? (
              <div className="scrollbar-ui mt-3 max-h-44 overflow-auto rounded-xl border border-border">
                {looseReceiptMatches.length ? looseReceiptMatches.map((item) => (
                  <div key={`${item.company_id}-${item.item_id}`} className="flex flex-col gap-2 border-b border-border px-3 py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-black">NF {item.invoice_number} · {item.customer_name || 'Cliente não identificado'}</p>
                      <p className="text-xs text-muted">Rota #{item.trip_id} · {item.driver?.name || 'Motorista não identificado'} · {formatDate(item.operation_date)} · {ITEM_STATUS[item.status].label}</p>
                    </div>
                    {['pending', 'absent'].includes(item.status) ? (
                      <button type="button" disabled={mutating} onClick={() => void confirmLooseReceipt(item)} className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-xs font-black text-white hover:bg-sky-700 disabled:opacity-50">
                        Confirmar avulso
                      </button>
                    ) : (
                      <span className="shrink-0 rounded-full border border-amber-400 bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-100">Aguardando postagem no grupo</span>
                    )}
                  </div>
                )) : <p className="px-4 py-5 text-center text-sm font-semibold text-muted">Nenhuma pendência encontrada.</p>}
              </div>
            ) : null}
          </section>

          <section data-tutorial="bag-list" className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex shrink-0 flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
              <div data-tutorial="bag-status-filters" className="flex flex-wrap gap-2">
                {([['pending', 'Pendentes'], ['overdue', 'Atrasados'], ['completed', 'Conferidos'], ['all', 'Todos']] as Array<[ViewFilter, string]>).map(([key, label]) => (
                  <FilterButton key={key} active={viewFilter === key} onClick={() => setViewFilter(key)}>{label}</FilterButton>
                ))}
              </div>
              <SearchBox value={search} onChange={setSearch} placeholder="Buscar rota, motorista ou placa..." autoFocus />
            </div>
            {loading && !data ? <EmptyState text="Carregando malotes..." />
              : visibleRows.length ? <BagTable rows={visibleRows} mutating={mutating} onOpen={openClosing} />
                : <EmptyState text="Nenhum malote encontrado para os filtros atuais." />}
          </section>
        </main>
      </Container>

      {activeBag ? (
        <ConferencePanel
          bag={activeBag}
          items={visibleItems}
          selectedItem={selectedItem}
          itemFilter={itemFilter}
          itemSearch={itemSearch}
          extraInvoice={extraInvoice}
          error={error}
          feedback={feedback}
          mutating={mutating}
          onClose={closeBag}
          onSelect={setSelectedItemId}
          onFilter={setItemFilter}
          onSearch={setItemSearch}
          onExtraChange={setExtraInvoice}
          onExtra={() => void addExtra()}
          onMutate={mutateItem}
          onMarkRemaining={() => void markRemainingAbsent()}
          onFinish={() => void finish()}
        />
      ) : null}
      {activeBag && historicalRoutes ? (
        <HistoricalRouteDialog
          data={historicalRoutes}
          selectedTripId={selectedHistoricalTripId}
          routeDate={historicalRouteDate}
          reasonNotes={historicalReasonNotes}
          error={error}
          loading={loadingHistoricalRoutes || mutating}
          onSelect={setSelectedHistoricalTripId}
          onDateChange={(nextDate) => {
            setHistoricalRouteDate(nextDate);
            void openHistoricalRouteSelection(historicalRoutes.invoice.invoice_number, nextDate);
          }}
          onReasonNotesChange={setHistoricalReasonNotes}
          onClose={() => setHistoricalRoutes(null)}
          onConfirm={() => void confirmHistoricalRoute()}
          onUnrouted={() => void confirmUnroutedExtra()}
        />
      ) : null}
    </>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border semantic-panel-danger px-4 py-3 text-sm font-semibold">
      <AlertCircle className="h-5 w-5 shrink-0" />{message}
    </div>
  );
}
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-xl px-4 py-2 text-sm font-bold ${active ? 'bg-sky-600 text-white' : 'border border-border hover:bg-muted/40'}`}>{children}</button>;
}
function SearchBox({ value, onChange, placeholder, autoFocus = false, inputRef, onKeyDown, className = '' }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 ${className || 'lg:w-[390px]'}`}>
      <Search className="h-4 w-4 shrink-0 text-muted" />
      <input ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} aria-label={placeholder} autoFocus={autoFocus} className="w-full bg-transparent text-sm outline-none" />
      {value ? <button type="button" onClick={() => onChange('')} aria-label="Limpar busca"><X className="h-4 w-4 text-muted" /></button> : null}
    </label>
  );
}
function EmptyState({ text }: { text: string }) {
  return <div className="grid min-h-60 place-items-center px-6 text-center text-sm font-semibold text-muted">{text}</div>;
}

function HistoricalRouteDialog({
  data, selectedTripId, routeDate, reasonNotes, error, loading, onSelect, onDateChange,
  onReasonNotesChange, onClose, onConfirm, onUnrouted,
}: {
  data: HistoricalReceiptRoutesResponse;
  selectedTripId: number | null;
  routeDate: string;
  reasonNotes: string;
  error: string;
  loading: boolean;
  onSelect: (tripId: number) => void;
  onDateChange: (date: string) => void;
  onReasonNotesChange: (notes: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onUnrouted: () => void;
}) {
  const selectedRoute = data.routes.find((route) => route.id === selectedTripId);
  return (
    <div className="fixed inset-0 z-[1500] grid place-items-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="historical-route-title" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-surface text-text shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-border bg-card p-5 sm:p-6">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200">
              <Link2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Entrega sem roteirização</p>
              <h2 id="historical-route-title" className="mt-1 text-xl font-black sm:text-2xl">Vincular a NF {data.invoice.invoice_number} à rota real</h2>
              <p className="mt-1 text-sm text-muted">Escolha a viagem em que os produtos foram carregados e entregues, mesmo que a NF tenha sido emitida depois.</p>
            </div>
          </div>
          <button type="button" disabled={loading} onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border hover:bg-muted/40 disabled:opacity-40" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="scrollbar-ui min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {error ? <ErrorBanner message={error} /> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-bold uppercase text-muted">Cliente</p>
              <p className="mt-1 font-black">{data.invoice.customer_name || 'Não identificado'}</p>
              <p className="mt-1 text-xs text-muted">{data.invoice.city || 'Cidade não informada'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-bold uppercase text-muted">Emissão da NF</p>
              <p className="mt-1 font-black">{formatDate(data.invoice.invoice_date)}</p>
              <p className="mt-1 text-xs text-muted">Status atual: {data.invoice.status}</p>
            </div>
            <div className={`rounded-2xl border p-4 ${data.invoice.has_whatsapp_photo
              ? 'semantic-panel-success'
              : 'semantic-panel-warning'}`}>
              <p className="text-xs font-bold uppercase text-muted">Evidência do canhoto</p>
              <p className="mt-1 font-black">{data.invoice.has_whatsapp_photo ? 'Postagem localizada' : 'Sem postagem localizada'}</p>
              <p className="mt-1 text-xs text-muted">{data.invoice.has_whatsapp_photo ? 'A publicação no grupo será preservada no histórico.' : 'Após vincular, publique a foto no grupo com a legenda correta.'}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border semantic-panel-info p-4 text-sm">
            <strong>O que será registrado:</strong> a NF será vinculada à rota escolhida. Sem uma postagem válida no grupo, permanecerá atribuída e impedirá o fechamento definitivo do malote.
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-black">Em qual rota a carga realmente saiu?</h3>
              <p className="mt-1 text-xs text-muted">As rotas do mesmo motorista aparecem primeiro. Use a data para localizar uma viagem mais antiga.</p>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold">
              <CalendarDays className="h-4 w-4 text-muted" />
              <span className="text-xs text-muted">Data da saída</span>
              <input type="date" value={routeDate} max={data.bag.operation_date} disabled={loading} onChange={(event) => onDateChange(event.target.value)} className="bg-transparent outline-none disabled:opacity-50" />
              {routeDate ? <button type="button" disabled={loading} onClick={() => onDateChange('')} className="text-muted hover:text-text" aria-label="Limpar data"><X className="h-4 w-4" /></button> : null}
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {data.routes.map((route) => {
              const selected = route.id === selectedTripId;
              return (
                <button key={route.id} type="button" disabled={loading} onClick={() => onSelect(route.id)}
                  className={`rounded-2xl border p-4 text-left transition disabled:opacity-50 ${selected
                    ? 'semantic-panel-info ring-2 ring-[color:var(--semantic-info-border)]'
                    : 'border-border bg-card hover:border-violet-300 hover:bg-muted/20'}`}>
                  <span className="flex items-start justify-between gap-3">
                    <span><span className="block text-lg font-black">Rota #{route.id}</span><span className="mt-0.5 block text-xs text-muted">{formatDate(route.date)} · saída #{route.run_number}</span></span>
                    <span className={`mt-1 grid h-5 w-5 place-items-center rounded-full border ${selected ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-400'}`}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>
                  </span>
                  <span className="mt-4 block font-bold">{route.driver?.name || 'Motorista não identificado'}</span>
                  <span className="mt-1 block text-xs text-muted">{route.car?.license_plate || 'Sem placa'} · {route.car?.model || 'Veículo não informado'}</span>
                  <span className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-border bg-surface px-2 py-1 text-[11px] font-bold">{route.notes_count} NFs · {route.completed_notes} concluídas</span>
                    {route.is_completed ? <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Rota finalizada</span> : null}
                    {route.same_driver_as_bag ? <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-1 text-[11px] font-bold text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">Mesmo motorista do malote</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {!data.routes.length && !loading ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="font-black">Nenhuma rota encontrada.</p>
              <p className="mt-1 text-sm text-muted">Informe a data exata da saída ou registre apenas a presença física no malote.</p>
            </div>
          ) : null}
          {loading ? <div className="mt-3 rounded-2xl border border-border bg-card p-6 text-center text-sm font-bold text-muted">Buscando rotas...</div> : null}

          <label className="mt-5 block">
            <span className="text-sm font-black">Observação para auditoria <span className="font-normal text-muted">(opcional)</span></span>
            <textarea value={reasonNotes} disabled={loading} onChange={(event) => onReasonNotesChange(event.target.value)} maxLength={500} rows={3} placeholder="Ex.: produtos entregues sem a NF por falha no faturamento; documento emitido no dia seguinte." className="scrollbar-ui mt-2 w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-violet-500 disabled:opacity-50" />
          </label>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button type="button" disabled={loading} onClick={onUnrouted} className="rounded-xl border border-border px-4 py-3 text-sm font-bold hover:bg-muted/40 disabled:opacity-40">Somente registrar no malote</button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" disabled={loading} onClick={onClose} className="rounded-xl border border-border px-4 py-3 text-sm font-bold hover:bg-muted/40 disabled:opacity-40">Cancelar</button>
            <button type="button" disabled={loading || !selectedRoute} onClick={onConfirm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">
              <Link2 className="h-4 w-4" />{selectedRoute ? `Vincular à rota #${selectedRoute.id}` : 'Selecione uma rota'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function BagTable({ rows, mutating, onOpen }: {
  rows: ReceiptBagListRow[]; mutating: boolean; onOpen: (row: ReceiptBagListRow) => void;
}) {
  return (
    <div className="scrollbar-ui min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted">
          <tr><th className="px-5 py-3">Rota</th><th className="px-5 py-3">Motorista / veículo</th><th className="px-5 py-3">Data</th><th className="px-5 py-3 text-center">Progresso</th><th className="px-5 py-3">Situação</th><th className="px-5 py-3 text-right">Ação</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={`${row.company_id}-${row.trip_id}`} className="hover:bg-muted/20">
              <td className="px-4 py-3"><p className="font-black">#{row.trip_id}</p><p className="text-[11px] text-muted">Saída #{row.run_number} · {row.company?.name || row.company?.code || 'Empresa'}</p></td>
              <td className="px-4 py-3"><p className="font-bold">{row.driver?.name || 'Motorista não identificado'}</p><p className="text-[11px] text-muted">{row.car?.license_plate || '-'} · {row.car?.model || 'Veículo'}</p></td>
              <td className="px-4 py-3">
                <p className="font-semibold">{formatDate(row.operation_date)}</p>
                {row.is_overdue ? <p className="mt-1 text-xs font-bold text-red-600">Malote atrasado</p> : null}
                {row.generated_by_timeout ? <p className="mt-1 max-w-56 text-xs font-bold text-amber-700 dark:text-amber-300">Rota incluída por segurança com {row.route_incomplete_stops} parada(s) sem resultado.</p> : null}
              </td>
              <td className="px-4 py-3 text-center">
                <p className="font-black">{row.counts.confirmed}/{row.counts.expected}</p>
                <div className="mx-auto mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.counts.expected ? Math.min(100, row.counts.confirmed / row.counts.expected * 100) : 100}%` }} /></div>
                {row.counts.absent ? <p className="mt-1 text-xs font-bold text-red-600">{row.counts.absent} ausente(s)</p> : null}
              </td>
              <td className="px-4 py-3"><BagBadge status={row.status} /></td>
              <td className="px-4 py-3 text-right">
                <button type="button" disabled={mutating} onClick={() => onOpen(row)} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 font-bold text-white hover:bg-sky-700 disabled:opacity-50">
                  <ClipboardCheck className="h-4 w-4" />{row.status === 'not_started' ? 'Iniciar conferência' : row.status === 'completed' ? 'Visualizar' : 'Retomar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ConferenceProps = {
  bag: ReceiptBag;
  items: ReceiptBagItem[];
  selectedItem: ReceiptBagItem | null;
  itemFilter: ItemFilter;
  itemSearch: string;
  extraInvoice: string;
  error: string;
  feedback: string;
  mutating: boolean;
  onClose: () => void;
  onSelect: (id: number) => void;
  onFilter: (filter: ItemFilter) => void;
  onSearch: (value: string) => void;
  onExtraChange: (value: string) => void;
  onExtra: () => void;
  onMutate: (item: ReceiptBagItem, action: 'confirm' | 'absent' | 'returned') => Promise<boolean>;
  onMarkRemaining: () => void;
  onFinish: () => void;
};

export function ConferencePanel(props: ConferenceProps) {
  const { bag, items, selectedItem } = props;
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [finishPromptOpen, setFinishPromptOpen] = useState(false);
  const [keyboardCandidateId, setKeyboardCandidateId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const canFinish = bag.items.length > 0
    && bag.items.every((item) => item.status !== 'pending')
    && bag.items.every((item) => !CLOSED_STATUSES.includes(item.status) || item.has_whatsapp_photo)
    && bag.status !== 'completed';

  useEffect(() => {
    if (canFinish) setFinishPromptOpen(true);
  }, [bag.id, canFinish]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, [bag.id]);

  useEffect(() => {
    if (items.length !== 1 || items[0].id !== keyboardCandidateId) {
      setKeyboardCandidateId(null);
    }
  }, [items, keyboardCandidateId]);

  const handleSearchChange = (value: string) => {
    setKeyboardCandidateId(null);
    props.onSearch(value);
  };

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = async (event) => {
    if (event.key !== 'Enter' || event.repeat || props.mutating || !props.itemSearch.trim() || items.length !== 1) return;
    event.preventDefault();
    const item = items[0];
    const term = props.itemSearch.trim().toLocaleLowerCase('pt-BR');
    if (!String(item.invoice_number).toLocaleLowerCase('pt-BR').includes(term)) return;

    if (keyboardCandidateId !== item.id) {
      props.onSelect(item.id);
      setKeyboardCandidateId(item.id);
      return;
    }

    if (EXEMPT_STATUSES.includes(item.status)) return;
    setKeyboardCandidateId(null);
    const confirmed = await props.onMutate(item, 'confirm');
    if (!confirmed) return;
    props.onSearch('');
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  return (
    <div className="fixed bottom-[var(--mobile-bottom-nav-height)] left-0 right-0 top-[var(--header-height)] z-[1000] flex flex-col overflow-hidden bg-surface text-sm text-text md:bottom-0 md:left-[var(--app-sidebar-current)]">
      <header className="shrink-0 border-b border-border bg-card px-3 py-2 shadow-sm sm:px-4">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={props.onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted/40" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></button>
            <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">Rota #{bag.trip_id}</h2><BagBadge status={bag.status} /></div>
              <p className="text-xs text-muted">{bag.driver?.name || 'Motorista'} · {bag.car?.license_plate || 'Sem placa'} · saída #{bag.run_number || 1} · {formatDate(bag.operation_date)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <CountPill className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{bag.counts.confirmed} presentes</CountPill>
            <CountPill className="bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100">{bag.counts.pending} aguardando</CountPill>
            <CountPill className="bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100">{bag.counts.absent} ausentes</CountPill>
            <button type="button" onClick={() => setSummaryOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 font-bold hover:bg-muted/40"><ClipboardCheck className="h-4 w-4" />Resumo</button>
            {bag.counts.pending ? <button type="button" disabled={props.mutating} onClick={props.onMarkRemaining} className="h-9 rounded-lg border border-red-400 px-3 font-bold text-red-700 hover:bg-red-50 disabled:opacity-40 dark:text-red-200 dark:hover:bg-red-950">Ausentar restantes</button> : null}
            {canFinish ? <button type="button" disabled={props.mutating} onClick={() => setFinishPromptOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"><PackageCheck className="h-4 w-4" />Finalizar rota</button> : null}
            <button type="button" onClick={props.onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted/40" aria-label="Fechar"><X className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto h-10 w-full max-w-[1800px] shrink-0 px-2 pt-1 sm:px-3" aria-live="polite">
        {props.error ? (
          <div role="alert" className="flex h-9 items-center gap-2 truncate rounded-lg border semantic-panel-danger px-3 text-xs font-semibold" title={props.error}>
            <AlertCircle className="h-4 w-4 shrink-0" /><span className="truncate">{props.error}</span>
          </div>
        ) : props.feedback ? (
          <div role="status" className="flex h-9 items-center gap-2 truncate rounded-lg border semantic-panel-success px-3 text-xs font-semibold" title={props.feedback}>
            <CheckCircle2 className="h-4 w-4 shrink-0" /><span className="truncate">{props.feedback}</span>
          </div>
        ) : (
          <div className="h-9 rounded-lg border border-transparent" aria-hidden="true" />
        )}
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 overflow-hidden p-2 sm:p-3">
        <section className="flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="shrink-0 space-y-2 border-b border-border p-2.5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex w-full max-w-[520px] flex-col gap-2">
                <SearchBox
                  value={props.itemSearch}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  inputRef={searchInputRef}
                  placeholder="Localizar NF, cliente ou cidade..."
                  className="w-full"
                  autoFocus
                />
                <div className="flex min-w-0 gap-1.5">
                  <label className="sr-only" htmlFor="extra-receipt-invoice">NF não listada</label>
                  <input id="extra-receipt-invoice" value={props.extraInvoice} onChange={(event) => props.onExtraChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && props.onExtra()} placeholder="Número da NF não listada" inputMode="numeric" className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold outline-none focus:border-violet-500" />
                  <button type="button" disabled={props.mutating || !props.extraInvoice.trim()} onClick={props.onExtra} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-40"><FilePlus2 className="h-3.5 w-3.5" />Adicionar NF</button>
                </div>
              </div>
              <div className="flex flex-col gap-2 xl:items-end">
                <div className="flex flex-wrap gap-2">
                {([['all', 'Todas'], ['pending', 'Aguardando'], ['confirmed', 'Conferidas'], ['absent', 'Ausentes'], ['exceptions', 'Sem necessidade']] as Array<[ItemFilter, string]>).map(([key, label]) => (
                  <FilterButton key={key} active={props.itemFilter === key} onClick={() => props.onFilter(key)}>{label}</FilterButton>
                ))}
                </div>
                <p className="text-[11px] text-muted"><strong>1 clique</strong> mostra opções · <strong>2 cliques</strong> confirma · busca com 1 resultado: <strong>Enter 2x</strong>.</p>
              </div>
            </div>
          </div>
          <div className="scrollbar-ui min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain p-2.5 pr-1.5">
            {items.map((item) => <ItemRow key={item.id} item={item} selected={item.id === selectedItem?.id} mutating={props.mutating} allowAbsent={item.origin_bag_id === bag.id && !item.is_suggested_extra} onSelect={() => props.onSelect(item.id)} onConfirm={() => !EXEMPT_STATUSES.includes(item.status) && props.onMutate(item, 'confirm')} onMutate={props.onMutate} />)}
            {!items.length ? <EmptyState text="Nenhuma NF encontrada neste filtro." /> : null}
          </div>
        </section>
      </div>
      {summaryOpen ? <BagSummaryDialog bag={bag} onClose={() => setSummaryOpen(false)} /> : null}
      {finishPromptOpen ? <FinishConferenceDialog bag={bag} mutating={props.mutating} onClose={() => setFinishPromptOpen(false)} onFinish={props.onFinish} /> : null}
    </div>
  );
}

function CountPill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-lg px-2.5 py-1.5 font-black ${className}`}>{children}</span>;
}
function ItemRow({ item, selected, mutating, allowAbsent, onSelect, onConfirm, onMutate }: {
  item: ReceiptBagItem;
  selected: boolean;
  mutating: boolean;
  allowAbsent: boolean;
  onSelect: () => void;
  onConfirm: () => void;
  onMutate: (item: ReceiptBagItem, action: 'confirm' | 'absent' | 'returned') => Promise<boolean>;
}) {
  const config = ITEM_STATUS[item.status];
  const suggestionDiffers = item.suggested_driver_id && item.suggested_driver_id !== item.expected_driver_id;
  const hasReceiptPhoto = item.has_whatsapp_photo
    || DELIVERY_STATUSES.includes(String(item.operational_status || '').toLowerCase());
  return (
    <div role="button" tabIndex={0} onClick={onSelect} onDoubleClick={onConfirm} onKeyDown={(event) => event.key === 'Enter' && onSelect()} className={`w-full cursor-pointer rounded-lg border px-2.5 py-2 text-left transition ${selected ? 'ring-2 ring-sky-500 ring-offset-1 ring-offset-surface' : ''} ${config.row}`}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface text-xs font-black text-muted">{item.route_order || '•'}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5"><strong className="text-sm">NF {item.invoice_number}</strong><span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-black ${config.badge}`}>{config.label}</span>{!hasReceiptPhoto && !EXEMPT_STATUSES.includes(item.status) ? <span className="rounded-full border border-red-400 bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100">Sem postagem</span> : null}{item.is_suggested_extra ? <span className="rounded-full border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">Provável neste malote</span> : item.is_extra ? <span className="rounded-full border border-violet-400 bg-violet-100 px-1.5 py-0.5 text-[10px] font-black text-violet-900 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100">Extra</span> : null}</span>
          <span className="block truncate text-[11px] text-muted">{item.customer_name || 'Cliente não identificado'}{item.city ? ` · ${item.city}` : ''}</span>
        </span>
        <span className="shrink-0 text-right text-[10px] text-muted">{item.confirmed_at ? formatDateTime(item.confirmed_at) : ''}</span>
      </div>
      {suggestionDiffers ? <p className="mt-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">Provavelmente com {item.suggested_driver_name || 'outro motorista'}{item.suggestion_confidence ? ` · confiança ${item.suggestion_confidence}%` : ''}{item.suggestion_sender_name ? ` · publicação por ${item.suggestion_sender_name}` : ' · identificação pelo telefone'}</p>
        : item.suggestion_source === 'whatsapp_phone' ? <p className="mt-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300">Publicação associada ao telefone deste motorista</p> : null}
      {item.is_suggested_extra && item.suggestion_reason ? <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{item.suggestion_reason}</p> : null}
      {item.confirmed_bag ? <p className="mt-1 text-[11px] font-bold text-violet-700 dark:text-violet-300">Encontrado com {item.confirmed_bag.driver_name || 'outro motorista'} · rota #{item.confirmed_bag.trip_id}</p> : null}
      {item.status === 'recovered' && item.origin_bag && item.origin_bag.trip_id !== item.confirmed_bag?.trip_id ? (
        <p className="mt-1 text-[11px] font-black text-red-700 dark:text-red-300">
          Estava ausente no malote da rota #{item.origin_bag.trip_id}{item.origin_bag.driver_name ? ` · ${item.origin_bag.driver_name}` : ''}
        </p>
      ) : null}
      {selected ? (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-current/15 pt-2" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <CompactActionButton disabled={mutating || EXEMPT_STATUSES.includes(item.status)} className="bg-emerald-600 text-white" onClick={() => onMutate(item, 'confirm')} icon={<Check className="h-3.5 w-3.5" />} label="Presente" />
          <CompactActionButton disabled={mutating || !allowAbsent || EXEMPT_STATUSES.includes(item.status)} className="border border-red-400 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100" onClick={() => onMutate(item, 'absent')} icon={<AlertCircle className="h-3.5 w-3.5" />} label="Ausente" />
          <CompactActionButton disabled={mutating || item.status === 'returned'} className="border border-orange-400 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-100" onClick={() => onMutate(item, 'returned')} icon={<RotateCcw className="h-3.5 w-3.5" />} label="Devolução" />
        </div>
      ) : null}
    </div>
  );
}
function CompactActionButton({ disabled, className, onClick, icon, label }: {
  disabled: boolean; className: string; onClick: () => void; icon: JSX.Element; label: string;
}) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>{icon}{label}</button>;
}
function FinishConferenceDialog({ bag, mutating, onClose, onFinish }: {
  bag: ReceiptBag;
  mutating: boolean;
  onClose: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[1400] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="finish-conference-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-500/50 bg-surface text-text shadow-2xl">
        <div className="border-b border-border semantic-panel-success p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-white"><PackageCheck className="h-6 w-6" /></span>
          <h3 id="finish-conference-title" className="mt-3 text-xl font-black">Todos os canhotos foram conferidos</h3>
          <p className="mt-1 text-sm text-muted">Finalize a rota #{bag.trip_id} para voltar à lista e escolher o próximo malote.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 p-4 text-center text-xs">
          <div className="rounded-xl bg-emerald-100 p-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"><strong className="block text-lg">{bag.counts.confirmed}</strong>presentes</div>
          <div className="rounded-xl bg-red-100 p-3 text-red-900 dark:bg-red-950 dark:text-red-100"><strong className="block text-lg">{bag.counts.absent}</strong>ausentes</div>
          <div className="rounded-xl bg-orange-100 p-3 text-orange-900 dark:bg-orange-950 dark:text-orange-100"><strong className="block text-lg">{bag.counts.returned}</strong>devoluções</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button type="button" disabled={mutating} onClick={onClose} className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-bold hover:bg-muted/40 disabled:opacity-40">Continuar conferindo</button>
          <button type="button" disabled={mutating} onClick={onFinish} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"><PackageCheck className="h-4 w-4" />{mutating ? 'Finalizando...' : 'Finalizar rota'}</button>
        </div>
      </section>
    </div>
  );
}
function BagSummaryDialog({ bag, onClose }: { bag: ReceiptBag; onClose: () => void }) {
  const rows: Array<[string, number, string]> = [
    ['Canhotos esperados', bag.counts.expected, ''], ['Confirmados', bag.counts.confirmed, 'text-emerald-600'],
    ['Aguardando', bag.counts.pending, ''], ['Ausentes', bag.counts.absent, 'text-red-600'],
    ['Recuperados', bag.counts.recovered, 'text-teal-600'], ['NFs extras', bag.counts.extras, 'text-violet-600'],
    ['Adicionais sugeridos', bag.counts.suggested, 'text-amber-600'],
    ['Devoluções', bag.counts.returned, 'text-orange-600'],
  ];
  return (
    <div className="absolute inset-0 z-[1400] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="bag-summary-title" className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3"><h3 id="bag-summary-title" className="font-black">Resumo do malote</h3><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-border" aria-label="Fechar resumo"><X className="h-4 w-4" /></button></div>
        <dl className="mt-3 space-y-2 text-sm">{rows.map(([label, value, className]) => <div key={label} className="flex justify-between"><dt className="text-muted">{label}</dt><dd className={`font-black ${className}`}>{value}</dd></div>)}</dl>
      </section>
    </div>
  );
}

export default ReceiptBagClosing;
