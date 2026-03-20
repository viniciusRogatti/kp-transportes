import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import Header from '../components/Header';
import { Container } from '../style/invoices';
import verifyToken from '../utils/verifyToken';
import { listAlerts, resolveAlert } from '../services/alertsService';
import {
  getReadAlertIds,
  markAlertsAsRead,
  subscribeToAlertReadChanges,
} from '../utils/alertReadState';
import {
  IAlertRow,
} from '../types/types';

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

function AlertsPage() {
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<IAlertRow[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  const [readAlertIds, setReadAlertIds] = useState<Set<number>>(() => new Set(getReadAlertIds()));
  const alertRowRefs = useRef<Record<number, HTMLLIElement | null>>({});

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

  async function refreshAlerts() {
    setAlertsLoading(true);
    setAlertsError('');

    try {
      const data = await listAlerts({
        status: 'OPEN',
        limit: 120,
      });

      setAlerts(Array.isArray(data?.rows) ? data.rows : []);
    } catch (error) {
      console.error(error);
      setAlerts([]);
      setAlertsError('Não foi possível carregar os alertas.');
    } finally {
      setAlertsLoading(false);
    }
  }

  useEffect(() => {
    refreshAlerts();
  }, []);

  useEffect(() => {
    return subscribeToAlertReadChanges(() => {
      setReadAlertIds(new Set(getReadAlertIds()));
    });
  }, []);

  const unreadAlertCount = useMemo(
    () => alerts.reduce((count, alertRow) => {
      if (alertRow.status === 'RESOLVED') return count;
      return readAlertIds.has(alertRow.id) ? count : count + 1;
    }, 0),
    [alerts, readAlertIds],
  );

  useEffect(() => {
    if (!alerts.length) return undefined;

    const pendingReadIds = alerts
      .map((alertRow) => Number(alertRow.id))
      .filter((alertId) => alertId > 0 && !readAlertIds.has(alertId));

    if (!pendingReadIds.length) return undefined;

    if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
      markAlertsAsRead(pendingReadIds);
      return undefined;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        const idsToMark = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.4)
          .map((entry) => Number((entry.target as HTMLElement).dataset.alertId))
          .filter((alertId) => alertId > 0 && !readAlertIds.has(alertId));

        if (idsToMark.length) {
          markAlertsAsRead(idsToMark);
        }
      },
      {
        threshold: [0.4],
      },
    );

    pendingReadIds.forEach((alertId) => {
      const element = alertRowRefs.current[alertId];
      if (element) observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [alerts, readAlertIds]);

  async function handleResolveAlert(alertId: number) {
    try {
      await resolveAlert(alertId);
      await refreshAlerts();
    } catch (error) {
      console.error(error);
      alert('Não foi possível resolver o alerta agora.');
    }
  }

  const alertCount = alerts.length;

  return (
    <div>
      <Header />
      <Container>
        <div className="w-full max-w-[1280px] space-y-3">
          <section className="rounded-md border border-border bg-surface/70 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-text">Alertas Operacionais</h2>
                <p className="text-sm text-muted">Eventos operacionais do app dos motoristas e do monitoramento de entrega.</p>
              </div>
              <button
                type="button"
                onClick={refreshAlerts}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface-2/80 px-3 text-sm text-text transition hover:bg-surface-2"
              >
                <RefreshCcw className="h-4 w-4" /> Atualizar
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-rose-500/70 bg-rose-900/25 px-3 py-1.5 text-sm font-semibold text-rose-100">
                ALERTAS ABERTOS ({alertCount})
              </span>
            </div>

            <p className="mt-2 text-xs text-muted">
              {unreadAlertCount > 0
                ? `${unreadAlertCount} alertas ainda não foram visualizados nesta conta.`
                : 'Todos os alertas desta lista já foram visualizados.'}
            </p>
          </section>

          <section className="rounded-md border border-border bg-surface/70 p-3">
            {alertsError ? (
              <div className="rounded-md border border-rose-500/60 bg-rose-900/20 px-3 py-2 text-sm text-rose-100">
                {alertsError}
              </div>
            ) : null}

            {alertsLoading ? (
              <p className="text-sm text-muted">Carregando alertas...</p>
            ) : !alerts.length ? (
              <p className="text-sm text-muted">Sem alertas abertos no momento.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((alertRow) => {
                  const severityClass = alertRow.severity === 'CRITICAL'
                    ? 'border-rose-500/70 bg-rose-900/25'
                    : alertRow.severity === 'INFO'
                      ? 'border-sky-500/70 bg-sky-900/20'
                      : 'border-amber-500/70 bg-amber-900/20';
                  const visualized = readAlertIds.has(alertRow.id);

                  return (
                    <li
                      key={`alert-${alertRow.id}`}
                      ref={(element) => {
                        alertRowRefs.current[alertRow.id] = element;
                      }}
                      data-alert-id={alertRow.id}
                      className={`rounded-md border p-3 transition ${severityClass} ${visualized ? 'opacity-80' : 'shadow-sm shadow-sky-950/5'}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1 text-sm">
                          <p className="font-semibold text-text">
                            {alertRow.title}
                            {alertRow.nf_number ? ` · NF ${alertRow.nf_number}` : ''}
                          </p>
                          <p className="text-muted">{alertRow.message}</p>
                          <p className="text-xs text-muted">
                            Código: {alertRow.code} · Severidade: {alertRow.severity} · Criado em: {formatDateTime(alertRow.created_at)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${visualized
                            ? 'border-border bg-card text-muted'
                            : 'border-sky-500/60 bg-sky-500/10 text-sky-700'
                            }`}
                          >
                            {visualized ? 'Visualizado' : 'Novo'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleResolveAlert(alertRow.id)}
                            className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs text-text"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Resolver
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 rounded-md border border-sky-500/40 bg-sky-900/15 px-3 py-2 text-xs text-sky-100">
              <div className="inline-flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <span>
                  Esta página exibe somente alertas operacionais do app dos motoristas e do monitoramento. Alertas e revisões do bot de canhotos ficam na página de canhotos.
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
