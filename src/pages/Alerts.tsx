import OperationalPageIntro from '../components/OperationalPageIntro';
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCcw,
  Search,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '../components/Header';
import { Container } from '../style/invoices';
import verifyToken from '../utils/verifyToken';
import {
  AlertHistoryFilters,
  listAlertHistory,
  resolveAlertHistoryRow,
} from '../services/alertsService';
import {
  IAlertHistoryResponse,
  IAlertHistoryRow,
} from '../types/types';
import { useRealtimeNotifications } from '../providers/RealtimeNotificationsProvider';
import { formatDateTimeBR } from '../utils/dateDisplay';

const EMPTY_SUMMARY: IAlertHistoryResponse['summary'] = {
  total: 0,
  open: 0,
  resolved: 0,
  info: 0,
  warning: 0,
  critical: 0,
};

const TYPE_LABELS: Record<string, string> = {
  WHATSAPP_INVOICE_NOT_FOUND: 'NF não encontrada',
  NF_NOT_FOUND_UPLOAD_ATTEMPT: 'NF não encontrada',
  RECEIPT_WHATSAPP_GROUP_COMPANY_MISMATCH: 'NF postada no grupo incorreto',
  RECEIPT_WHATSAPP_DRIVER_MISMATCH: 'Conferir motorista',
  RECEIPT_NF_NOT_DETECTED: 'Conferir legenda',
  NF_ALREADY_HAS_RECEIPT: 'Foto repetida',
  RECEIPT_MANUAL_REVIEW_REQUIRED: 'Conferir postagem',
  BOT_UNAVAILABLE: 'Integração indisponível',
};

const formatDateTime = (value: string | null | undefined) => {
  return formatDateTimeBR(value);
};

const statusLabel = (status: IAlertHistoryRow['status']) => (
  status === 'OPEN' ? 'Pendente' : 'Resolvido'
);

const severityLabel = (severity: IAlertHistoryRow['severity']) => ({
  INFO: 'Informativo',
  WARNING: 'Atenção',
  CRITICAL: 'Crítico',
}[severity]);

function AlertsPage() {
  const navigate = useNavigate();
  const { lastAlertUpdateAt } = useRealtimeNotifications();
  const [rows, setRows] = useState<IAlertHistoryRow[]>([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState<AlertHistoryFilters>({
    status: 'OPEN',
    severity: 'ALL',
    source: 'ALERT',
    search: '',
    from: '2026-08-11',
    to: '',
    limit: 500,
  });
  const requestSequenceRef = useRef(0);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const lastHandledAlertUpdateRef = useRef(lastAlertUpdateAt);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const ensureToken = async () => {
      if (!token || !(await verifyToken(token))) navigate('/');
    };
    ensureToken();
  }, [navigate]);

  const refreshHistory = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;

    if (showLoading) setLoading(true);
    setError('');
    try {
      const data = await listAlertHistory(filters);
      if (requestSequence !== requestSequenceRef.current) return;
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setSummary(data?.summary || EMPTY_SUMMARY);
    } catch (requestError) {
      if (requestSequence !== requestSequenceRef.current) return;
      console.error(requestError);
      setError('Não foi possível carregar a central de alertas.');
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        setHasLoaded(true);
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!lastAlertUpdateAt || lastHandledAlertUpdateRef.current === lastAlertUpdateAt) return undefined;

    lastHandledAlertUpdateRef.current = lastAlertUpdateAt;
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void refreshHistory({ showLoading: false });
    }, 600);

    return () => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
    };
  }, [lastAlertUpdateAt, refreshHistory]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setFilters((current) => ({ ...current, search: searchDraft.trim() }));
  }

  async function handleResolve(row: IAlertHistoryRow) {
    try {
      await resolveAlertHistoryRow(row.source, row.record_id);
      await refreshHistory();
    } catch (requestError) {
      console.error(requestError);
      alert('Não foi possível resolver este registro agora.');
    }
  }

  return (
    <div>
      <Header />
      <Container className="operation-page">
        <div className="w-full max-w-[var(--content-max-width)] space-y-3">
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <OperationalPageIntro title="Central de Alertas" description="Confira postagens do WhatsApp que precisam de atenção e acompanhe as correções." />
              </div>
              <button
                type="button"
                onClick={() => void refreshHistory()}
                disabled={loading}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-text transition hover:bg-surface-2 disabled:opacity-60"
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
              </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                <span className="text-muted">Encontrados</span>
                <strong className="ml-2 text-text">{summary.total}</strong>
              </div>
              <div className="rounded-md border border-border border-l-[3px] border-l-[color:var(--semantic-warning-border)] bg-card px-3 py-2 text-sm text-text">
                <span>Pendentes</span><strong className="ml-2">{summary.open}</strong>
              </div>
              <div className="rounded-md border border-border border-l-[3px] border-l-[color:var(--semantic-danger-border)] bg-card px-3 py-2 text-sm text-text">
                <span>Críticos</span><strong className="ml-2">{summary.critical}</strong>
              </div>
              <div className="rounded-md border border-border border-l-[3px] border-l-[color:var(--semantic-success-border)] bg-card px-3 py-2 text-sm text-text">
                <span>Resolvidos</span><strong className="ml-2">{summary.resolved}</strong>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <form onSubmit={handleSearch} className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_auto] [&>*]:min-w-0">
              <label className="relative">
                <span className="sr-only">Pesquisar</span>
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="NF, título, descrição ou código"
                  className="h-10 w-full min-w-0 rounded-md border border-border bg-card pl-9 pr-3 text-sm text-text"
                />
              </label>
              <select
                aria-label="Situação"
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as AlertHistoryFilters['status'] }))}
                className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-2 text-sm text-text"
              >
                <option value="ALL">Todas as situações</option>
                <option value="OPEN">Pendentes</option>
                <option value="RESOLVED">Resolvidos</option>
              </select>
              <select
                aria-label="Severidade"
                value={filters.severity}
                onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value as AlertHistoryFilters['severity'] }))}
                className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-2 text-sm text-text"
              >
                <option value="ALL">Todas as severidades</option>
                <option value="CRITICAL">Crítico</option>
                <option value="WARNING">Atenção</option>
                <option value="INFO">Informativo</option>
              </select>
              <input
                type="date"
                aria-label="Data inicial"
                title="Data inicial"
                value={filters.from}
                onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-2 text-sm text-text"
              />
              <input
                type="date"
                aria-label="Data final"
                title="Data final"
                value={filters.to}
                onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-2 text-sm text-text"
              />
              <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-accent-strong bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-strong">
                <Search className="h-4 w-4" /> Pesquisar
              </button>
            </form>
            <p className="mt-2 text-xs text-muted">
              Os alertas começam em 11/08/2026. As pendências de canhoto e devolução são acompanhadas na Central de Tratativas.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            {error ? <div className="rounded-md border border-border border-l-[3px] border-l-[color:var(--semantic-danger-border)] bg-card px-3 py-2 text-sm text-text">{error}</div> : null}
            {loading && !hasLoaded ? (
              <p className="text-sm text-muted">Carregando alertas...</p>
            ) : !rows.length ? (
              <p className="text-sm text-muted">Nenhum registro encontrado com estes filtros.</p>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {rows.map((row) => {
                  const severityAccentClass = row.severity === 'CRITICAL'
                    ? 'border-l-danger'
                    : row.severity === 'WARNING'
                      ? 'border-l-warning'
                      : 'border-l-info';
                  const resolved = row.status === 'RESOLVED';
                  const typeLabel = TYPE_LABELS[row.code] || (row.source === 'ALERT' ? 'Postagem a conferir' : 'Pendência operacional');
                  const responsible = row.resolved_by_user?.name
                    || row.resolved_by_user?.username
                    || (resolved && row.resolution_mode === 'automatic' ? 'Sistema' : null);

                  return (
                    <li key={row.id} className={`rounded-md border border-l-4 border-border bg-card p-3 ${severityAccentClass} ${resolved ? 'opacity-75' : ''}`}>
                      <div>
                        <div className="min-w-0 flex-1 space-y-1 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${resolved ? 'semantic-solid-success' : 'semantic-solid-warning'}`}>
                              {statusLabel(row.status)}
                            </span>
                            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-text">
                              {typeLabel}
                            </span>
                            <span className="text-xs text-muted">{severityLabel(row.severity)}</span>
                          </div>
                          <p className="font-semibold text-text">
                            {row.title}{row.entity.label ? ` · ${row.entity.label}` : ''}
                          </p>
                          <p className="text-muted">{row.message}</p>
                          <p className="text-xs text-muted">
                            Criado em {formatDateTime(row.created_at)}
                            {resolved ? ` · Resolvido em ${formatDateTime(row.resolved_at)}` : ''}
                            {responsible ? ` · Responsável: ${responsible}` : ''}
                          </p>

                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-2">
                          {row.action_url ? (
                            <button
                              type="button"
                              onClick={() => navigate(row.action_url as string)}
                              className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs text-text"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Abrir ação
                            </button>
                          ) : null}
                          {row.can_resolve ? (
                            <button
                              type="button"
                              onClick={() => handleResolve(row)}
                              className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs text-text"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Ocorrência resolvida
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 rounded-md border semantic-panel-info px-3 py-2 text-xs">
              <div className="inline-flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Para uma NF não encontrada, confira o número e a importação do XML. Depois solicite uma nova foto com somente os dígitos da NF na legenda. Use “Ocorrência resolvida” somente depois desse tratamento.
                </span>
              </div>
            </div>
          </section>
        </div>
      </Container>
    </div>
  );
}

export default AlertsPage;
