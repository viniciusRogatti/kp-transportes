import { useMemo, useRef, useState } from 'react';
import { IDanfe } from '../../types/types';
import useRouteCatalog from '../../hooks/useRouteCatalog';
import { CityTransfer, normalizeRouteCity, PlannedRoute, RouteSummary, summarizeRoutes, UNASSIGNED_ROUTE } from '../../utils/routeCatalog';

type Props = { danfes: IDanfe[]; availableCities: string[]; catalog: ReturnType<typeof useRouteCatalog>; onSelectRoute: (id: string) => void; incomplete?: boolean; summary?: RouteSummary[] };
const actionClass = 'rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-text hover:bg-surface-2 disabled:opacity-50';

export default function RouteOverview({ danfes, availableCities, catalog, onSelectRoute, incomplete, summary }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<PlannedRoute[]>([]);
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [transfers, setTransfers] = useState<CityTransfer[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<{ city: string; fromName: string } | null>(null);
  const canEdit = ['admin', 'master', 'expedicao'].includes(localStorage.getItem('user_permission') || '');
  const groups = useMemo(() => summary || summarizeRoutes(danfes, catalog.data?.routes || []), [summary, danfes, catalog.data]);
  const selected = draft.find((route) => route.id === selectedId);
  const suggestions = useMemo(() => {
    const cities = new Map<string, string>();
    [...availableCities, ...draft.flatMap((route) => route.cities)].forEach((city) => cities.set(normalizeRouteCity(city), city));
    const owners = new Map(draft.flatMap((route) => route.cities.map((city) => [normalizeRouteCity(city), route])));
    return Array.from(cities.entries()).filter(([key]) => key.includes(normalizeRouteCity(citySearch)))
      .map(([key, city]) => ({ city, owner: owners.get(key) }))
      .sort((a, b) => Number(Boolean(a.owner)) - Number(Boolean(b.owner)) || a.city.localeCompare(b.city, 'pt-BR'));
  }, [availableCities, draft, citySearch]);

  function open() {
    setDraft((catalog.data?.routes || []).map((route) => ({ ...route, cities: [...route.cities] })));
    setVersion(catalog.data?.version || 0);
    setSelectedId(catalog.data?.routes[0]?.id || '');
    setTransfers([]); setError(''); setCitySearch(''); setPendingTransfer(null);
    dialog.current?.showModal();
  }
  function addCity(city: string, confirmed = false, targetId = selectedId) {
    const target = draft.find((route) => route.id === targetId);
    if (!target || !city.trim()) return;
    const key = normalizeRouteCity(city);
    if (!key) return;
    const owner = draft.find((route) => route.cities.some((candidate) => normalizeRouteCity(candidate) === key));
    if (owner?.id === target.id) return;
    if (owner && !confirmed) { setPendingTransfer({ city, fromName: owner.name }); return; }
    setPendingTransfer(null);
    const original = catalog.data?.routes.find((route) => route.cities.some((candidate) => normalizeRouteCity(candidate) === key));
    setTransfers((old) => [...old.filter((item) => normalizeRouteCity(item.city) !== key),
      ...(original && original.id !== target.id ? [{ city, from: original.id, to: target.id }] : [])]);
    setDraft((old) => old.map((route) => ({ ...route,
      cities: [...route.cities.filter((candidate) => normalizeRouteCity(candidate) !== key), ...(route.id === target.id ? [city.trim()] : [])],
    })));
    setCitySearch('');
  }
  async function save() {
    setSaving(true); setError('');
    try { await catalog.save(draft, version, transfers); dialog.current?.close(); }
    catch (failure: any) { setError(failure?.response?.data?.error || 'Não foi possível salvar as rotas. Tente novamente.'); }
    finally { setSaving(false); }
  }

  return (
    <section className="mb-4 w-full rounded-lg border border-border bg-surface p-4" aria-labelledby="route-overview-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="route-overview-title" className="font-semibold text-text">Prévia de carga por rota</h2>
          <p className="text-xs text-muted">{summary ? 'Período inteiro nos filtros atuais' : 'Notas nos filtros atuais'} · cidades com carga e peso bruto. {incomplete ? 'Prévia parcial: carregue o restante do período para obter os totais.' : ''}</p></div>
        <button type="button" className={actionClass} onClick={open} disabled={!catalog.data}>Ver cidades / gerenciar rotas</button>
      </div>
      {catalog.isError ? <p role="alert" className="mt-3 text-sm text-danger">Não foi possível carregar as rotas. <button type="button" onClick={() => void catalog.refetch()} className="underline">Tentar novamente</button></p>
        : catalog.isLoading ? <p role="status" className="mt-3 text-sm text-muted">Carregando rotas…</p>
          : <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {groups.filter((group) => group.count > 0).map((group) => <button type="button" key={group.id} onClick={() => onSelectRoute(group.id)}
              className={`rounded-md border p-3 text-left ${group.id === UNASSIGNED_ROUTE ? 'semantic-panel-warning' : 'border-border bg-card text-text'}`}>
              <span className="flex items-start justify-between gap-2"><strong className="text-sm">{group.name}</strong>
                <strong className="whitespace-nowrap text-sm">{group.weight.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg</strong></span>
              <span className="mt-1 block text-xs">{group.count} nota(s) · {group.presentCities.length} cidade(s) com carga</span>
              <span className="mt-2 block text-xs text-muted">{group.presentCities.join(' · ')}</span>
            </button>)}
            {!groups.some((group) => group.count > 0) ? <p className="text-sm text-muted">Sem notas nos filtros atuais.</p> : null}
          </div>}
      <dialog ref={dialog} aria-labelledby="route-editor-title" onCancel={(event) => { if (saving) event.preventDefault(); }}
        className="m-auto max-h-[90vh] w-[min(900px,94vw)] overflow-y-auto rounded-xl border border-border bg-surface p-5 text-text shadow-elevated backdrop:bg-black/50">
        <div className="flex items-center justify-between gap-3"><h2 id="route-editor-title" className="text-lg font-semibold">Cidades e rotas</h2>
          <button type="button" className={actionClass} disabled={saving} onClick={() => dialog.current?.close()}>Fechar</button></div>
        <p className="my-3 text-sm text-muted">Salvar atualiza os filtros e as prévias, inclusive de períodos anteriores. Viagens já criadas mantêm suas paradas.</p>
        <fieldset disabled={saving} className="min-w-0">
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Rota
                <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setPendingTransfer(null); }} className="mt-1 w-full rounded border border-border bg-card p-2">
                  {!draft.length ? <option value="">Nenhuma rota cadastrada</option> : null}
                  {draft.map((route) => <option key={route.id} value={route.id}>{route.name || 'Nova rota'}</option>)}
                </select></label>
              {canEdit ? <button type="button" className={actionClass} onClick={() => {
                const id = `route-${crypto.randomUUID()}`; setDraft((old) => [...old, { id, name: '', cities: [] }]); setSelectedId(id); setPendingTransfer(null);
              }}>Criar rota</button> : null}
            </div>
            {selected ? <div>
              <label className="block text-sm font-medium">Nome da rota
                <input maxLength={100} readOnly={!canEdit} value={selected.name} placeholder="Ex.: Rota Araras" onChange={(event) => setDraft((old) => old.map((route) => route.id === selectedId ? { ...route, name: event.target.value } : route))}
                  className="mt-1 w-full rounded border border-border bg-card p-2" /></label>
              <div className="my-3 flex flex-wrap gap-2" aria-label="Cidades da rota">
                {selected.cities.map((city) => <span key={city} className="rounded-full border border-border bg-card px-3 py-1 text-sm">{city}
                  {canEdit && draft.length > 1 ? <select aria-label={`Mover ${city} para outra rota`} value="" onChange={(event) => addCity(city, true, event.target.value)} className="ml-2 max-w-[180px] rounded border border-border bg-surface px-1 py-0.5 text-xs">
                    <option value="" disabled>Mover para…</option>
                    {draft.filter((route) => route.id !== selectedId).map((route) => <option key={route.id} value={route.id}>{route.name || 'Nova rota'}</option>)}
                  </select> : null}
                  {canEdit ? <button type="button" aria-label={`Remover ${city}`} className="ml-2" onClick={() => setDraft((old) => old.map((route) => route.id === selectedId ? { ...route, cities: route.cities.filter((item) => item !== city) } : route))}>×</button> : null}</span>)}
                {!selected.cities.length ? <div className="flex flex-wrap items-center gap-2 text-sm text-muted"><p>Esta rota não tem cidades.</p>
                  {canEdit ? <button type="button" className="text-danger underline" onClick={() => {
                    setDraft((old) => old.filter((route) => route.id !== selectedId));
                    setSelectedId(draft.find((route) => route.id !== selectedId)?.id || '');
                    setPendingTransfer(null);
                  }}>Excluir rota vazia</button> : null}
                </div> : null}
              </div>
              {canEdit ? <><label className="block text-sm font-medium">Buscar ou adicionar cidade
                <input value={citySearch} maxLength={150} onChange={(event) => setCitySearch(event.target.value)} className="mt-1 w-full rounded border border-border bg-card p-2" placeholder="Ex.: Araras" /></label>
                <div className="mt-2 max-h-52 overflow-y-auto rounded border border-border">
                  {suggestions.map(({ city, owner }) => <button key={normalizeRouteCity(city)} type="button" disabled={owner?.id === selectedId}
                    className="flex w-full items-center justify-between gap-2 border-b border-border p-2 text-left text-sm hover:bg-card disabled:opacity-50" onClick={() => addCity(city)}>
                    <span>{city}</span><span className="text-xs text-muted">{owner ? owner.name : 'Sem rota'}</span></button>)}
                </div>
                {citySearch.trim() && !suggestions.some(({ city }) => normalizeRouteCity(city) === normalizeRouteCity(citySearch))
                  ? <button type="button" className={`${actionClass} mt-2`} onClick={() => addCity(citySearch)}>Adicionar “{citySearch.trim()}”</button> : null}
              </> : null}
            </div> : null}
          </div>
        </fieldset>
        {pendingTransfer && selected ? <div role="alert" className="mt-3 rounded border p-3 text-sm semantic-panel-warning">
          <p>{pendingTransfer.city} pertence à {pendingTransfer.fromName}. Remover dessa rota e adicionar à {selected.name || 'nova rota'}?</p>
          <div className="mt-2 flex gap-2"><button type="button" autoFocus disabled={saving} className={actionClass} onClick={() => addCity(pendingTransfer.city, true)}>Sim, transferir cidade</button>
            <button type="button" disabled={saving} className={actionClass} onClick={() => setPendingTransfer(null)}>Cancelar transferência</button></div>
        </div> : null}
        {error ? <p role="alert" className="mt-3 rounded border p-3 text-sm semantic-panel-danger">{error}</p> : null}
        {canEdit ? <div className="mt-4 flex justify-end"><button type="button" className={actionClass} disabled={saving || Boolean(pendingTransfer)} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar rotas'}</button></div> : null}
      </dialog>
    </section>
  );
}
