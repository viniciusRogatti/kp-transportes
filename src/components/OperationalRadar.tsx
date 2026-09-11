import { useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, RefreshCw, Search, Target } from 'lucide-react';
import { isTreatmentOverdue, TREATMENT_OVERDUE_AFTER_DAYS } from '../utils/operationalTreatments';

export type RadarEntry = { id: string; category: string; invoice: string; customer: string; city: string; detail: string; age: number };
export type RadarCategory = { key: string; label: string; description: string; count: number };
type Props = { categories: RadarCategory[]; entries: RadarEntry[]; incomplete: boolean; failed: boolean;
  onRefresh: () => Promise<void>; onOpen: (category?: string, invoice?: string) => void };

export default function OperationalRadar({ categories, entries, incomplete, failed, onRefresh, onOpen }: Props) {
  const [category, setCategory] = useState('all');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(8);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const term = normalize(search.trim());
  const urgent = entries.filter((entry) => isTreatmentOverdue(entry.age)).length;
  const oldest = entries.reduce((max, entry) => Math.max(max, entry.age), 0);
  const total = categories.reduce((sum, group) => sum + group.count, 0);
  const visible = entries.filter((entry) => (category === 'all' || entry.category === category)
    && (!urgentOnly || isTreatmentOverdue(entry.age))
    && (!term || normalize(`${entry.invoice} ${entry.customer} ${entry.city} ${entry.detail}`).includes(term)))
    .sort((a, b) => b.age - a.age || a.invoice.localeCompare(b.invoice));
  const selected = categories.find((group) => group.key === category);
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true); setRefreshError(false);
    try { await onRefresh(); } catch { setRefreshError(true); } finally { setRefreshing(false); }
  }
  return (
    <section data-tutorial="home-radar" aria-labelledby="operational-radar-title" className="mb-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
      <header className="relative overflow-hidden border-b border-border bg-gradient-to-r from-sky-500/10 via-surface to-surface p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-sky-500/10 p-10" aria-hidden="true"><div className="h-full w-full rounded-full border border-sky-500/10 p-10"><div className="h-full w-full rounded-full border border-sky-500/10" /></div></div>
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-500"><Target className="h-6 w-6" /></span>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Controle da operação</p>
              <h2 id="operational-radar-title" className="text-xl font-bold tracking-tight text-text">Radar operacional</h2></div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs ${failed || refreshError ? 'semantic-panel-danger' : 'border-border text-muted'}`} role="status">
              {failed || refreshError ? 'Atualização incompleta' : incomplete || refreshing ? 'Atualizando…' : 'Consulta carregada'}
            </span>
            <button type="button" aria-label="Atualizar radar" disabled={refreshing} onClick={() => void refresh()} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted hover:text-accent disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} /></button>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-3 divide-x divide-border">
          <div><p className="text-xs text-muted">Pendências abertas</p><strong className="mt-1 block text-3xl font-bold tabular-nums text-text">{incomplete && !total ? '—' : total}</strong></div>
          <button type="button" aria-pressed={urgentOnly} onClick={() => { setUrgentOnly(!urgentOnly); setLimit(8); }} className={`px-4 text-left transition hover:bg-red-500/5 ${urgentOnly ? 'rounded-lg ring-1 ring-red-500/50' : ''}`} data-tutorial="home-overdue-priorities">
            <p className="text-xs text-muted">Prioridades vencidas</p><strong className={`mt-1 block text-3xl font-bold tabular-nums ${urgent ? 'text-red-500' : 'text-text'}`}>{incomplete && !urgent ? '—' : urgent}</strong>
          </button>
          <div className="pl-4"><p className="text-xs text-muted">Mais antiga</p><strong className="mt-1 block text-3xl font-bold tabular-nums text-text">{incomplete && !entries.length ? '—' : oldest}<span className="ml-1 text-xs font-medium text-muted">dias</span></strong></div>
        </div>
      </header>
      {failed || refreshError ? <p role="alert" className="border-b border-border bg-red-500/5 px-4 py-2 text-xs text-red-500">Não foi possível atualizar todas as pendências. Os dados podem estar desatualizados; tente atualizar novamente.</p> : null}
      <div className="grid grid-cols-2 gap-2 border-b border-border p-3 sm:grid-cols-3 xl:grid-cols-6">
        {categories.map((group) => {
          const overdue = entries.filter((entry) => entry.category === group.key && isTreatmentOverdue(entry.age)).length;
          return <button type="button" key={group.key} data-tutorial={`home-reminder-${group.key}`} title={group.description} aria-pressed={category === group.key}
            onClick={() => { setCategory(category === group.key ? 'all' : group.key); setLimit(8); }}
            className={`flex min-w-0 flex-col rounded-xl border p-3 text-left transition hover:border-sky-500/60 ${category === group.key ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/20' : 'border-border bg-card'}`}>
            <div className="flex w-full items-center justify-between"><strong className="text-2xl font-bold tabular-nums text-text">{incomplete && !group.count ? '—' : group.count}</strong><span className={`h-2 w-2 rounded-full ${overdue ? 'bg-red-500' : group.count ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden="true" /></div>
            <span className="mt-1 text-xs font-semibold text-text">{group.label}</span>
            <span className={`mt-2 text-[10px] ${overdue ? 'text-red-500' : 'text-muted'}`}>{overdue ? `${overdue} vencida(s)` : incomplete ? 'Consulta em andamento' : group.count ? 'Em acompanhamento' : 'Sem pendências'}</span>
          </button>;
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div><h3 className="flex items-center gap-2 text-sm font-bold text-text"><Activity className="h-4 w-4 text-accent" />{selected?.label || 'Fila de ação'}</h3><p className="mt-1 text-xs text-muted">Mais antigas primeiro · vencidas após {TREATMENT_OVERDUE_AFTER_DAYS} dias</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={urgentOnly} onClick={() => { setUrgentOnly(!urgentOnly); setLimit(8); }} className={`h-9 rounded-lg border px-3 text-xs font-semibold ${urgentOnly ? 'semantic-panel-danger' : 'border-border text-muted'}`}>Só vencidas</button>
          <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2 text-muted"><Search className="h-4 w-4" /><input aria-label="Buscar no radar" placeholder="NF, cliente ou cidade" value={search} onChange={(event) => { setSearch(event.target.value); setLimit(8); }} className="w-40 bg-transparent text-xs text-text outline-none sm:w-48" /></label>
          {category !== 'all' || urgentOnly || search ? <button type="button" className="text-xs text-accent" onClick={() => { setCategory('all'); setUrgentOnly(false); setSearch(''); setLimit(8); }}>Limpar</button> : null}
        </div>
      </div>
      <div className="divide-y divide-border border-y border-border" aria-live="polite">
        {visible.slice(0, limit).map((entry) => <button type="button" key={entry.id} onClick={() => onOpen(entry.category, entry.invoice)} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sky-500/5 sm:gap-4">
          <span className={`w-12 shrink-0 rounded-lg py-2 text-center ${isTreatmentOverdue(entry.age) ? 'semantic-panel-danger' : 'border border-border bg-card text-muted'}`}><strong className="block text-sm tabular-nums">{entry.age}</strong><span className="text-[9px] uppercase">dias</span></span>
          <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-x-2"><strong className="text-sm text-text">NF {entry.invoice || '—'}</strong><span className="text-[10px] text-muted">{categories.find((group) => group.key === entry.category)?.label}</span></span><span className="mt-1 block truncate text-xs text-text" title={entry.customer}>{entry.customer || 'Cliente não informado'}</span><span className="mt-1 block truncate text-xs text-muted">{entry.city || 'Cidade não informada'} · {entry.detail}</span></span>
          <span className="hidden text-xs font-semibold text-accent group-hover:underline sm:block">Tratar</span><ArrowRight className="h-4 w-4 shrink-0 text-accent" />
        </button>)}
        {!visible.length ? <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted"><CheckCircle2 className="h-5 w-5" />{incomplete ? 'Aguardando a consulta completa das pendências.' : 'Nenhuma pendência nos filtros atuais.'}</div> : null}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 bg-card px-4 py-3">
        <span className="text-xs text-muted">{Math.min(limit, visible.length)} de {visible.length} registros carregados</span>
        {visible.length > limit ? <button type="button" onClick={() => setLimit(limit + 8)} className="text-xs font-semibold text-accent">Mostrar mais 8</button> : null}
        <button type="button" data-tutorial="home-treatment-center" onClick={() => onOpen()} className="inline-flex items-center gap-2 text-xs font-semibold text-accent">Abrir Central de Tratativas <ArrowRight className="h-4 w-4" /></button>
      </footer>
    </section>
  );
}
