import { useCallback, useEffect, useMemo, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { format, subDays } from 'date-fns';
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  Eye,
  FileDown,
  LockKeyhole,
  PackageCheck,
  Pencil,
  RefreshCcw,
  RotateCcw,
  Save,
  Truck,
  X,
} from 'lucide-react';
import Header from '../components/Header';
import DailyOperationClosingPDF from '../components/DailyOperationClosingPDF';
import Badge from '../components/ui/Badge';
import { Container } from '../style/invoices';
import {
  closeDailyOperation,
  DailyOperationReport,
  getDailyOperationReport,
  reopenDailyOperation,
  saveDailyOperationNotes,
  saveDailyOperationLoadings,
} from '../services/dailyOperationClosingService';
import { formatDateBR, formatDateTimeBR } from '../utils/dateDisplay';
import { getApiErrorMessage } from '../utils/authErrorHandler';
import { showConfirm, showPrompt } from '../utils/dialog';
import { getSemanticToneClassName, SemanticTone } from '../utils/statusStyles';

type LoadingDraft = { duration: string; notes: string };

const DAILY_OPERATION_REPORT_START_DATE = '2026-08-19';
const defaultDate = () => {
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  return yesterday < DAILY_OPERATION_REPORT_START_DATE ? DAILY_OPERATION_REPORT_START_DATE : yesterday;
};
const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const formatMinutes = (minutes: number) => {
  const value = Number(minutes || 0);
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
};

const statusLabel = (status: string) => ({
  pending: 'Sem rota', assigned: 'Atribuída', redelivery: 'Reentrega', retained: 'Retida',
}[status] || status);

function PrimaryMetric({ label, value, detail, tone = 'neutral' }: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: SemanticTone;
}) {
  return (
    <div className={`min-w-0 rounded-md border px-3 py-2.5 ${getSemanticToneClassName(tone, 'panel')}`}>
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="text-xl font-bold leading-none text-text">{value}</p>
        {detail ? <p className="truncate text-[11px] text-muted">{detail}</p> : null}
      </div>
    </div>
  );
}

function InlineMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 px-2 py-1.5">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-text">{value}</p>
    </div>
  );
}

function ExceptionMetric({ label, value, tone }: { label: string; value: number; tone: SemanticTone }) {
  return (
    <div className={`flex min-w-0 items-center justify-between gap-2 rounded-md border px-2.5 py-2 ${getSemanticToneClassName(value ? tone : 'neutral', 'panel')}`}>
      <span className="truncate text-[11px] font-semibold text-muted">{label}</span>
      <strong className="text-sm text-text">{value}</strong>
    </div>
  );
}

export default function DailyOperationClosing() {
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [report, setReport] = useState<DailyOperationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingDrafts, setLoadingDrafts] = useState<Record<number, LoadingDraft>>({});
  const [loadingStartTime, setLoadingStartTime] = useState('');
  const [loadingEndTime, setLoadingEndTime] = useState('');
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState(false);
  const permission = String(localStorage.getItem('user_permission') || '').toLowerCase();
  const canClose = ['admin', 'master', 'expedicao'].includes(permission);
  const canReopen = ['admin', 'master'].includes(permission);

  const applyReport = useCallback((next: DailyOperationReport) => {
    setReport(next);
    setNotes(next.notes || '');
    setLoadingStartTime(next.loading_start_time || '');
    setLoadingEndTime(next.loading_end_time || '');
    setLoadingDrafts(Object.fromEntries(next.routes.map((route) => [route.trip_id, {
      duration: route.duration_minutes ? String(route.duration_minutes) : '',
      notes: route.loading_notes || '',
    }])));
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      applyReport(await getDailyOperationReport(selectedDate));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError) || 'Não foi possível carregar o fechamento diário.');
    } finally {
      setLoading(false);
    }
  }, [applyReport, selectedDate]);

  useEffect(() => { void loadReport(); }, [loadReport]);

  const missingLoadingCount = useMemo(() => (
    report?.routes.filter((route) => !Number(loadingDrafts[route.trip_id]?.duration || route.duration_minutes || 0)).length || 0
  ), [loadingDrafts, report]);

  const closeLoadingModal = () => {
    if (report) applyReport(report);
    setIsLoadingModalOpen(false);
  };

  const saveLoadings = async () => {
    if ((loadingStartTime && !loadingEndTime) || (!loadingStartTime && loadingEndTime)) {
      setError('Informe o horário de início e o horário de finalização da operação.');
      return;
    }
    const invalidDuration = report?.routes.some((route) => {
      const value = loadingDrafts[route.trip_id]?.duration?.trim();
      if (!value) return false;
      const duration = Number(value);
      return !Number.isInteger(duration) || duration <= 0 || duration > 1440;
    });
    if (invalidDuration) {
      setError('As durações devem ser informadas em minutos inteiros, entre 1 e 1440.');
      return;
    }
    setSavingKey('loadings');
    setError('');
    try {
      const updatedReport = await saveDailyOperationLoadings(
        selectedDate,
        loadingStartTime,
        loadingEndTime,
        (report?.routes || []).map((route) => {
          const draft = loadingDrafts[route.trip_id] || { duration: '', notes: '' };
          return {
            trip_id: route.trip_id,
            duration_minutes: draft.duration.trim() ? Number(draft.duration) : null,
            notes: draft.notes,
          };
        }),
      );
      applyReport(updatedReport);
      setIsLoadingModalOpen(false);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError) || 'Não foi possível salvar os horários dos carregamentos.');
    } finally {
      setSavingKey(null);
    }
  };

  const saveNotes = async () => {
    setSavingKey('notes');
    setError('');
    try {
      applyReport(await saveDailyOperationNotes(selectedDate, notes));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError) || 'Não foi possível salvar as observações.');
    } finally {
      setSavingKey(null);
    }
  };

  const closeReport = async () => {
    if (!report) return;
    const missingLoadingWindow = !report.loading_start_time || !report.loading_end_time;
    const pendingItems = [
      missingLoadingCount ? `${missingLoadingCount} carregamento(s) sem duração` : '',
      missingLoadingWindow ? 'os horários gerais da operação incompletos' : '',
    ].filter(Boolean).join(' e ');
    const warning = pendingItems
      ? `Ainda existem ${pendingItems}. Deseja fechar mesmo assim?`
      : 'Confirma o fechamento? Os dados do dia ficarão congelados para consulta e PDF.';
    if (!await showConfirm(warning, { title: 'Fechar operação', confirmLabel: 'Fechar operação' })) return;
    setSavingKey('close');
    setError('');
    try {
      applyReport(await closeDailyOperation(selectedDate, notes));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError) || 'Não foi possível fechar a operação.');
    } finally {
      setSavingKey(null);
    }
  };

  const reopenReport = async () => {
    const reason = await showPrompt('Por que este fechamento precisa ser reaberto?', {
      title: 'Reabrir fechamento', label: 'Justificativa', required: true, confirmLabel: 'Reabrir',
    });
    if (!reason) return;
    setSavingKey('reopen');
    setError('');
    try {
      applyReport(await reopenDailyOperation(selectedDate, reason));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError) || 'Não foi possível reabrir a operação.');
    } finally {
      setSavingKey(null);
    }
  };

  const exportPdf = async () => {
    if (!report) return;
    const preview = window.open('', '_blank');
    setSavingKey('pdf');
    try {
      const blob = await pdf(<DailyOperationClosingPDF report={report} />).toBlob();
      const url = URL.createObjectURL(blob);
      if (preview && !preview.closed) preview.location.href = url;
      else window.open(url, '_blank');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (pdfError) {
      if (preview && !preview.closed) preview.close();
      setError(getApiErrorMessage(pdfError) || 'Não foi possível gerar o PDF.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <Container>
        <div className="w-full max-w-[1500px] space-y-4">
          <section className="rounded-lg border border-border bg-card p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold text-text">Fechamento Diário da Operação</h1>
                  <Badge tone={report?.status === 'closed' ? 'success' : 'warning'}>
                    {report?.status === 'closed' ? 'Fechado' : 'Em conferência'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted">Visão consolidada do que saiu, retornou e ficou pendente para o próximo dia. Histórico disponível desde 19/08/2026.</p>
                {report?.closed_at ? (
                  <p className="mt-1 text-xs text-muted">Fechado por {report.closed_by_name || '-'} em {formatDateTimeBR(report.closed_at)}.</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-semibold text-muted">
                  Data da operação
                  <input className="mt-1 block h-10 rounded-md border border-border bg-surface px-3 text-sm text-text" type="date" min={DAILY_OPERATION_REPORT_START_DATE} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                </label>
                <button className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text hover:bg-surface-2" onClick={() => void loadReport()} disabled={loading}>
                  <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                </button>
                <button className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text hover:bg-surface-2" onClick={() => void exportPdf()} disabled={!report || savingKey === 'pdf'}>
                  <FileDown className="h-4 w-4" /> {savingKey === 'pdf' ? 'Gerando...' : 'Gerar PDF'}
                </button>
                {report?.status === 'draft' && canClose ? (
                  <button className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800" onClick={() => void closeReport()} disabled={savingKey === 'close'}>
                    <LockKeyhole className="h-4 w-4" /> {savingKey === 'close' ? 'Fechando...' : 'Fechar operação'}
                  </button>
                ) : null}
                {report?.status === 'closed' && canReopen ? (
                  <button className="inline-flex h-10 items-center gap-2 rounded-md border border-amber-400 bg-amber-50 px-3 text-sm font-semibold text-amber-900" onClick={() => void reopenReport()} disabled={savingKey === 'reopen'}>
                    <RotateCcw className="h-4 w-4" /> Reabrir
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          {error ? <div role="alert" className={`rounded-lg border p-3 text-sm font-semibold ${getSemanticToneClassName('danger', 'panel')}`}>{error}</div> : null}
          {loading ? <div className="rounded-lg border border-border bg-card p-8 text-center text-muted">Carregando fechamento...</div> : null}

          {!loading && report ? (
            <>
              <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
                <div className="grid grid-cols-2 gap-2 p-3 lg:grid-cols-4">
                  <PrimaryMetric
                    label="Notas atribuídas"
                    value={report.summary.total_notes_assigned}
                    detail={`${report.summary.received_today} recebidas · saldo anterior ${report.summary.opening_pending}`}
                    tone="info"
                  />
                  <PrimaryMetric label="Entregues" value={report.summary.delivered} detail={`de ${report.summary.total_notes_assigned} atribuídas`} tone="success" />
                  <PrimaryMetric label="Pendentes de entrega" value={report.summary.pending_delivery} detail="Sem nova rota" tone={report.summary.pending_delivery ? 'danger' : 'success'} />
                  <PrimaryMetric label="Canhotos pendentes" value={report.summary.pending_receipts} detail="Entregas sem foto válida" tone={report.summary.pending_receipts ? 'warning' : 'success'} />
                </div>

                <div className="border-t border-border px-3 py-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Recursos da operação</p>
                  <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3 lg:grid-cols-6">
                    <InlineMetric label="Rotas" value={report.summary.routes} />
                    <InlineMetric label="Veículos" value={report.summary.vehicles_used} />
                    <InlineMetric label="Peso" value={`${numberFormat.format(report.summary.total_weight)} kg`} />
                    <InlineMetric label="Caixas/volumes" value={numberFormat.format(report.summary.total_boxes)} />
                    <InlineMetric label="Tempo da operação" value={formatMinutes(report.summary.loading_operation_minutes)} />
                    <InlineMetric label="Média/veículo" value={`${numberFormat.format(report.summary.average_loading_minutes)} min`} />
                  </div>
                </div>

                <div className="border-t border-border px-3 py-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Exceções que exigem atenção</p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
                    <ExceptionMetric label="Reentregas" value={report.summary.redelivery} tone="redelivery" />
                    <ExceptionMetric label="Devolvidas" value={report.summary.returned} tone="danger" />
                    <ExceptionMetric label="Canceladas" value={report.summary.cancelled} tone="warning" />
                    <ExceptionMetric label="Retidas" value={report.summary.retained} tone="warning" />
                    <ExceptionMetric label="Ocorrências" value={report.summary.open_occurrences} tone="warning" />
                    <ExceptionMetric label="Rotas incompletas" value={report.summary.pending_route_completion} tone="danger" />
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold text-text"><Clock3 className="h-5 w-5 text-accent" /> Carregamentos e rotas</h2>
                    <p className="mt-1 text-xs text-muted">Horário geral da operação e duração calculada pelas fotos de cada veículo.</p>
                  </div>
                  <button className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:brightness-95" onClick={() => setIsLoadingModalOpen(true)}>
                    {report.status === 'closed' ? <Eye className="h-4 w-4" /> : report.summary.loadings_informed ? <Pencil className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    {report.status === 'closed' ? 'Visualizar horários' : report.summary.loadings_informed || report.loading_start_time ? 'Editar horários' : 'Adicionar horários'}
                  </button>
                </div>
                <div className="grid grid-cols-2 border-t border-border px-3 py-2 sm:grid-cols-5 sm:divide-x sm:divide-border">
                  <InlineMetric label="Início" value={report.loading_start_time || 'Não informado'} />
                  <InlineMetric label="Finalização" value={report.loading_end_time || 'Não informado'} />
                  <InlineMetric label="Tempo total" value={formatMinutes(report.summary.loading_operation_minutes)} />
                  <InlineMetric label="Média por veículo" value={`${numberFormat.format(report.summary.average_loading_minutes)} min`} />
                  <InlineMetric label="Durações preenchidas" value={`${report.summary.loadings_informed}/${report.summary.routes}`} />
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
                <div className="flex items-center justify-between gap-2 border-b border-border p-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold text-text"><AlertTriangle className="h-5 w-5 text-amber-600" /> Pendências para o próximo dia</h2>
                    <p className="mt-1 text-xs text-muted">Notas que continuam na transportadora sem uma rota ativa.</p>
                  </div>
                  <Badge tone={report.pending_deliveries.length ? 'danger' : 'success'}>{report.pending_deliveries.length} notas</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table>
                    <thead><tr><th>Empresa</th><th>NF</th><th>Cliente</th><th>Cidade</th><th>Situação</th><th>Emissão</th><th>Dias pendente</th><th>Peso</th></tr></thead>
                    <tbody>
                      {report.pending_deliveries.map((row) => (
                        <tr key={`${row.company_id}-${row.invoice_number}`}>
                          <td><strong>{row.company_name}</strong></td><td>{row.invoice_number}</td><td>{row.customer_name}</td><td>{row.city}</td>
                          <td><Badge tone={row.status === 'redelivery' ? 'redelivery' : row.status === 'retained' ? 'warning' : 'danger'}>{statusLabel(row.status)}</Badge></td>
                          <td>{formatDateBR(row.invoice_date)}</td><td><strong className={row.pending_days >= 3 ? 'text-red-700' : row.pending_days >= 2 ? 'text-amber-700' : ''}>{row.pending_days}</strong></td><td>{numberFormat.format(row.gross_weight)} kg</td>
                        </tr>
                      ))}
                      {!report.pending_deliveries.length ? <tr><td colSpan={8} className="text-center text-emerald-700"><PackageCheck className="mr-2 inline h-4 w-4" />Nenhuma nota pendente de entrega.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
                  <div className="border-b border-border p-4"><h2 className="flex items-center gap-2 text-base font-semibold"><Truck className="h-5 w-5 text-accent" /> Resultado por empresa</h2></div>
                  <div className="overflow-x-auto"><table><thead><tr><th>Empresa</th><th>Atribuídas</th><th>Entregues</th><th>Reentregas</th><th>Devolvidas</th><th>Pendentes</th></tr></thead><tbody>{report.companies.map((company) => <tr key={company.company_id}><td><strong>{company.company_name}</strong></td><td>{company.total}</td><td>{Number(company.delivered || 0) + Number(company.completed || 0) + Number(company.delivered_pending_receipt || 0)}</td><td>{company.redelivery || 0}</td><td>{company.returned || 0}</td><td>{company.pending_delivery || 0}</td></tr>)}</tbody></table></div>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-semibold"><CalendarDays className="h-5 w-5 text-accent" /> Observações do fechamento</h2>{report.status === 'draft' ? <button className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-semibold" onClick={() => void saveNotes()} disabled={savingKey === 'notes'}><Save className="h-3.5 w-3.5" /> Salvar</button> : null}</div>
                  <textarea className="mt-3 min-h-[150px] w-full rounded-md border border-border bg-surface p-3 text-sm text-text" value={notes} disabled={report.status === 'closed'} onChange={(event) => setNotes(event.target.value)} placeholder="Registre fatos relevantes, atrasos, problemas de veículo ou decisões tomadas durante a operação." />
                </div>
              </section>
            </>
          ) : null}
        </div>
      </Container>

      {isLoadingModalOpen && report ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-labelledby="loading-modal-title">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 id="loading-modal-title" className="text-lg font-semibold text-text">Horários dos carregamentos</h2>
                <p className="mt-1 text-xs text-muted">{formatDateBR(selectedDate)} · informe o período geral e a duração de cada rota calculada pelas fotos.</p>
              </div>
              <button aria-label="Fechar" className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-text" onClick={closeLoadingModal}><X className="h-5 w-5" /></button>
            </div>

            <div className="overflow-y-auto p-4">
              <div className="mb-4 grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-muted">Início da operação
                  <input className="mt-1 block h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-text" type="time" disabled={report.status === 'closed'} value={loadingStartTime} onChange={(event) => setLoadingStartTime(event.target.value)} />
                </label>
                <label className="text-xs font-semibold text-muted">Finalização da operação
                  <input className="mt-1 block h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-text" type="time" disabled={report.status === 'closed'} value={loadingEndTime} onChange={(event) => setLoadingEndTime(event.target.value)} />
                </label>
              </div>

              <div className="space-y-2">
                {report.routes.map((route) => {
                  const draft = loadingDrafts[route.trip_id] || { duration: '', notes: '' };
                  return (
                    <div key={route.trip_id} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[minmax(180px,1.1fr)_minmax(180px,1fr)_130px_minmax(180px,1fr)] md:items-end">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text">{route.driver_name}</p>
                        <p className="truncate text-xs text-muted">Rota #{route.trip_id} · viagem {route.run_number} · {route.company_name}</p>
                      </div>
                      <div className="min-w-0 md:pb-2"><p className="truncate text-sm text-text">{route.vehicle}</p></div>
                      <label className="text-xs font-semibold text-muted">Duração (min)
                        <input aria-label={`Duração do carregamento de ${route.driver_name}`} className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-right text-sm text-text" type="number" min="1" max="1440" disabled={report.status === 'closed'} value={draft.duration} onChange={(event) => setLoadingDrafts((current) => ({ ...current, [route.trip_id]: { ...draft, duration: event.target.value } }))} placeholder="Ex.: 32" />
                      </label>
                      <label className="text-xs font-semibold text-muted">Observação
                        <input aria-label={`Observação do carregamento de ${route.driver_name}`} className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-text" disabled={report.status === 'closed'} value={draft.notes} onChange={(event) => setLoadingDrafts((current) => ({ ...current, [route.trip_id]: { ...draft, notes: event.target.value } }))} placeholder="Opcional" />
                      </label>
                    </div>
                  );
                })}
                {!report.routes.length ? <p className="rounded-lg border border-border p-6 text-center text-sm text-muted">Nenhuma rota encontrada em {formatDateBR(selectedDate)}.</p> : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface p-4">
              <div className="flex gap-2"><Badge tone="info">{report.summary.loading_minutes} min somados</Badge><Badge tone={missingLoadingCount ? 'warning' : 'success'}>{report.summary.routes - missingLoadingCount}/{report.summary.routes} preenchidos</Badge></div>
              <div className="flex gap-2">
                <button className="h-10 rounded-md border border-border px-4 text-sm font-semibold text-text hover:bg-surface-2" onClick={closeLoadingModal}>{report.status === 'closed' ? 'Fechar' : 'Cancelar'}</button>
                {report.status === 'draft' ? <button className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:brightness-95" onClick={() => void saveLoadings()} disabled={savingKey === 'loadings'}><Save className="h-4 w-4" />{savingKey === 'loadings' ? 'Salvando...' : 'Salvar horários'}</button> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
