import { useCallback, useEffect, useMemo, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { format, subDays } from 'date-fns';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileDown,
  LockKeyhole,
  PackageCheck,
  RefreshCcw,
  RotateCcw,
  Save,
  Truck,
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
  saveLoadingDuration,
} from '../services/dailyOperationClosingService';
import { formatDateBR, formatDateTimeBR } from '../utils/dateDisplay';
import { getApiErrorMessage } from '../utils/authErrorHandler';
import { showConfirm, showPrompt } from '../utils/dialog';
import { getSemanticToneClassName, SemanticTone } from '../utils/statusStyles';

type LoadingDraft = { duration: string; notes: string };

const defaultDate = () => format(subDays(new Date(), 1), 'yyyy-MM-dd');
const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

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
  const permission = String(localStorage.getItem('user_permission') || '').toLowerCase();
  const canClose = ['admin', 'master', 'expedicao'].includes(permission);
  const canReopen = ['admin', 'master'].includes(permission);

  const applyReport = useCallback((next: DailyOperationReport) => {
    setReport(next);
    setNotes(next.notes || '');
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

  const saveLoading = async (tripId: number) => {
    const draft = loadingDrafts[tripId];
    const duration = Number(draft?.duration || 0);
    if (!Number.isInteger(duration) || duration <= 0) {
      setError('Informe a duração do carregamento em minutos inteiros.');
      return;
    }
    setSavingKey(`loading-${tripId}`);
    setError('');
    try {
      applyReport(await saveLoadingDuration(selectedDate, tripId, duration, draft?.notes || ''));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError) || 'Não foi possível salvar a duração.');
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
    const warning = missingLoadingCount
      ? `Ainda existem ${missingLoadingCount} carregamento(s) sem duração. Deseja fechar mesmo assim?`
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
                <p className="mt-1 text-sm text-muted">Visão consolidada do que saiu, retornou e ficou pendente para o próximo dia.</p>
                {report?.closed_at ? (
                  <p className="mt-1 text-xs text-muted">Fechado por {report.closed_by_name || '-'} em {formatDateTimeBR(report.closed_at)}.</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-semibold text-muted">
                  Data da operação
                  <input className="mt-1 block h-10 rounded-md border border-border bg-surface px-3 text-sm text-text" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
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
                    <InlineMetric label="Durações" value={`${report.summary.loadings_informed}/${report.summary.routes}`} />
                    <InlineMetric label="Tempo carregando" value={`${report.summary.loading_minutes} min`} />
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
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold text-text"><Clock3 className="h-5 w-5 text-accent" /> Carregamentos e rotas</h2>
                    <p className="mt-1 text-xs text-muted">Informe somente a duração calculada entre as fotos dos carregamentos.</p>
                  </div>
                  <div className="flex flex-wrap gap-2"><Badge tone="info">{report.summary.loading_minutes} min registrados</Badge><Badge tone={missingLoadingCount ? 'warning' : 'success'}>{report.summary.loadings_informed}/{report.summary.routes} durações informadas</Badge></div>
                </div>
                <div className="overflow-x-auto">
                  <table>
                    <thead><tr><th>Motorista/rota</th><th>Veículo</th><th>Empresa</th><th>Notas</th><th>Peso</th><th>Caixas</th><th>Duração (min)</th><th>Observação</th><th>Ação</th></tr></thead>
                    <tbody>
                      {report.routes.map((route) => {
                        const draft = loadingDrafts[route.trip_id] || { duration: '', notes: '' };
                        return (
                          <tr key={route.trip_id}>
                            <td><strong>{route.driver_name}</strong><div className="text-xs text-muted">Rota #{route.trip_id} · viagem {route.run_number}</div></td>
                            <td>{route.vehicle}</td><td>{route.company_name}</td><td>{route.total_notes}</td>
                            <td>{numberFormat.format(route.total_weight)} kg</td><td>{route.total_boxes}</td>
                            <td><input aria-label={`Duração do carregamento de ${route.driver_name}`} className="h-9 w-24 rounded-md border border-border bg-surface px-2 text-right text-sm" type="number" min="1" max="1440" disabled={report.status === 'closed'} value={draft.duration} onChange={(event) => setLoadingDrafts((current) => ({ ...current, [route.trip_id]: { ...draft, duration: event.target.value } }))} placeholder="Ex.: 32" /></td>
                            <td><input aria-label={`Observação do carregamento de ${route.driver_name}`} className="h-9 min-w-[180px] rounded-md border border-border bg-surface px-2 text-sm" disabled={report.status === 'closed'} value={draft.notes} onChange={(event) => setLoadingDrafts((current) => ({ ...current, [route.trip_id]: { ...draft, notes: event.target.value } }))} placeholder="Opcional" /></td>
                            <td>{report.status === 'draft' ? <button className="inline-flex h-9 items-center gap-1 rounded-md bg-accent px-3 text-xs font-semibold text-white" onClick={() => void saveLoading(route.trip_id)} disabled={savingKey === `loading-${route.trip_id}`}><Save className="h-3.5 w-3.5" /> Salvar</button> : <CheckCircle2 className="h-5 w-5 text-emerald-700" />}</td>
                          </tr>
                        );
                      })}
                      {!report.routes.length ? <tr><td colSpan={9} className="text-center text-muted">Nenhuma rota encontrada em {formatDateBR(selectedDate)}.</td></tr> : null}
                    </tbody>
                  </table>
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
    </div>
  );
}
