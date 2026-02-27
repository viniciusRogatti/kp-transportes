import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import Header from '../components/Header';
import { API_URL } from '../data';
import { Container, FilterBar, FilterInput } from '../style/invoices';
import verifyToken from '../utils/verifyToken';

type UserRow = {
  id: number;
  username: string;
  name: string;
  permission: string;
  created_at: string;
};

const PERMISSION_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
  { value: 'expedicao', label: 'Expedição' },
  { value: 'conferente', label: 'Conferente' },
  { value: 'control_tower', label: 'Torre de Controle' },
];

const PERMISSION_LABELS: Record<string, string> = {
  admin: 'Admin',
  master: 'Master',
  user: 'User',
  expedicao: 'Expedição',
  conferente: 'Conferente',
  control_tower: 'Torre de Controle',
};

function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filterText, setFilterText] = useState('');
  const [form, setForm] = useState({
    username: '',
    name: '',
    password: '',
    permission: 'user',
  });

  async function loadUsers() {
    try {
      setLoading(true);
      setErrorMessage('');
      const { data } = await axios.get<UserRow[]>(`${API_URL}/users`);
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setErrorMessage('Não foi possível carregar os usuários.');
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

      if (!['admin', 'master'].includes(permission)) {
        navigate('/home');
        return;
      }

      await loadUsers();
    };

    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    if (!term) return users;

    return users.filter((user) => {
      const name = String(user.name || '').toLowerCase();
      const username = String(user.username || '').toLowerCase();
      const permission = String(user.permission || '').toLowerCase();
      return name.includes(term) || username.includes(term) || permission.includes(term);
    });
  }, [users, filterText]);

  async function createUser() {
    const username = form.username.trim();
    const name = form.name.trim();

    if (!username || !name || !form.password.trim()) {
      setErrorMessage('Preencha login, nome e senha.');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      await axios.post(`${API_URL}/users`, {
        username,
        name,
        password: form.password,
        permission: form.permission,
      });

      setForm({
        username: '',
        name: '',
        password: '',
        permission: 'user',
      });
      setSuccessMessage('Usuário criado com sucesso.');
      await loadUsers();
    } catch (error: any) {
      console.error(error);
      const message = error?.response?.data?.message || 'Não foi possível criar o usuário.';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Header />
      <Container>
        <div className="w-full max-w-[1200px] space-y-4">
          <div className="rounded-md border border-white/15 bg-surface/70 p-4">
            <h2 className="text-[1.05rem] font-semibold text-text">Cadastro de usuários</h2>
            <p className="mt-1 text-sm text-muted">
              Disponível apenas para perfis Admin e Master.
            </p>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <input
                type="text"
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                placeholder="Login"
                className="h-10 rounded-sm border border-accent/35 bg-surface-2/85 px-3 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/60"
              />
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nome"
                className="h-10 rounded-sm border border-accent/35 bg-surface-2/85 px-3 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/60"
              />
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Senha"
                className="h-10 rounded-sm border border-accent/35 bg-surface-2/85 px-3 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/60"
              />
              <select
                value={form.permission}
                onChange={(event) => setForm((prev) => ({ ...prev, permission: event.target.value }))}
                className="h-10 rounded-sm border border-accent/35 bg-surface-2/85 px-3 text-text focus:outline-none focus:ring-2 focus:ring-accent/60"
              >
                {PERMISSION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={createUser}
                disabled={saving}
                className="h-10 rounded-md border border-white/15 bg-gradient-to-r from-accent to-accent-strong px-4 font-semibold text-[#04131e] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? 'Salvando...' : 'Criar usuário'}
              </button>
              {successMessage ? <span className="text-sm text-emerald-400">{successMessage}</span> : null}
              {errorMessage ? <span className="text-sm text-rose-400">{errorMessage}</span> : null}
            </div>
          </div>

          <FilterBar className="mb-0 max-w-full">
            <FilterInput
              type="text"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder="Filtrar por nome, login ou permissão"
              className="max-w-full"
            />
          </FilterBar>

          <div className="w-full overflow-x-auto rounded-md border border-white/10">
            <table className="min-w-[760px]">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Login</th>
                  <th>Permissão</th>
                  <th>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4}>Carregando usuários...</td>
                  </tr>
                ) : !filteredUsers.length ? (
                  <tr>
                    <td colSpan={4}>Nenhum usuário encontrado.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={`user-row-${user.id}`}>
                      <td>{user.name || '-'}</td>
                      <td>{user.username || '-'}</td>
                      <td>{PERMISSION_LABELS[user.permission] || user.permission}</td>
                      <td>{user.created_at ? new Date(user.created_at).toLocaleString('pt-BR') : '-'}</td>
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

export default UserManagement;

