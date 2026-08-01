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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { Container } from '../style/invoices';
import verifyToken from '../utils/verifyToken';
import {
  ReceiptBag,
  ReceiptBagApiError,
  ReceiptBagItem,
  ReceiptBagItemStatus,
  ReceiptBagListResponse,
  ReceiptBagListRow,
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
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

const BAG_STATUS: Record<ReceiptBagStatus, { label: string; className: string }> = {
  not_started: { label: 'Não iniciado', className: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200' },
  in_progress: { label: 'Em conferência', className: 'border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200' },
  completed: { label: 'Conferido', className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  completed_with_pending: { label: 'Conferido com pendências', className: 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200' },
};
const ITEM_STATUS: Record<ReceiptBagItemStatus, { label: string; badge: string; row: string }> = {
  pending: { label: 'Aguardando', badge: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200', row: 'border-border bg-card hover:border-sky-400' },
  confirmed: { label: 'Presente', badge: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200', row: 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30' },
  absent: { label: 'Ausente', badge: 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200', row: 'border-red-300 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30' },
  recovered: { label: 'Recuperado', badge: 'border-teal-300 bg-teal-100 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200', row: 'border-teal-300 bg-teal-50/80 dark:border-teal-900 dark:bg-teal-950/30' },
  resolved_elsewhere: { label: 'Em outro malote', badge: 'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200', row: 'border-violet-300 bg-violet-50/80 dark:border-violet-900 dark:bg-violet-950/30' },
  returned: { label: 'Devolução', badge: 'border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200', row: 'border-orange-300 bg-orange-50/80 dark:border-orange-900 dark:bg-orange-950/30' },
  retained: { label: 'Retido no cliente', badge: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200', row: 'border-amber-300 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30' },
  redelivery: { label: 'Reentrega', badge: 'border-fuchsia-300 bg-fuchsia-100 text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200', row: 'border-fuchsia-300 bg-fuchsia-50/80 dark:border-fuchsia-900 dark:bg-fuchsia-950/30' },
  cancelled: { label: 'Cancelada', badge: 'border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400', row: 'border-border bg-muted/30 opacity-75' },
};
const CLOSED_STATUSES = ['confirmed', 'recovered', 'resolved_elsewhere'];
const EXEMPT_STATUSES = ['returned', 'retained', 'redelivery', 'cancelled'];

const errorPayload = (error: unknown): ReceiptBagApiError => (
  axios.isAxiosError(error) ? (error.response?.data || {}) as ReceiptBagApiError : {}
);
const errorMessage = (error: unknown, fallback: string) => {
  const payload = errorPayload(error);
  return payload.error || (error instanceof Error ? error.message : '') || fallback;
};

function BagBadge({ status }: { status: ReceiptBagStatus }) {
  const config = BAG_STATUS[status];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${config.className}`}>{config.label}</span>;
}

function SummaryCard({ label, value, icon, tone = '' }: {
  label: string; value: number; icon: JSX.Element; tone?: 'red' | 'amber' | 'green' | '';
}) {
  const toneClass = tone === 'red' ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/25'
    : tone === 'amber' ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/25'
      : tone === 'green' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/25'
        : 'border-border bg-card';
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="flex items-center justify-between gap-3 text-muted">
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>{icon}
      </div>
      <p className="mt-2 text-3xl font-black text-text">{value}</p>
    </div>
  );
}

function ReceiptBagClosing() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayInput);
  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('pending');
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
    });
  }, [activeBag, itemFilter, itemSearch]);
  const selectedItem = activeBag?.items.find((item) => item.id === selectedItemId) || null;

  const applyBag = (bag: ReceiptBag, message: string) => {
    setActiveBag(bag);
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 2500);
  };

  const openClosing = async (row: ReceiptBagListRow) => {
    setMutating(true);
    setError('');
    try {
      const bag = row.status === 'not_started'
        ? await startReceiptBagClosing(row.trip_id)
        : await getReceiptBagClosing(row.bag_id as number);
      setActiveBag(bag);
      setSelectedItemId(bag.items.find((item) => item.status === 'pending')?.id || bag.items[0]?.id || null);
      setItemFilter('all');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Não foi possível iniciar a conferência.'));
    } finally { setMutating(false); }
  };

  const mutateItem = useCallback(async (
    item: ReceiptBagItem,
    action: 'confirm' | 'absent' | 'returned',
    forceTransfer = false,
  ) => {
    if (!activeBag || mutating) return;
    if (action === 'absent' && item.is_suggested_extra) {
      setError('Uma NF apenas sugerida para este malote não pode ser marcada como ausente aqui.');
      return;
    }
    if (
      action === 'confirm'
      && !forceTransfer
      && !item.has_receipt_photo
      && !window.confirm(
        `A NF ${item.invoice_number} ainda está sem foto de canhoto.\n\n`
        + 'O documento físico está realmente neste malote?',
      )
    ) return;
    if (action === 'returned' && !window.confirm(
      `Registrar a NF ${item.invoice_number} como devolução?\n\nIsso removerá a necessidade do canhoto e atualizará a jornada da NF.`,
    )) return;
    setMutating(true);
    setError('');
    try {
      const bag = await updateReceiptBagItem(activeBag.id, item.id, action, { forceTransfer });
      applyBag(bag, action === 'confirm'
        ? item.status === 'absent' ? `NF ${item.invoice_number} recuperada.` : `NF ${item.invoice_number} confirmada.`
        : action === 'absent' ? `NF ${item.invoice_number} marcada como ausente.`
          : `Devolução da NF ${item.invoice_number} registrada.`);
      const index = visibleItems.findIndex((row) => row.id === item.id);
      setSelectedItemId(visibleItems[index + 1]?.id || visibleItems[index - 1]?.id || null);
      void loadList(true);
    } catch (requestError) {
      const payload = errorPayload(requestError);
      if (payload.code === 'RECEIPT_ALREADY_CONFIRMED' && !forceTransfer) {
        const correction = window.confirm(
          `${payload.error || 'Esta NF já foi confirmada em outro malote.'}\n\n`
          + `Local atual: ${payload.details?.driver_name || 'outro motorista'}`
          + `${payload.details?.trip_id ? ` — rota #${payload.details.trip_id}` : ''}.\n\n`
          + `Corrigir a localização para o malote de ${activeBag.driver?.name || 'motorista atual'}?`,
        );
        if (correction) {
          setMutating(false);
          await mutateItem(item, action, true);
          return;
        }
      } else setError(errorMessage(requestError, 'Não foi possível atualizar o canhoto.'));
    } finally { setMutating(false); }
  }, [activeBag, loadList, mutating, visibleItems]);

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
      applyBag(
        await addExtraReceiptBagInvoice(activeBag.id, invoice, { forceTransfer }),
        `NF ${invoice} adicionada neste malote.`,
      );
      setExtraInvoice('');
      void loadList(true);
    } catch (requestError) {
      const payload = errorPayload(requestError);
      if (payload.code === 'RECEIPT_ALREADY_CONFIRMED' && !forceTransfer) {
        const correction = window.confirm(
          `${payload.error || 'Esta NF já foi confirmada em outro malote.'}\n\n`
          + `Corrigir a localização para o malote de ${activeBag.driver?.name || 'motorista atual'}?`,
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
    if (!historicalRoutes.invoice.has_receipt_photo && !window.confirm(
      `A NF ${historicalRoutes.invoice.invoice_number} está sem foto de canhoto.\n\n`
      + 'Deseja vincular a entrega à rota mesmo assim?',
    )) return;
    if (!window.confirm(
      `Vincular a NF ${historicalRoutes.invoice.invoice_number} retroativamente à rota #${route.id}?\n\n`
      + `${route.driver?.name || 'Motorista'} · ${formatDate(route.date)} · ${route.car?.license_plate || 'sem placa'}\n\n`
      + 'A NF será incluída na rota já como entregue e a alteração ficará registrada na jornada.',
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
    if (!window.confirm(
      `Registrar a NF ${historicalRoutes.invoice.invoice_number} somente neste malote?\n\n`
      + 'A NF continuará pendente e sem vínculo com uma rota.',
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
    if (!activeBag?.counts.pending || mutating || !window.confirm(
      `Marcar ${activeBag.counts.pending} canhoto(s) restante(s) como ausente(s)?`,
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
        if (!window.confirm(
          `Ainda existem ${bag.counts.pending} canhoto(s) sem definição.\n\nMarcá-los como ausentes e finalizar?`,
        )) return;
        setMutating(true);
        bag = await markRemainingReceiptBagItemsAbsent(bag.id);
      }
      const finishedBag = await finishReceiptBagClosing(bag.id);
      applyBag(
        finishedBag,
        finishedBag.status === 'completed_with_pending'
          ? 'Conferência registrada com divergências; o malote continua na fila.'
          : 'Conferência finalizada.',
      );
      void loadList(true);
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
      <Container>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
          <section data-tutorial="bag-page-intro" className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-600">Controle físico</p>
              <h1 className="mt-1 text-3xl font-black text-text">Fechamento de Canhotos</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted">
                Confira os canhotos de cada malote e registre ausências, devoluções e documentos recebidos com outro motorista.
              </p>
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

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard label="Malotes" value={data?.summary.bags || 0} icon={<PackageCheck className="h-5 w-5" />} />
            <SummaryCard label="Esperados" value={data?.summary.expected || 0} icon={<ClipboardCheck className="h-5 w-5" />} />
            <SummaryCard label="Conferidos" value={data?.summary.confirmed || 0} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
            <SummaryCard label="Canhotos pendentes" value={data?.summary.pending_receipts || 0} icon={<AlertCircle className="h-5 w-5" />} tone="amber" />
            <SummaryCard label="Malotes atrasados" value={data?.summary.overdue_bags || 0} icon={<Clock3 className="h-5 w-5" />} tone="red" />
            <SummaryCard label="Divergentes" value={data?.summary.divergent_bags || 0} icon={<Undo2 className="h-5 w-5" />} tone="amber" />
          </section>

          <section data-tutorial="bag-list" className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
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
          onMutate={(item, action) => void mutateItem(item, action)}
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
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <AlertCircle className="h-5 w-5 shrink-0" />{message}
    </div>
  );
}
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-xl px-4 py-2 text-sm font-bold ${active ? 'bg-sky-600 text-white' : 'border border-border hover:bg-muted/40'}`}>{children}</button>;
}
function SearchBox({ value, onChange, placeholder, autoFocus = false }: {
  value: string; onChange: (value: string) => void; placeholder: string; autoFocus?: boolean;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 lg:w-[390px]">
      <Search className="h-4 w-4 shrink-0 text-muted" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoFocus={autoFocus} className="w-full bg-transparent text-sm outline-none" />
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
    <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6">
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

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
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
            <div className={`rounded-2xl border p-4 ${data.invoice.has_receipt_photo
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
              : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'}`}>
              <p className="text-xs font-bold uppercase text-muted">Evidência do canhoto</p>
              <p className="mt-1 font-black">{data.invoice.has_receipt_photo ? 'Foto localizada' : 'Sem foto localizada'}</p>
              <p className="mt-1 text-xs text-muted">{data.invoice.has_receipt_photo ? 'A publicação será preservada no histórico.' : 'A confirmação exigirá uma validação adicional.'}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-100">
            <strong>O que será registrado:</strong> a NF entrará na rota escolhida como entregue, sem reabrir a viagem. A data, o motorista, o veículo, o motivo e o usuário responsável ficarão na jornada e na auditoria.
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
                    ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/25 dark:bg-violet-950/35'
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
            <textarea value={reasonNotes} disabled={loading} onChange={(event) => onReasonNotesChange(event.target.value)} maxLength={500} rows={3} placeholder="Ex.: produtos entregues sem a NF por falha no faturamento; documento emitido no dia seguinte." className="mt-2 w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-violet-500 disabled:opacity-50" />
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted">
          <tr><th className="px-5 py-3">Rota</th><th className="px-5 py-3">Motorista / veículo</th><th className="px-5 py-3">Data</th><th className="px-5 py-3 text-center">Progresso</th><th className="px-5 py-3">Situação</th><th className="px-5 py-3 text-right">Ação</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={`${row.company_id}-${row.trip_id}`} className="hover:bg-muted/20">
              <td className="px-5 py-4"><p className="font-black">#{row.trip_id}</p><p className="text-xs text-muted">Saída #{row.run_number} · {row.company?.name || row.company?.code || 'Empresa'}</p></td>
              <td className="px-5 py-4"><p className="font-bold">{row.driver?.name || 'Motorista não identificado'}</p><p className="text-xs text-muted">{row.car?.license_plate || '-'} · {row.car?.model || 'Veículo'}</p></td>
              <td className="px-5 py-4">
                <p className="font-semibold">{formatDate(row.operation_date)}</p>
                {row.is_overdue ? <p className="mt-1 text-xs font-bold text-red-600">Malote atrasado</p> : null}
                {row.generated_by_timeout ? <p className="mt-1 max-w-56 text-xs font-bold text-amber-700 dark:text-amber-300">Rota incluída por segurança com {row.route_incomplete_stops} parada(s) sem resultado.</p> : null}
              </td>
              <td className="px-5 py-4 text-center">
                <p className="font-black">{row.counts.confirmed}/{row.counts.expected}</p>
                <div className="mx-auto mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.counts.expected ? Math.min(100, row.counts.confirmed / row.counts.expected * 100) : 100}%` }} /></div>
                {row.counts.absent ? <p className="mt-1 text-xs font-bold text-red-600">{row.counts.absent} ausente(s)</p> : null}
              </td>
              <td className="px-5 py-4"><BagBadge status={row.status} /></td>
              <td className="px-5 py-4 text-right">
                <button type="button" disabled={mutating} onClick={() => onOpen(row)} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 font-bold text-white hover:bg-sky-700 disabled:opacity-50">
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
  onMutate: (item: ReceiptBagItem, action: 'confirm' | 'absent' | 'returned') => void;
  onMarkRemaining: () => void;
  onFinish: () => void;
};

function ConferencePanel(props: ConferenceProps) {
  const { bag, items, selectedItem } = props;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-surface text-text">
      <header className="border-b border-border bg-card px-4 py-3 shadow-sm sm:px-6">
        <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={props.onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-border" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></button>
            <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">Rota #{bag.trip_id}</h2><BagBadge status={bag.status} /></div>
              <p className="text-sm text-muted">{bag.driver?.name || 'Motorista'} · {bag.car?.license_plate || 'Sem placa'} · saída #{bag.run_number || 1} · {formatDate(bag.operation_date)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <CountPill className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{bag.counts.confirmed} conferidos</CountPill>
            <CountPill className="bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">{bag.counts.pending} aguardando</CountPill>
            <CountPill className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200">{bag.counts.absent} ausentes</CountPill>
            <button type="button" onClick={props.onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-border" aria-label="Fechar"><X className="h-5 w-5" /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-[1700px] flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_350px] lg:p-6">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="space-y-3 border-b border-border p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {([['all', 'Todas'], ['pending', 'Aguardando'], ['confirmed', 'Conferidas'], ['absent', 'Ausentes'], ['exceptions', 'Sem necessidade']] as Array<[ItemFilter, string]>).map(([key, label]) => (
                  <FilterButton key={key} active={props.itemFilter === key} onClick={() => props.onFilter(key)}>{label}</FilterButton>
                ))}
              </div>
              <SearchBox value={props.itemSearch} onChange={props.onSearch} placeholder="Localizar NF, cliente ou cidade..." />
            </div>
            <p className="text-xs text-muted">Duplo clique confirma. Clique uma vez e use <strong>Enter</strong> para confirmar, <strong>A</strong> para ausente ou <strong>D</strong> para devolução.</p>
          </div>
          <div className="p-4 pb-0">{props.error ? <ErrorBanner message={props.error} /> : null}
            {props.feedback ? <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 className="h-5 w-5" />{props.feedback}</div> : null}
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 pt-0 sm:p-4 sm:pt-0">
            {items.map((item) => <ItemRow key={item.id} item={item} selected={item.id === selectedItem?.id} onSelect={() => props.onSelect(item.id)} onConfirm={() => !EXEMPT_STATUSES.includes(item.status) && props.onMutate(item, 'confirm')} />)}
            {!items.length ? <EmptyState text="Nenhuma NF encontrada neste filtro." /> : null}
          </div>
        </section>

        <aside className="min-h-0 space-y-4 overflow-y-auto">
          <ActionPanel selectedItem={selectedItem} mutating={props.mutating} onMutate={props.onMutate} />
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2"><FilePlus2 className="h-5 w-5 text-violet-600" /><h3 className="font-black">NF não listada</h3></div>
            <p className="mt-2 text-xs text-muted">Digite somente quando o canhoto físico veio neste malote, mas não aparece na lista.</p>
            <div className="mt-3 flex gap-2">
              <input value={props.extraInvoice} onChange={(event) => props.onExtraChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && props.onExtra()} placeholder="Número da NF" inputMode="numeric" className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-bold outline-none focus:border-violet-500" />
              <button type="button" disabled={props.mutating || !props.extraInvoice.trim()} onClick={props.onExtra} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">Adicionar</button>
            </div>
          </section>
          <BagSummary bag={bag} />
          <div className="grid gap-2">
            {bag.counts.pending ? <button type="button" disabled={props.mutating} onClick={props.onMarkRemaining} className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-black text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">Marcar {bag.counts.pending} restante(s) como ausente(s)</button> : null}
            <button type="button" disabled={props.mutating} onClick={props.onFinish} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"><PackageCheck className="h-5 w-5" />Finalizar conferência</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CountPill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-xl px-3 py-2 font-black ${className}`}>{children}</span>;
}
function ItemRow({ item, selected, onSelect, onConfirm }: {
  item: ReceiptBagItem; selected: boolean; onSelect: () => void; onConfirm: () => void;
}) {
  const config = ITEM_STATUS[item.status];
  const suggestionDiffers = item.suggested_driver_id && item.suggested_driver_id !== item.expected_driver_id;
  return (
    <button type="button" onClick={onSelect} onDoubleClick={onConfirm} className={`flex w-full flex-col gap-3 rounded-xl border p-3 text-left transition sm:flex-row sm:items-center ${selected ? 'ring-2 ring-sky-500 ring-offset-1 ring-offset-surface' : ''} ${config.row}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-sm font-black text-muted">{item.route_order || '•'}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2"><strong className="text-base">NF {item.invoice_number}</strong><span className={`rounded-full border px-2 py-0.5 text-[11px] font-black ${config.badge}`}>{config.label}</span>{!item.has_receipt_photo && !EXEMPT_STATUSES.includes(item.status) ? <span className="rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">Sem foto</span> : null}{item.is_suggested_extra ? <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">Provável neste malote</span> : item.is_extra ? <span className="rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-[11px] font-black text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200">Extra</span> : null}</span>
        <span className="mt-1 block truncate text-xs text-muted">{item.customer_name || 'Cliente não identificado'}{item.city ? ` · ${item.city}` : ''}</span>
        {suggestionDiffers ? <span className="mt-1 block text-xs font-bold text-amber-700 dark:text-amber-300">Provavelmente com {item.suggested_driver_name || 'outro motorista'}{item.suggestion_confidence ? ` · confiança ${item.suggestion_confidence}%` : ''}{item.suggestion_sender_name ? ` · publicação por ${item.suggestion_sender_name}` : ' · identificação pelo telefone'}</span>
          : item.suggestion_source === 'whatsapp_phone' ? <span className="mt-1 block text-xs font-semibold text-sky-700 dark:text-sky-300">Publicação associada ao telefone deste motorista</span> : null}
        {item.is_suggested_extra && item.suggestion_reason ? <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">{item.suggestion_reason}</span> : null}
        {item.confirmed_bag ? <span className="mt-1 block text-xs font-bold text-violet-700 dark:text-violet-300">Encontrado com {item.confirmed_bag.driver_name || 'outro motorista'} · rota #{item.confirmed_bag.trip_id}</span> : null}
      </span>
      <span className="text-right text-xs text-muted">{item.confirmed_at ? `Confirmado ${formatDateTime(item.confirmed_at)}` : ''}</span>
    </button>
  );
}
function ActionPanel({ selectedItem, mutating, onMutate }: {
  selectedItem: ReceiptBagItem | null; mutating: boolean;
  onMutate: (item: ReceiptBagItem, action: 'confirm' | 'absent' | 'returned') => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-black">Ações da NF</h3>
      {selectedItem ? <>
        <p className="mt-1 text-sm text-muted">NF {selectedItem.invoice_number}</p>
        <div className="mt-4 grid gap-2">
          <ActionButton disabled={mutating || EXEMPT_STATUSES.includes(selectedItem.status)} className="bg-emerald-600 text-white" onClick={() => onMutate(selectedItem, 'confirm')} icon={<Check className="h-5 w-5" />} label="Canhoto presente" shortcut="Enter" />
          <ActionButton disabled={mutating || selectedItem.is_suggested_extra || CLOSED_STATUSES.includes(selectedItem.status) || EXEMPT_STATUSES.includes(selectedItem.status)} className="border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" onClick={() => onMutate(selectedItem, 'absent')} icon={<AlertCircle className="h-5 w-5" />} label="Canhoto ausente" shortcut="A" />
          <ActionButton disabled={mutating || selectedItem.status === 'returned'} className="border border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200" onClick={() => onMutate(selectedItem, 'returned')} icon={<RotateCcw className="h-5 w-5" />} label="Registrar devolução" shortcut="D" />
        </div>
      </> : <p className="mt-2 text-sm text-muted">Selecione uma NF para ver as ações.</p>}
    </section>
  );
}
function ActionButton({ disabled, className, onClick, icon, label, shortcut }: {
  disabled: boolean; className: string; onClick: () => void; icon: JSX.Element; label: string; shortcut: string;
}) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>{icon}{label}<span className="ml-auto text-xs opacity-75">{shortcut}</span></button>;
}
function BagSummary({ bag }: { bag: ReceiptBag }) {
  const rows: Array<[string, number, string]> = [
    ['Canhotos esperados', bag.counts.expected, ''], ['Confirmados', bag.counts.confirmed, 'text-emerald-600'],
    ['Aguardando', bag.counts.pending, ''], ['Ausentes', bag.counts.absent, 'text-red-600'],
    ['Recuperados', bag.counts.recovered, 'text-teal-600'], ['NFs extras', bag.counts.extras, 'text-violet-600'],
    ['Adicionais sugeridos', bag.counts.suggested, 'text-amber-600'],
    ['Devoluções', bag.counts.returned, 'text-orange-600'],
  ];
  return <section className="rounded-2xl border border-border bg-card p-4"><h3 className="font-black">Resumo do malote</h3><dl className="mt-3 space-y-2 text-sm">{rows.map(([label, value, className]) => <div key={label} className="flex justify-between"><dt className="text-muted">{label}</dt><dd className={`font-black ${className}`}>{value}</dd></div>)}</dl></section>;
}

export default ReceiptBagClosing;
