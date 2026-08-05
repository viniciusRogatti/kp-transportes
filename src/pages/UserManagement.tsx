import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import Header from '../components/Header';
import { API_URL } from '../data';
import { Container, FilterBar, FilterInput } from '../style/invoices';
import verifyToken from '../utils/verifyToken';
import {
  dismissTutorialProgressAdmin,
  listTutorialProgressAdmin,
  resetTutorialProgressAdmin,
  TutorialAdminRow,
} from '../services/tutorialProgressService';
import { getTutorialModulesForPermission } from '../tutorial/tutorialConfig';
import { showConfirm, showPrompt } from '../utils/dialog';
import { formatDateTimeBR } from '../utils/dateDisplay';

type UserRow = {
  id: number;
  username: string;
  name: string;
  permission: string;
  created_at: string;
};

const PERMISSION_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'user', label: 'Usuário' },
  { value: 'expedicao', label: 'Expedição' },
  { value: 'conferente', label: 'Conferente' },
  { value: 'control_tower', label: 'Torre de Controle' },
];

const PERMISSION_LABELS: Record<string, string> = {
  admin: 'Administrador',
  master: 'Administrador geral',
  user: 'Usuário',
  expedicao: 'Expedição',
  conferente: 'Conferente',
  control_tower: 'Torre de Controle',
};

const TUTORIAL_STATUS_LABELS: Record<string, string> = {
  not_started: 'Não iniciado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  skipped: 'Pulado',
  dismissed_by_admin: 'Dispensado',
};

function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tutorialProgress, setTutorialProgress] = useState<TutorialAdminRow[]>([]);
  const [tutorialActionUserId, setTutorialActionUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filterText, setFilterText] = useState('');
  const [form, setForm] = useState({
    username: '',
    name: '',
    password: '',
    passwordConfirmation: '',
    actorPassword: '',
    permission: 'user',
  });

  async function loadUsers() {
    try {
      setLoading(true);
      setErrorMessage('');
      const [{ data }, progressRows] = await Promise.all([
        axios.get<UserRow[]>(`${API_URL}/users`),
        listTutorialProgressAdmin(),
      ]);
      setUsers(Array.isArray(data) ? data : []);
      setTutorialProgress(Array.isArray(progressRows) ? progressRows : []);
    } catch (error) {
      console.error(error);
      setErrorMessage('Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  }

  const progressByUser = useMemo(() => new Map(
    tutorialProgress.map((item) => [Number(item.user_id), item]),
  ), [tutorialProgress]);

  async function resetTutorial(user: UserRow) {
    if (!await showConfirm(
      `Reiniciar o tutorial de ${user.name || user.username}?`,
      { title: 'Reiniciar tutorial', confirmLabel: 'Reiniciar' },
    )) return;
    try {
      setTutorialActionUserId(user.id);
      setErrorMessage('');
      await resetTutorialProgressAdmin(user.id);
      setSuccessMessage('Tutorial reiniciado com sucesso.');
      await loadUsers();
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.error || 'Não foi possível reiniciar o tutorial.');
    } finally {
      setTutorialActionUserId(null);
    }
  }

  async function dismissTutorial(user: UserRow) {
    const reason = await showPrompt(
      `Informe por que ${user.name || user.username} será dispensado do tutorial.`,
      {
        title: 'Dispensar tutorial',
        label: 'Justificativa',
        placeholder: 'Digite a justificativa...',
        confirmLabel: 'Dispensar usuário',
        required: true,
      },
    );
    if (!reason) return;
    try {
      setTutorialActionUserId(user.id);
      setErrorMessage('');
      await dismissTutorialProgressAdmin(user.id, reason);
      setSuccessMessage('Usuário dispensado do tutorial com sucesso.');
      await loadUsers();
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.error || 'Não foi possível dispensar o tutorial.');
    } finally {
      setTutorialActionUserId(null);
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

    if (!username || !name || !form.password.trim() || !form.passwordConfirmation.trim() || !form.actorPassword.trim()) {
      setErrorMessage('Preencha usuário, nome, senha, confirmação e sua senha.');
      return;
    }

    if (form.password !== form.passwordConfirmation) {
      setErrorMessage('A confirmação da senha do novo usuário não confere.');
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
        password_confirmation: form.passwordConfirmation,
        actor_password: form.actorPassword,
        permission: form.permission,
      });

      setForm({
        username: '',
        name: '',
        password: '',
        passwordConfirmation: '',
        actorPassword: '',
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
          <div className="rounded-lg border border-border bg-surface p-4 shadow-soft">
            <h2 className="text-[1.05rem] font-semibold text-text">Cadastro de usuários</h2>
            <p className="mt-1 text-sm text-muted">
              Disponível apenas para perfis administrativos.
            </p>

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <input
                type="text"
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                placeholder="Usuário de acesso"
                autoComplete="new-username"
                className="h-10 rounded-sm border border-border bg-card px-3 text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nome"
                autoComplete="off"
                className="h-10 rounded-sm border border-border bg-card px-3 text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Senha do novo usuário"
                autoComplete="new-password"
                className="h-10 rounded-sm border border-border bg-card px-3 text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <input
                type="password"
                value={form.passwordConfirmation}
                onChange={(event) => setForm((prev) => ({ ...prev, passwordConfirmation: event.target.value }))}
                placeholder="Confirme a senha do novo usuário"
                autoComplete="new-password"
                className="h-10 rounded-sm border border-border bg-card px-3 text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <input
                type="password"
                value={form.actorPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, actorPassword: event.target.value }))}
                placeholder="Sua senha para confirmar"
                autoComplete="off"
                className="h-10 rounded-sm border border-border bg-card px-3 text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <select
                value={form.permission}
                onChange={(event) => setForm((prev) => ({ ...prev, permission: event.target.value }))}
                className="h-10 rounded-sm border border-border bg-card px-3 text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
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
                className="h-10 rounded-md border border-accent-strong bg-accent px-4 font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70"
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
              placeholder="Filtrar por nome, usuário ou permissão"
              className="max-w-full"
            />
          </FilterBar>

          <div className="w-full overflow-x-auto rounded-md border border-border shadow-soft">
            <table className="min-w-[760px]">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Usuário</th>
                  <th>Permissão</th>
                  <th>Tutorial</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>Carregando usuários...</td>
                  </tr>
                ) : !filteredUsers.length ? (
                  <tr>
                    <td colSpan={6}>Nenhum usuário encontrado.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const tutorial = progressByUser.get(user.id);
                    const status = tutorial?.status || 'not_started';
                    const totalModules = getTutorialModulesForPermission(user.permission).length;
                    const completedCount = tutorial?.completed_modules?.length || 0;
                    return (
                    <tr key={`user-row-${user.id}`}>
                      <td>{user.name || '-'}</td>
                      <td>{user.username || '-'}</td>
                      <td>{PERMISSION_LABELS[user.permission] || user.permission}</td>
                      <td>
                        <span className="font-semibold">{TUTORIAL_STATUS_LABELS[status] || status}</span>
                        {tutorial?.current_module ? <span className="block text-xs text-muted">{tutorial.current_module} · passo {tutorial.current_step + 1}</span> : null}
                        <span className="block text-xs text-muted">{completedCount}/{totalModules} módulos</span>
                        {tutorial?.last_interaction_at ? <span className="block text-xs text-muted">Atualizado em {formatDateTimeBR(tutorial.last_interaction_at)}</span> : null}
                      </td>
                      <td>{formatDateTimeBR(user.created_at)}</td>
                      <td>
                        <div className="flex gap-2">
                          <button type="button" disabled={tutorialActionUserId === user.id} onClick={() => void resetTutorial(user)} className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-surface-2 disabled:opacity-50">Reiniciar</button>
                          <button type="button" disabled={tutorialActionUserId === user.id || status === 'dismissed_by_admin'} onClick={() => void dismissTutorial(user)} className="rounded-md border border-amber-400 px-2 py-1 text-xs font-semibold text-amber-600 disabled:opacity-50">Dispensar</button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
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
