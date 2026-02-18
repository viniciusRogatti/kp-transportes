import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SortingState } from '@tanstack/react-table';
import axios from 'axios';

import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import FiltersBar from '../components/ControlTower/FiltersBar';
import KpiCards from '../components/ControlTower/KpiCards';
import TopHorizontalChart, { TopMetric } from '../components/ControlTower/charts/TopHorizontalChart';
import ReasonsDonutChart from '../components/ControlTower/charts/ReasonsDonutChart';
import ActionQueue from '../components/ControlTower/ActionQueue';
import ReturnsTable from '../components/ControlTower/ReturnsTable';
import DetailsDrawer from '../components/ControlTower/DetailsDrawer';
import { exportRowsToCsv, getFilterOptions, getReturnsTable } from '../services/controlTowerService';
import { useControlTowerData, useControlTowerMutations } from '../hooks/useControlTower';
import { BacklogStatus, ControlTowerFilters } from '../types/controlTower';
import { API_URL } from '../data';
import { IOccurrence } from '../types/types';

const today = new Date().toISOString().slice(0, 10);
const CONTROL_TOWER_OCCURRENCE_RESOLUTION = 'talao_mercadoria_faltante';
const CREDIT_MANAGERS = ['control_tower', 'admin', 'master'];

const defaultFilters: ControlTowerFilters = {
  search: '',
  periodPreset: '7d',
  startDate: '',
  endDate: today,
  returnStatus: 'all',
  returnType: 'all',
  pickupStatus: 'all',
  city: '',
  route: '',
  customer: '',
  product: '',
};

function ControlTowerCollections() {
  const navigate = useNavigate();
  const userPermission = localStorage.getItem('user_permission') || '';
  const canManageStatus = ['admin', 'master', 'expedicao'].includes(userPermission);
  const canFinalizeOccurrenceCredit = CREDIT_MANAGERS.includes(userPermission);
  const [filters, setFilters] = useState<ControlTowerFilters>(defaultFilters);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(12);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'confirmedAt', desc: true }]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topMetric, setTopMetric] = useState<TopMetric>('quantity');
  const [registerNf, setRegisterNf] = useState('');
  const [registeringPickup, setRegisteringPickup] = useState(false);
  const [recentOccurrences, setRecentOccurrences] = useState<IOccurrence[]>([]);

  const sortingInput = sorting[0] ? { id: sorting[0].id as any, desc: sorting[0].desc ?? false } : undefined;
  const pagination = useMemo(() => ({ pageIndex, pageSize }), [pageIndex, pageSize]);

  const { summary, charts, queue, table } = useControlTowerData(filters, pagination, sortingInput);
  const { requestPickupMutation, updateStatusMutation, addObservationMutation, prioritizePickupMutation, getSelectedFromCache } = useControlTowerMutations(filters, pagination, sortingInput);

  const selectedRow = selectedId ? getSelectedFromCache(selectedId) : null;

  const options = getFilterOptions();

  const updatedAgoLabel = summary.data?.updatedAt
    ? formatDistanceToNow(new Date(summary.data.updatedAt), { addSuffix: false, locale: ptBR })
    : '-';

  const periodSubtitle = filters.periodPreset === 'custom'
    ? `${filters.startDate || '-'} até ${filters.endDate || '-'}`
    : filters.periodPreset === 'today'
      ? 'Hoje'
      : filters.periodPreset === '7d'
        ? 'Últimos 7 dias'
        : 'Últimos 30 dias';

  function handleFilterChange(next: Partial<ControlTowerFilters>) {
    setPageIndex(0);
    setFilters((prev) => ({ ...prev, ...next }));
  }

  const loadRecentOccurrences = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setRecentOccurrences([]);
      return;
    }

    try {
      const params = new URLSearchParams({
        workflow_status: 'awaiting_control_tower',
        status: 'resolved',
        resolution_type: CONTROL_TOWER_OCCURRENCE_RESOLUTION,
      });
      const { data } = await axios.get(`${API_URL}/occurrences/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const normalizedRows = Array.isArray(data) ? data : [];
      const talaoOnlyRows = normalizedRows.filter((occurrence) => (
        occurrence?.status === 'resolved'
        && occurrence?.resolution_type === CONTROL_TOWER_OCCURRENCE_RESOLUTION
      ));
      setRecentOccurrences(talaoOnlyRows.slice(0, 20));
    } catch {
      setRecentOccurrences([]);
    }
  }, []);

  useEffect(() => {
    loadRecentOccurrences();
  }, [loadRecentOccurrences]);

  async function applyFilterAndOpen(next: Partial<ControlTowerFilters>) {
    const merged = { ...filters, ...next };
    setPageIndex(0);
    setFilters(merged);
    const firstRow = await getReturnsTable(merged, { pageIndex: 0, pageSize: 1 }, sortingInput);
    setSelectedId(firstRow.rows[0]?.id || null);
  }

  async function handleExport() {
    const response = await getReturnsTable(filters, { pageIndex: 0, pageSize: 3000 }, sortingInput);
    const csv = exportRowsToCsv(response.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `control-tower-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    setPageIndex(0);
    setFilters(defaultFilters);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user_permission');
    delete axios.defaults.headers.common.Authorization;
    navigate('/');
  }

  async function refreshAll() {
    await Promise.all([
      summary.refetch(),
      charts.refetch(),
      queue.refetch(),
      table.refetch(),
      loadRecentOccurrences(),
    ]);
  }

  function openById(id: string) {
    setSelectedId(id);
  }

  function quickRequestPickup(id: string) {
    requestPickupMutation.mutate({ returnId: id });
  }

  function quickUpdateStatus(id: string, status: BacklogStatus) {
    if (!canManageStatus) return;
    updateStatusMutation.mutate({ pickupId: id, status });
  }

  function quickCancelPickup(id: string) {
    const row = getSelectedFromCache(id);
    if (row?.status === 'COLETADA') return;
    updateStatusMutation.mutate({ pickupId: id, status: 'CANCELADA' });
  }

  function quickTogglePriority(id: string, pickupPriority: boolean) {
    prioritizePickupMutation.mutate({ returnId: id, pickupPriority });
  }

  async function handleFinalizeOccurrenceCredit(occurrenceId: number) {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Sessão inválida. Faça login novamente.');
      return;
    }

    try {
      await axios.put(`${API_URL}/occurrences/credit/${occurrenceId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await loadRecentOccurrences();
      alert(`Crédito da ocorrência #${occurrenceId} finalizado com sucesso.`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao finalizar crédito da ocorrência.');
      } else {
        alert('Erro ao finalizar crédito da ocorrência.');
      }
    }
  }

  async function handleRegisterPickupByNf() {
    const nf = registerNf.trim();
    if (!nf) {
      alert('Informe a NF para registrar a coleta.');
      return;
    }

    setRegisteringPickup(true);
    try {
      const danfeResponse = await axios.get(`${API_URL}/danfes/nf/${nf}`);
      if (!danfeResponse?.data) {
        alert('NF não encontrada no banco de dados. Verifique o número informado.');
        return;
      }

      const response = await getReturnsTable(
        { ...filters, search: nf },
        { pageIndex: 0, pageSize: 3000 },
        sortingInput,
      );

      const row = response.rows.find((item) => String(item.invoiceNumber) === nf);

      if (!row) {
        alert('A NF existe no banco, mas não está disponível na Torre de Controle para coleta.');
        return;
      }

      if (row.status === 'COLETADA') {
        alert('Essa NF já está marcada como coletada.');
        return;
      }

      if (row.status === 'CANCELADA') {
        alert('Essa NF está com coleta cancelada e não pode ser registrada.');
        return;
      }

      quickRequestPickup(row.id);
      setRegisterNf('');
      alert(`Coleta registrada para a NF ${nf}.`);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        alert('NF não encontrada no banco de dados. Verifique o número informado.');
      } else {
        alert('Erro ao validar NF e registrar coleta.');
      }
    } finally {
      setRegisteringPickup(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070f1a] px-3 py-3 text-slate-100 lg:px-4">
      <div className="mx-auto max-w-[1550px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Control Tower | KP Transportes + Mar e Rio</h1>
            <p className="text-sm text-slate-400">Visão ampla de volume, tendência, gargalo e ação imediata.</p>
          </div>
          <Button tone="outline" className="border-slate-600 bg-slate-900 text-slate-100" onClick={logout}>Sair</Button>
        </div>

        <FiltersBar
          filters={filters}
          options={options}
          updatedAgoLabel={updatedAgoLabel}
          onChange={handleFilterChange}
          onRefresh={refreshAll}
          onReset={resetFilters}
          onExport={handleExport}
        />

        <KpiCards summary={summary.data} />

        <Card className="border-slate-800 bg-[#101b2b]">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">Ocorrências com talão (pendentes de crédito)</h3>
            <span className="text-xs text-slate-400">Pendências até confirmação do crédito</span>
          </div>
          {!recentOccurrences.length ? (
            <p className="text-xs text-slate-400">Nenhuma ocorrência com talão pendente de crédito.</p>
          ) : (
            <ul className="space-y-2">
              {recentOccurrences.map((occurrence) => (
                <li key={occurrence.id} className="rounded-sm border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-200">
                  <div>
                    <strong>NF {occurrence.invoice_number}</strong>
                    {` | Motivo: ${occurrence.reason || 'legacy_outros'}`}
                    {` | Escopo: ${occurrence.scope === 'invoice_total' ? 'NF total' : 'itens'}`}
                    {' | Status Torre: pendente de crédito'}
                  </div>
                  {occurrence.scope === 'items' && !!occurrence.items?.length ? (
                    <div className="mt-1 space-y-1 text-slate-300">
                      <div className="font-medium text-slate-200">Itens:</div>
                      {occurrence.items.map((item, index) => {
                        const itemCode = String(item.product_id || '').trim();
                        const itemDescription = String(item.product_description || '').trim();
                        const itemType = String(item.product_type || '').trim().toUpperCase();
                        const itemLabel = itemCode && itemDescription
                          ? `${itemCode} - ${itemDescription}`
                          : itemCode || itemDescription || 'Item';

                        return (
                          <div key={`ct-occ-item-${occurrence.id}-${itemCode}-${index}`} className="pl-2">
                            {itemLabel} | <strong>{`Qtd: ${Number(item.quantity || 0)}${itemType}`}</strong>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-1 text-slate-300">Itens: NF total</div>
                  )}
                  {occurrence.resolution_type === CONTROL_TOWER_OCCURRENCE_RESOLUTION ? (
                    <div className="mt-1 text-slate-300">
                      Resolução: Talão de mercadoria faltante
                      {occurrence.resolution_note ? ` | ${occurrence.resolution_note}` : ''}
                    </div>
                  ) : null}
                  {canFinalizeOccurrenceCredit ? (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => handleFinalizeOccurrenceCredit(occurrence.id)}
                        className="rounded-md border border-emerald-500/60 bg-emerald-700/25 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-700/40"
                      >
                        Crédito concluído
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="border-slate-800 bg-[#101b2b]">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <label htmlFor="register-pickup-nf" className="mb-1 block text-xs font-medium text-slate-300">
                Registrar coleta por NF
              </label>
              <input
                id="register-pickup-nf"
                value={registerNf}
                onChange={(event) => setRegisterNf(event.target.value)}
                placeholder="Digite a NF (somente notas existentes no banco)"
                className="h-10 w-full rounded-sm border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-400">A NF será validada no banco antes do registro da coleta.</p>
            </div>
            <Button
              tone="secondary"
              className="h-10 bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:opacity-60"
              onClick={handleRegisterPickupByNf}
              disabled={registeringPickup}
            >
              {registeringPickup ? 'Validando...' : 'Registrar coleta'}
            </Button>
          </div>
        </Card>

        <div className="grid gap-3 xl:grid-cols-3">
          <Card className="border-slate-800 bg-[#101b2b]">
            <div className="mb-2 flex items-center justify-end">
              <select
                value={topMetric}
                onChange={(event) => setTopMetric(event.target.value as TopMetric)}
                className="h-8 rounded-sm border border-slate-700 bg-slate-900 px-2 text-xs"
              >
                <option value="quantity">Quantidade</option>
                <option value="weightKg">Peso (kg)</option>
                <option value="valueAmount">Valor (R$)</option>
              </select>
            </div>
            <TopHorizontalChart
              title="Top produtos devolvidos"
              subtitle={periodSubtitle}
              data={charts.data?.topProducts || []}
              metric={topMetric}
              color="#60a5fa"
              onBarClick={(name) => applyFilterAndOpen({ product: name })}
            />
          </Card>

          <Card className="border-slate-800 bg-[#101b2b]">
            <TopHorizontalChart
              title="Top clientes que devolvem"
              subtitle={periodSubtitle}
              data={charts.data?.topClients || []}
              metric={topMetric}
              color="#f59e0b"
              onBarClick={(name) => applyFilterAndOpen({ customer: name })}
            />
          </Card>

          <Card className="border-slate-800 bg-[#101b2b]">
            <ReasonsDonutChart
              data={charts.data}
              subtitle={periodSubtitle}
              onSliceClick={(reason) => applyFilterAndOpen({ search: reason })}
            />
          </Card>
        </div>

        <ActionQueue
          rows={queue.data || []}
          loading={queue.isLoading}
          canManageStatus={canManageStatus}
          onTogglePriority={quickTogglePriority}
          onCancelPickup={quickCancelPickup}
          onMarkInRoute={(id) => quickUpdateStatus(id, 'EM_ROTA')}
          onMarkCollected={(id) => quickUpdateStatus(id, 'COLETADA')}
          onOpen={openById}
        />

        <ReturnsTable
          rows={table.data?.rows || []}
          total={table.data?.total || 0}
          loading={table.isLoading}
          returnTypeFilter={filters.returnType}
          pageIndex={pageIndex}
          pageSize={pageSize}
          sorting={sorting}
          onPaginationChange={setPageIndex}
          onSortingChange={setSorting}
          onFilterByReturnType={(returnType) => handleFilterChange({ returnType })}
          onOpenDetails={openById}
        />

        {selectedRow ? (
          <DetailsDrawer
            row={selectedRow}
            onClose={() => setSelectedId(null)}
            canManageStatus={canManageStatus}
            onRequestPickup={(id) => {
              quickRequestPickup(id);
            }}
            onCancelPickup={quickCancelPickup}
            onMarkInRoute={(id) => quickUpdateStatus(id, 'EM_ROTA')}
            onMarkCollected={(id) => quickUpdateStatus(id, 'COLETADA')}
            onAddObservation={(id, note) => addObservationMutation.mutate({ returnId: id, note })}
          />
        ) : null}
      </div>
    </div>
  );
}

export default ControlTowerCollections;
