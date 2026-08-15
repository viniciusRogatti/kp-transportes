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
import FleetManagement, { type ManagedCar, type ManagedDriver } from './userManagement/FleetManagement';

type UserRow = {
  id: number;
  username: string;
  name: string;
  permission: string;
  driver_id: number | null;
  driver?: { id: number; name: string; is_active: boolean } | null;
  is_active: boolean;
  created_at: string;
};

const PERMISSION_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'user', label: 'Usuário' },
  { value: 'expedicao', label: 'Expedição' },
  { value: 'conferente', label: 'Conferente' },
  { value: 'control_tower', label: 'Torre de Controle' },
  { value: 'driver', label: 'Motorista' },
];

const PERMISSION_LABELS: Record<string, string> = {
  admin: 'Administrador',
  master: 'Administrador geral',
  user: 'Usuário',
  expedicao: 'Expedição',
  conferente: 'Conferente',
  control_tower: 'Torre de Controle',
  driver: 'Motorista',
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
  const actorPermission = String(localStorage.getItem('user_permission') || '').trim().toLowerCase();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [drivers, setDrivers] = useState<ManagedDriver[]>([]);
  const [cars, setCars] = useState<ManagedCar[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'drivers' | 'cars'>('users');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
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
    driverId: '',
  });

  async function loadUsers() {
    try {
      setLoading(true);
      setErrorMessage('');
      const [{ data }, progressRows, driversResponse, carsResponse] = await Promise.all([
        axios.get<UserRow[]>(`${API_URL}/users`),
        listTutorialProgressAdmin(),
        axios.get<ManagedDriver[]>(`${API_URL}/drivers?include_inactive=true`),
        axios.get<ManagedCar[]>(`${API_URL}/cars?include_inactive=true`),
      ]);
      setUsers(Array.isArray(data) ? data : []);
      setTutorialProgress(Array.isArray(progressRows) ? progressRows : []);
      setDrivers(Array.isArray(driversResponse.data) ? driversResponse.data : []);
      setCars(Array.isArray(carsResponse.data) ? carsResponse.data : []);
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

      if (!['admin', 'master'].includes(actorPermission)) {
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

  const availableDrivers = useMemo(() => {
    const linkedDriverIds = new Set(users
      .filter((user) => user.id !== editingUserId && user.driver_id)
      .map((user) => Number(user.driver_id)));
    return drivers.filter((driver) => driver.is_active && !linkedDriverIds.has(Number(driver.id)));
  }, [drivers, editingUserId, users]);

  function resetForm() {
    setEditingUserId(null);
    setForm({
      username: '', name: '', password: '', passwordConfirmation: '', actorPassword: '', permission: 'user', driverId: '',
    });
  }

  function startEditingUser(user: UserRow) {
    setEditingUserId(user.id);
    setForm({
      username: user.username,
      name: user.name,
      password: '',
      passwordConfirmation: '',
      actorPassword: '',
      permission: user.permission,
      driverId: user.driver_id ? String(user.driver_id) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveUser() {
    const username = form.username.trim();
    const name = form.name.trim();

    if (!username || !name) {
      setErrorMessage('Preencha usuário e nome.');
      return;
    }

    if (!editingUserId && (!form.password.trim() || !form.passwordConfirmation.trim() || !form.actorPassword.trim())) {
      setErrorMessage('Para criar, preencha senha, confirmação e sua senha.');
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

      const payload: Record<string, unknown> = {
        username,
        name,
        permission: form.permission,
        driver_id: form.permission === 'driver' && form.driverId ? Number(form.driverId) : null,
      };
      if (form.password) {
        payload.password = form.password;
        payload.password_confirmation = form.passwordConfirmation;
      }
      if (!editingUserId) payload.actor_password = form.actorPassword;

      if (editingUserId) await axios.patch(`${API_URL}/users/${editingUserId}`, payload);
      else await axios.post(`${API_URL}/users`, payload);

      setSuccessMessage(`Usuário ${editingUserId ? 'atualizado' : 'criado'} com sucesso.`);
      resetForm();
      await loadUsers();
    } catch (error: any) {
      console.error(error);
      const message = error?.response?.data?.message || `Não foi possível ${editingUserId ? 'atualizar' : 'criar'} o usuário.`;
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleUser(user: UserRow) {
    const nextActive = !user.is_active;
    if (!await showConfirm(`${nextActive ? 'Reativar' : 'Desativar'} o usuário ${user.name || user.username}?`, {
      title: `${nextActive ? 'Reativar' : 'Desativar'} usuário`,
      confirmLabel: nextActive ? 'Reativar' : 'Desativar',
      tone: nextActive ? 'default' : 'danger',
    })) return;
    try {
      setSaving(true);
      setErrorMessage('');
      if (nextActive) await axios.patch(`${API_URL}/users/${user.id}`, { is_active: true });
      else await axios.delete(`${API_URL}/users/${user.id}`);
      setSuccessMessage(`Usuário ${nextActive ? 'reativado' : 'desativado'} com sucesso.`);
      await loadUsers();
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'Não foi possível alterar o usuário.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Header />
      <Container>
        <div className="w-full max-w-[1200px] space-y-4">
          <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface p-2 shadow-soft">
            {([['users', 'Usuários'], ['drivers', 'Motoristas'], ['cars', 'Veículos']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setActiveTab(value)} className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === value ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2'}`}>{label}</button>
            ))}
          </div>

          {successMessage ? <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">{successMessage}</div> : null}
          {errorMessage ? <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{errorMessage}</div> : null}

          {activeTab === 'users' ? (
            <>
              <div className="rounded-lg border border-border bg-surface p-4 shadow-soft">
                <h2 className="text-[1.05rem] font-semibold text-text">{editingUserId ? 'Editar usuário' : 'Cadastrar usuário'}</h2>
                <p className="mt-1 text-sm text-muted">Ao criar um perfil Motorista, selecione um cadastro antigo ou deixe sem seleção para criar o motorista operacional junto com a conta.</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <input type="text" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="Usuário de acesso" autoComplete="new-username" className="h-10 rounded-sm border border-border bg-card px-3 text-text" />
                  <input type="text" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nome" autoComplete="off" className="h-10 rounded-sm border border-border bg-card px-3 text-text" />
                  <select value={form.permission} onChange={(event) => setForm((current) => ({ ...current, permission: event.target.value, driverId: event.target.value === 'driver' ? current.driverId : '' }))} className="h-10 rounded-sm border border-border bg-card px-3 text-text">
                    {form.permission === 'master' ? <option value="master">Administrador geral</option> : null}
                    {PERMISSION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  {form.permission === 'driver' ? (
                    <select value={form.driverId} onChange={(event) => setForm((current) => ({ ...current, driverId: event.target.value }))} className="h-10 rounded-sm border border-border bg-card px-3 text-text">
                      <option value="">Criar novo motorista com este nome</option>
                      {availableDrivers.map((driver) => <option key={driver.id} value={driver.id}>Vincular: {driver.name}</option>)}
                    </select>
                  ) : null}
                  <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder={editingUserId ? 'Nova senha (opcional)' : 'Senha do novo usuário'} autoComplete="new-password" className="h-10 rounded-sm border border-border bg-card px-3 text-text" />
                  <input type="password" value={form.passwordConfirmation} onChange={(event) => setForm((current) => ({ ...current, passwordConfirmation: event.target.value }))} placeholder="Confirme a senha" autoComplete="new-password" className="h-10 rounded-sm border border-border bg-card px-3 text-text" />
                  {!editingUserId ? <input type="password" value={form.actorPassword} onChange={(event) => setForm((current) => ({ ...current, actorPassword: event.target.value }))} placeholder="Sua senha para confirmar" autoComplete="off" className="h-10 rounded-sm border border-border bg-card px-3 text-text" /> : null}
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void saveUser()} disabled={saving} className="h-10 rounded-md bg-accent px-4 font-semibold text-white disabled:opacity-60">{saving ? 'Salvando...' : editingUserId ? 'Salvar alterações' : 'Criar usuário'}</button>
                  {editingUserId ? <button type="button" onClick={resetForm} className="h-10 rounded-md border border-border px-4 font-semibold">Cancelar</button> : null}
                </div>
              </div>

              <FilterBar className="mb-0 max-w-full"><FilterInput type="text" value={filterText} onChange={(event) => setFilterText(event.target.value)} placeholder="Filtrar por nome, usuário ou permissão" className="max-w-full" /></FilterBar>
              <div className="w-full overflow-x-auto rounded-md border border-border shadow-soft">
                <table className="min-w-[960px]">
                  <thead><tr><th>Nome</th><th>Usuário</th><th>Permissão / vínculo</th><th>Status</th><th>Tutorial</th><th>Criado em</th><th>Ações</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={7}>Carregando usuários...</td></tr> : !filteredUsers.length ? <tr><td colSpan={7}>Nenhum usuário encontrado.</td></tr> : filteredUsers.map((user) => {
                      const tutorial = progressByUser.get(user.id);
                      const status = tutorial?.status || 'not_started';
                      const totalModules = getTutorialModulesForPermission(user.permission).length;
                      const completedCount = tutorial?.completed_modules?.length || 0;
                      return (
                        <tr key={user.id}>
                          <td>{user.name || '-'}</td><td>{user.username || '-'}</td>
                          <td><span className="font-semibold">{PERMISSION_LABELS[user.permission] || user.permission}</span>{user.driver ? <span className="block text-xs text-muted">Motorista: {user.driver.name}</span> : null}</td>
                          <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.is_active ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'}`}>{user.is_active ? 'Ativo' : 'Inativo'}</span></td>
                          <td><span className="font-semibold">{TUTORIAL_STATUS_LABELS[status] || status}</span><span className="block text-xs text-muted">{completedCount}/{totalModules} módulos</span></td>
                          <td>{formatDateTimeBR(user.created_at)}</td>
                          <td><div className="flex flex-wrap gap-2">
                            <button type="button" disabled={user.permission === 'master' && actorPermission !== 'master'} onClick={() => startEditingUser(user)} className="rounded-md border border-border px-2 py-1 text-xs font-semibold disabled:opacity-40">Editar</button>
                            <button type="button" disabled={saving || (user.permission === 'master' && actorPermission !== 'master')} onClick={() => void toggleUser(user)} className="rounded-md border border-rose-400 px-2 py-1 text-xs font-semibold text-rose-500 disabled:opacity-40">{user.is_active ? 'Desativar' : 'Reativar'}</button>
                            <button type="button" disabled={tutorialActionUserId === user.id} onClick={() => void resetTutorial(user)} className="rounded-md border border-border px-2 py-1 text-xs font-semibold disabled:opacity-50">Reiniciar tutorial</button>
                            <button type="button" disabled={tutorialActionUserId === user.id || status === 'dismissed_by_admin'} onClick={() => void dismissTutorial(user)} className="rounded-md border border-amber-400 px-2 py-1 text-xs font-semibold text-amber-600 disabled:opacity-50">Dispensar</button>
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <FleetManagement tab={activeTab} drivers={drivers} cars={cars} reload={loadUsers} setError={setErrorMessage} setSuccess={setSuccessMessage} />
          )}
        </div>
      </Container>
    </div>
  );
}

export default UserManagement;
