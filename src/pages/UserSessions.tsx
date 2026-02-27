import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router';
import Header from '../components/Header';
import { API_URL } from '../data';
import { Container } from '../style/invoices';
import verifyToken from '../utils/verifyToken';

type UserOption = {
  id: number;
  name: string;
  username: string;
};

type SessionRow = {
  id: number;
  login_at: string | null;
  logout_at: string | null;
  duration_minutes: number;
  active: boolean;
  ip_address: string | null;
  user_agent: string | null;
  user: {
    id: number;
    name: string;
    username: string;
    permission: string;
  } | null;
};

type AnalyticsCountByWeekday = {
  weekday: number;
  label: string;
  count: number;
};

type AnalyticsCountByHour = {
  hour: number;
  label: string;
  count: number;
};

type AnalyticsActivityByDay = {
  date: string;
  label: string;
  logins: number;
  interactions: number;
};

type AnalyticsTopAction = {
  key: string;
  label: string;
  count: number;
};

type AnalyticsTopUser = {
  user_id: number;
  name: string;
  username: string;
  count: number;
};

type SessionsAnalytics = {
  range: {
    from: string;
    to: string;
  };
  totals: {
    logins: number;
    interactions: number;
    auditEvents?: number;
    activeSessions: number;
  };
  loginsByWeekday: AnalyticsCountByWeekday[];
  loginsByHour: AnalyticsCountByHour[];
  activityByDay: AnalyticsActivityByDay[];
  interactionCategories: AnalyticsTopAction[];
  topUsersByLogins: AnalyticsTopUser[];
  topUsersByInteractions: AnalyticsTopUser[];
  userInteractionSummary: Array<{
    user_id: number;
    name: string;
    username: string;
    count: number;
    main_action_key: string | null;
    main_action_label: string | null;
    main_action_count: number;
    top_actions: AnalyticsTopAction[];
  }>;
};

const PERMISSION_LABELS: Record<string, string> = {
  admin: 'Admin',
  master: 'Master',
  user: 'User',
  expedicao: 'Expedição',
  conferente: 'Conferente',
  control_tower: 'Torre de Controle',
};

type UserGroup = 'kp' | 'control_tower';

const USER_GROUP_LABELS: Record<UserGroup, string> = {
  kp: 'Operação KP',
  control_tower: 'Torre de Controle (MAR E RIO)',
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('pt-BR');
}

function formatDuration(minutes: number) {
  const safeMinutes = Number(minutes || 0);
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (!hours) return `${remainingMinutes} min`;
  return `${hours}h ${remainingMinutes}min`;
}

const buildDefaultAnalytics = (): SessionsAnalytics => ({
  range: {
    from: '',
    to: '',
  },
  totals: {
    logins: 0,
    interactions: 0,
    activeSessions: 0,
  },
  loginsByWeekday: [],
  loginsByHour: [],
  activityByDay: [],
  interactionCategories: [],
  topUsersByLogins: [],
  topUsersByInteractions: [],
  userInteractionSummary: [],
});

function UserSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [analytics, setAnalytics] = useState<SessionsAnalytics>(buildDefaultAnalytics());
  const [selectedUserGroup, setSelectedUserGroup] = useState<UserGroup>('kp');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [canLoadData, setCanLoadData] = useState(false);

  async function loadUsers() {
    try {
      const { data } = await axios.get<UserOption[]>(`${API_URL}/users`, {
        params: {
          user_group: selectedUserGroup,
        },
      });
      const safeRows = Array.isArray(data) ? data : [];
      setUsers(safeRows.map((row: any) => ({
        id: Number(row.id),
        name: String(row.name || ''),
        username: String(row.username || ''),
      })));
    } catch (error) {
      console.error(error);
      setUsers([]);
    }
  }

  const buildQueryParams = () => {
    const params: Record<string, string> = {};
    params.user_group = selectedUserGroup;
    if (selectedUserId) params.user_id = selectedUserId;
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;
    return params;
  };

  async function loadSessions() {
    try {
      setLoading(true);
      setErrorMessage('');

      const params = buildQueryParams();

      const { data } = await axios.get<SessionRow[]>(`${API_URL}/users/sessions`, { params });
      setSessions(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error(error);
      const message = error?.response?.data?.message || 'Não foi possível carregar o histórico de sessões.';
      setErrorMessage(message);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    try {
      setAnalyticsLoading(true);
      const params = buildQueryParams();
      const { data } = await axios.get<SessionsAnalytics>(`${API_URL}/users/sessions/analytics`, { params });
      if (data && typeof data === 'object') {
        setAnalytics({
          ...buildDefaultAnalytics(),
          ...data,
        });
        return;
      }
      setAnalytics(buildDefaultAnalytics());
    } catch (error) {
      console.error(error);
      setAnalytics(buildDefaultAnalytics());
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function refreshData() {
    await Promise.all([loadSessions(), loadAnalytics()]);
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    const permission = String(localStorage.getItem('user_permission') || '').trim().toLowerCase();

    const boot = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      const isValidToken = await verifyToken(token);
      if (!isValidToken) {
        navigate('/');
        return;
      }

      if (permission !== 'master') {
        navigate('/home');
        return;
      }

      setCanLoadData(true);
    };

    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canLoadData) return;
    const run = async () => {
      await Promise.all([loadUsers(), refreshData()]);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoadData, selectedUserGroup]);

  const weeklyLoginsOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 38, right: 12, top: 20, bottom: 24 },
    xAxis: {
      type: 'category',
      data: analytics.loginsByWeekday.map((item) => item.label),
      axisLine: { lineStyle: { color: '#6b7685' } },
      axisLabel: { color: '#93a1b2' },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.16)' } },
      axisLabel: { color: '#93a1b2' },
    },
    series: [{
      type: 'bar',
      data: analytics.loginsByWeekday.map((item) => item.count),
      itemStyle: {
        color: '#0ea5e9',
        borderRadius: [6, 6, 0, 0],
      },
      barMaxWidth: 26,
    }],
  }), [analytics.loginsByWeekday]);

  const hourlyPeaksOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 38, right: 12, top: 20, bottom: 24 },
    xAxis: {
      type: 'category',
      data: analytics.loginsByHour.map((item) => item.label),
      axisLine: { lineStyle: { color: '#6b7685' } },
      axisLabel: { color: '#93a1b2' },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.16)' } },
      axisLabel: { color: '#93a1b2' },
    },
    series: [{
      type: 'line',
      smooth: true,
      data: analytics.loginsByHour.map((item) => item.count),
      lineStyle: { color: '#38bdf8', width: 3 },
      itemStyle: { color: '#38bdf8' },
      areaStyle: { color: 'rgba(56,189,248,0.18)' },
    }],
  }), [analytics.loginsByHour]);

  const dailyActivityOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      textStyle: { color: '#93a1b2' },
      data: ['Logins', 'Interações'],
    },
    grid: { left: 38, right: 12, top: 30, bottom: 24 },
    xAxis: {
      type: 'category',
      data: analytics.activityByDay.map((item) => item.label),
      axisLine: { lineStyle: { color: '#6b7685' } },
      axisLabel: { color: '#93a1b2' },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.16)' } },
      axisLabel: { color: '#93a1b2' },
    },
    series: [
      {
        name: 'Logins',
        type: 'line',
        smooth: true,
        data: analytics.activityByDay.map((item) => item.logins),
        lineStyle: { color: '#22c55e', width: 2.5 },
        itemStyle: { color: '#22c55e' },
      },
      {
        name: 'Interações',
        type: 'line',
        smooth: true,
        data: analytics.activityByDay.map((item) => item.interactions),
        lineStyle: { color: '#f59e0b', width: 2.5 },
        itemStyle: { color: '#f59e0b' },
      },
    ],
  }), [analytics.activityByDay]);

  const topActionsRows = useMemo(() => analytics.interactionCategories, [analytics.interactionCategories]);

  const topUsersRows = useMemo(
    () => analytics.topUsersByLogins.map((item) => ({
      ...item,
      displayName: item.name || item.username || `Usuário ${item.user_id}`,
    })),
    [analytics.topUsersByLogins],
  );

  const topUsersInteractionRows = useMemo(
    () => analytics.topUsersByInteractions.map((item) => ({
      ...item,
      displayName: item.name || item.username || `Usuário ${item.user_id}`,
    })),
    [analytics.topUsersByInteractions],
  );

  const userPurposeRows = useMemo(
    () => analytics.userInteractionSummary.map((item) => ({
      ...item,
      displayName: item.name || item.username || `Usuário ${item.user_id}`,
      topActionsText: (item.top_actions || []).map((action) => `${action.label} (${action.count})`).join(' | '),
    })),
    [analytics.userInteractionSummary],
  );

  const audienceDescription = selectedUserGroup === 'control_tower'
    ? 'Dados exclusivos da Torre de Controle (MAR E RIO), separados da operação KP.'
    : 'Dados da operação KP (transportadora), sem misturar com Torre de Controle.';

  return (
    <div>
      <Header />
      <Container>
        <div className="w-full max-w-[1250px] space-y-4">
          <div className="rounded-md border border-white/15 bg-surface/70 p-4">
            <h2 className="text-[1.05rem] font-semibold text-text">Horário de sessões dos usuários</h2>
            <p className="mt-1 text-sm text-muted">
              Visualização exclusiva para usuário Master.
            </p>
            <p className="mt-1 text-xs text-muted">
              Visão ativa: {USER_GROUP_LABELS[selectedUserGroup]}. {audienceDescription}
            </p>

            <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-5">
              <select
                value={selectedUserGroup}
                onChange={(event) => {
                  const nextValue = event.target.value as UserGroup;
                  setSelectedUserGroup(nextValue);
                  setSelectedUserId('');
                }}
                className="h-10 rounded-sm border border-accent/35 bg-surface-2/85 px-3 text-text focus:outline-none focus:ring-2 focus:ring-accent/60"
              >
                <option value="kp">Operação KP</option>
                <option value="control_tower">Torre de Controle (MAR E RIO)</option>
              </select>

              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="h-10 rounded-sm border border-accent/35 bg-surface-2/85 px-3 text-text focus:outline-none focus:ring-2 focus:ring-accent/60"
              >
                <option value="">Todos os usuários</option>
                {users.map((user) => (
                  <option key={`session-user-${user.id}`} value={String(user.id)}>
                    {user.name || user.username}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="h-10 rounded-sm border border-accent/35 bg-surface-2/85 px-3 text-text focus:outline-none focus:ring-2 focus:ring-accent/60"
              />

              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="h-10 rounded-sm border border-accent/35 bg-surface-2/85 px-3 text-text focus:outline-none focus:ring-2 focus:ring-accent/60"
              />

              <button
                type="button"
                onClick={refreshData}
                disabled={loading || analyticsLoading}
                className="h-10 rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-4 font-semibold text-[#04131e] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading || analyticsLoading ? 'Carregando...' : 'Atualizar'}
              </button>
            </div>

            {errorMessage ? (
              <p className="mt-3 text-sm text-rose-400">{errorMessage}</p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-white/10 bg-surface/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted">Logins no período</p>
              <p className="mt-1 text-2xl font-semibold text-text">{analytics.totals.logins}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-surface/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted">Interações registradas</p>
              <p className="mt-1 text-2xl font-semibold text-text">{analytics.totals.interactions}</p>
              <p className="mt-1 text-[11px] text-muted">Eventos de auditoria no período: {analytics.totals.auditEvents || 0}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-surface/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted">Sessões ativas</p>
              <p className="mt-1 text-2xl font-semibold text-text">{analytics.totals.activeSessions}</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-md border border-white/10 bg-surface/70 p-3">
              <h3 className="text-sm font-semibold text-text">Picos semanais de login</h3>
              <ReactECharts option={weeklyLoginsOption} style={{ height: 260 }} notMerge lazyUpdate />
            </div>
            <div className="rounded-md border border-white/10 bg-surface/70 p-3">
              <h3 className="text-sm font-semibold text-text">Picos por horário</h3>
              <ReactECharts option={hourlyPeaksOption} style={{ height: 260 }} notMerge lazyUpdate />
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-surface/70 p-3">
            <h3 className="text-sm font-semibold text-text">Logins x Interações por dia</h3>
            <ReactECharts option={dailyActivityOption} style={{ height: 300 }} notMerge lazyUpdate />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-md border border-white/10 bg-surface/70 p-3">
              <h3 className="mb-2 text-sm font-semibold text-text">Ações com mais interações</h3>
              <div className="max-h-[260px] overflow-auto">
                <table className="min-w-[420px]">
                  <thead>
                    <tr>
                      <th>Ação</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!topActionsRows.length ? (
                      <tr>
                        <td colSpan={2}>Sem interações no período selecionado.</td>
                      </tr>
                    ) : (
                      topActionsRows.map((row) => (
                        <tr key={`action-row-${row.key}`}>
                          <td>{row.label || '-'}</td>
                          <td>{row.count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-md border border-white/10 bg-surface/70 p-3">
              <h3 className="mb-2 text-sm font-semibold text-text">Usuários com mais logins</h3>
              <div className="max-h-[260px] overflow-auto">
                <table className="min-w-[420px]">
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!topUsersRows.length ? (
                      <tr>
                        <td colSpan={2}>Sem logins no período selecionado.</td>
                      </tr>
                    ) : (
                      topUsersRows.map((row) => (
                        <tr key={`top-user-${row.user_id}`}>
                          <td>{row.displayName}</td>
                          <td>{row.count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-surface/70 p-3">
            <h3 className="mb-2 text-sm font-semibold text-text">Usuários com mais interações de negócio</h3>
            <div className="max-h-[260px] overflow-auto">
              <table className="min-w-[420px]">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {!topUsersInteractionRows.length ? (
                    <tr>
                      <td colSpan={2}>Sem interações no período selecionado.</td>
                    </tr>
                  ) : (
                    topUsersInteractionRows.map((row) => (
                      <tr key={`top-interaction-user-${row.user_id}`}>
                        <td>{row.displayName}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-surface/70 p-3">
            <h3 className="mb-2 text-sm font-semibold text-text">Para quê cada usuário usa mais o sistema</h3>
            <div className="max-h-[320px] overflow-auto">
              <table className="min-w-[720px]">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Ação principal</th>
                    <th>Total da ação</th>
                    <th>Resumo das ações</th>
                  </tr>
                </thead>
                <tbody>
                  {!userPurposeRows.length ? (
                    <tr>
                      <td colSpan={4}>Sem interações no período selecionado.</td>
                    </tr>
                  ) : (
                    userPurposeRows.map((row) => (
                      <tr key={`user-purpose-${row.user_id}`}>
                        <td>{row.displayName}</td>
                        <td>{row.main_action_label || '-'}</td>
                        <td>{row.main_action_count || 0}</td>
                        <td>{row.topActionsText || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="w-full overflow-x-auto rounded-md border border-white/10">
            <table className="min-w-[1050px]">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Permissão</th>
                  <th>Login</th>
                  <th>Logout</th>
                  <th>Duração</th>
                  <th>Status</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7}>Carregando histórico...</td>
                  </tr>
                ) : !sessions.length ? (
                  <tr>
                    <td colSpan={7}>Nenhuma sessão encontrada.</td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={`session-row-${session.id}`}>
                      <td>{session.user?.name || session.user?.username || '-'}</td>
                      <td>{PERMISSION_LABELS[session.user?.permission || ''] || session.user?.permission || '-'}</td>
                      <td>{formatDateTime(session.login_at)}</td>
                      <td>{formatDateTime(session.logout_at)}</td>
                      <td>{formatDuration(session.duration_minutes)}</td>
                      <td>{session.active ? 'Ativa' : 'Encerrada'}</td>
                      <td>{session.ip_address || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Container>
    </div>
  );
}

export default UserSessions;
