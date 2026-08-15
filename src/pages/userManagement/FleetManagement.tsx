import { useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../data';
import { showConfirm, showPrompt } from '../../utils/dialog';

export type ManagedDriver = {
  id: number;
  name: string;
  is_active: boolean;
  user?: { id: number; username: string; name: string; permission: string; is_active: boolean } | null;
};

export type ManagedCar = {
  id: number;
  model: string;
  license_plate: string;
  is_active: boolean;
};

type Props = {
  tab: 'drivers' | 'cars';
  drivers: ManagedDriver[];
  cars: ManagedCar[];
  reload: () => Promise<void>;
  setError: (message: string) => void;
  setSuccess: (message: string) => void;
};

const statusBadge = (active: boolean) => (
  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${active ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'}`}>
    {active ? 'Ativo' : 'Inativo'}
  </span>
);

export default function FleetManagement({ tab, drivers, cars, reload, setError, setSuccess }: Props) {
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [carForm, setCarForm] = useState({ model: '', licensePlate: '' });

  const filteredDrivers = useMemo(() => {
    const term = filter.trim().toLocaleLowerCase('pt-BR');
    if (!term) return drivers;
    return drivers.filter((driver) => [driver.name, driver.user?.username, driver.user?.name]
      .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term)));
  }, [drivers, filter]);

  const filteredCars = useMemo(() => {
    const term = filter.trim().toUpperCase();
    if (!term) return cars;
    return cars.filter((car) => `${car.model} ${car.license_plate}`.toUpperCase().includes(term));
  }, [cars, filter]);

  async function editDriver(driver: ManagedDriver) {
    const name = await showPrompt('Informe o nome operacional do motorista.', {
      title: 'Editar motorista',
      label: 'Nome',
      initialValue: driver.name,
      confirmLabel: 'Salvar',
      required: true,
    });
    if (!name) return;
    try {
      setSaving(true);
      setError('');
      await axios.patch(`${API_URL}/drivers/${driver.id}`, { name });
      setSuccess('Motorista atualizado. O nome do usuário vinculado também foi sincronizado.');
      await reload();
    } catch (error: any) {
      setError(error?.response?.data?.message || 'Não foi possível editar o motorista.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleDriver(driver: ManagedDriver) {
    const nextActive = !driver.is_active;
    if (!await showConfirm(
      `${nextActive ? 'Reativar' : 'Desativar'} o motorista ${driver.name}?${!nextActive && driver.user ? ' O acesso do usuário vinculado também será encerrado.' : ''}`,
      { title: `${nextActive ? 'Reativar' : 'Desativar'} motorista`, confirmLabel: nextActive ? 'Reativar' : 'Desativar' },
    )) return;
    try {
      setSaving(true);
      setError('');
      await axios.patch(`${API_URL}/drivers/${driver.id}`, { is_active: nextActive });
      setSuccess(`Motorista ${nextActive ? 'reativado' : 'desativado'} com sucesso.`);
      await reload();
    } catch (error: any) {
      setError(error?.response?.data?.message || 'Não foi possível alterar o motorista.');
    } finally {
      setSaving(false);
    }
  }

  async function createCar() {
    if (!carForm.model.trim() || !carForm.licensePlate.trim()) {
      setError('Informe o modelo e a placa do veículo.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await axios.post(`${API_URL}/cars/create`, {
        model: carForm.model.trim(),
        license_plate: carForm.licensePlate.trim(),
      });
      setCarForm({ model: '', licensePlate: '' });
      setSuccess('Veículo criado com sucesso.');
      await reload();
    } catch (error: any) {
      setError(error?.response?.data?.message || 'Não foi possível criar o veículo.');
    } finally {
      setSaving(false);
    }
  }

  async function editCar(car: ManagedCar) {
    const model = await showPrompt('Informe o modelo do veículo.', {
      title: 'Editar veículo', label: 'Modelo', initialValue: car.model, confirmLabel: 'Continuar', required: true,
    });
    if (!model) return;
    const licensePlate = await showPrompt('Confira ou altere a placa.', {
      title: 'Editar veículo', label: 'Placa', initialValue: car.license_plate, confirmLabel: 'Salvar', required: true,
    });
    if (!licensePlate) return;
    try {
      setSaving(true);
      setError('');
      await axios.patch(`${API_URL}/cars/${car.id}`, { model, license_plate: licensePlate });
      setSuccess('Veículo atualizado com sucesso.');
      await reload();
    } catch (error: any) {
      setError(error?.response?.data?.message || 'Não foi possível editar o veículo.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCar(car: ManagedCar) {
    const nextActive = !car.is_active;
    if (!await showConfirm(`${nextActive ? 'Reativar' : 'Desativar'} ${car.model} - ${car.license_plate}?`, {
      title: `${nextActive ? 'Reativar' : 'Desativar'} veículo`,
      confirmLabel: nextActive ? 'Reativar' : 'Desativar',
    })) return;
    try {
      setSaving(true);
      setError('');
      await axios.patch(`${API_URL}/cars/${car.id}`, { is_active: nextActive });
      setSuccess(`Veículo ${nextActive ? 'reativado' : 'desativado'} com sucesso.`);
      await reload();
    } catch (error: any) {
      setError(error?.response?.data?.message || 'Não foi possível alterar o veículo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {tab === 'cars' ? (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-soft">
          <h2 className="text-[1.05rem] font-semibold text-text">Cadastrar veículo</h2>
          <p className="mt-1 text-sm text-muted">Veículos ativos aparecem para seleção na roteirização.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_220px_auto]">
            <input className="h-10 rounded-sm border border-border bg-card px-3 text-text" placeholder="Modelo do veículo" value={carForm.model} onChange={(event) => setCarForm((current) => ({ ...current, model: event.target.value }))} />
            <input className="h-10 rounded-sm border border-border bg-card px-3 text-text uppercase" placeholder="Placa" value={carForm.licensePlate} onChange={(event) => setCarForm((current) => ({ ...current, licensePlate: event.target.value.toUpperCase() }))} />
            <button type="button" disabled={saving} onClick={() => void createCar()} className="h-10 rounded-md bg-accent px-4 font-semibold text-white disabled:opacity-60">Cadastrar veículo</button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-soft">
          <h2 className="text-[1.05rem] font-semibold text-text">Motoristas operacionais</h2>
          <p className="mt-1 text-sm text-muted">Novos motoristas são criados junto com um usuário de perfil Motorista. Cadastros antigos podem ser ligados ao editar ou criar um usuário.</p>
        </div>
      )}

      <input className="h-10 w-full rounded-sm border border-border bg-card px-3 text-text" placeholder={tab === 'drivers' ? 'Filtrar motorista ou usuário vinculado' : 'Filtrar modelo ou placa'} value={filter} onChange={(event) => setFilter(event.target.value)} />

      <div className="w-full overflow-x-auto rounded-md border border-border shadow-soft">
        <table className="min-w-[760px]">
          <thead><tr>{tab === 'drivers' ? <><th>Motorista</th><th>Usuário vinculado</th><th>Status</th><th>Ações</th></> : <><th>Modelo</th><th>Placa</th><th>Status</th><th>Ações</th></>}</tr></thead>
          <tbody>
            {tab === 'drivers' ? filteredDrivers.map((driver) => (
              <tr key={driver.id}>
                <td>{driver.name}</td>
                <td>{driver.user ? <><span className="font-semibold">{driver.user.name}</span><span className="block text-xs text-muted">{driver.user.username}</span></> : <span className="text-amber-500">Sem usuário — disponível para vínculo</span>}</td>
                <td>{statusBadge(driver.is_active)}</td>
                <td><div className="flex gap-2"><button disabled={saving} onClick={() => void editDriver(driver)} className="rounded-md border border-border px-2 py-1 text-xs font-semibold">Editar</button><button disabled={saving} onClick={() => void toggleDriver(driver)} className="rounded-md border border-rose-400 px-2 py-1 text-xs font-semibold text-rose-500">{driver.is_active ? 'Desativar' : 'Reativar'}</button></div></td>
              </tr>
            )) : filteredCars.map((car) => (
              <tr key={car.id}>
                <td>{car.model}</td><td className="font-semibold">{car.license_plate}</td><td>{statusBadge(car.is_active)}</td>
                <td><div className="flex gap-2"><button disabled={saving} onClick={() => void editCar(car)} className="rounded-md border border-border px-2 py-1 text-xs font-semibold">Editar</button><button disabled={saving} onClick={() => void toggleCar(car)} className="rounded-md border border-rose-400 px-2 py-1 text-xs font-semibold text-rose-500">{car.is_active ? 'Desativar' : 'Reativar'}</button></div></td>
              </tr>
            ))}
            {(tab === 'drivers' ? !filteredDrivers.length : !filteredCars.length) ? <tr><td colSpan={4}>Nenhum registro encontrado.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
