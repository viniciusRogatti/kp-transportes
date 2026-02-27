import { useEffect, useState } from 'react';
import axios from 'axios';
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

const PERMISSION_LABELS: Record<string, string> = {
  admin: 'Admin',
  master: 'Master',
  user: 'User',
  expedicao: 'Expedição',
  conferente: 'Conferente',
  control_tower: 'Torre de Controle',
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

function UserSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  async function loadUsers() {
    try {
      const { data } = await axios.get<UserOption[]>(`${API_URL}/users`);
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

  async function loadSessions() {
    try {
      setLoading(true);
      setErrorMessage('');

      const params: Record<string, string> = {};
      if (selectedUserId) params.user_id = selectedUserId;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

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

      await Promise.all([loadUsers(), loadSessions()]);
    };

    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

            <div className="mt-3 grid gap-2 md:grid-cols-4">
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
                onClick={loadSessions}
                disabled={loading}
                className="h-10 rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-4 font-semibold text-[#04131e] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Carregando...' : 'Atualizar'}
              </button>
            </div>

            {errorMessage ? (
              <p className="mt-3 text-sm text-rose-400">{errorMessage}</p>
            ) : null}
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

