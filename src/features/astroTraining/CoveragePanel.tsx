import { useRef, useState } from 'react';
import { trainingApi, trainingError, type CoveragePage, type CoverageQuery } from './api';
import { buttonClass, displayDate, fieldClass, primaryClass } from './TrainingEditor';
import { formatDateTimeBR } from '../../utils/dateDisplay';

const shift = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
function defaults(): CoverageQuery {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const today = `${values.year}-${values.month}-${values.day}`;
  return { dateFrom: shift(today, -29), dateTo: today, referenceDate: shift(today, 1) };
}
export default function CoveragePanel({ onOpen, disabled = false }: { onOpen: (id: string) => void; disabled?: boolean }) {
  const [query, setQuery] = useState<CoverageQuery>(defaults);
  const [page, setPage] = useState<CoveragePage | null>(null);
  const [activeQuery, setActiveQuery] = useState<CoverageQuery | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [term, setTerm] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const locked = useRef(false);
  async function load(more = false) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    const params = more && activeQuery ? { ...activeQuery, before: page?.nextCursor || undefined } : { ...query, tripId: query.tripId?.trim() || undefined };
    try {
      const next = await trainingApi.coverage(params);
      setPage(current => more && current ? { ...next, items: [...current.items, ...next.items.filter(item => !current.items.some(old => old.tripId === item.tripId && old.companyId === item.companyId))] } : next);
      setActiveQuery(params);
    } catch (cause) { setError(trainingError(cause)); }
    finally { locked.current = false; setBusy(false); }
  }
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const search = normalize(term.trim());
  const items = (page?.items || []).filter(item => (!onlyMissing || item.missingCount > 0)
    && (!search || normalize(`${item.tripId} ${item.routeName} ${item.driverName} ${item.missing.map(visit => `${visit.customer} ${visit.address} ${visit.invoices.join(' ')}`).join(' ')}`).includes(search)));
  const totals = items.reduce((result, item) => ({ visits: result.visits + item.totalVisits, referenced: result.referenced + item.referencedCount, missing: result.missing + item.missingCount, identity: result.identity + item.identityCount }), { visits: 0, referenced: 0, missing: 0, identity: 0 });
  return <section aria-labelledby="training-coverage-title" className="space-y-4 rounded-2xl border border-border bg-card p-5">
    <div><h2 id="training-coverage-title" className="text-lg font-bold">Onde reforçar o treinamento</h2><p className="mt-2 text-sm text-muted">Veja quais clientes/locais ainda precisam de uma posição na sequência. A análise usa a composição de viagens já cadastradas e simula uma próxima viagem com o mesmo motorista.</p></div>
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); void load(); }}>
      <fieldset disabled={busy || disabled} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">Viagens desde<input type="date" className={`${fieldClass} mt-1`} value={query.dateFrom} onChange={event => setQuery({ ...query, dateFrom: event.target.value })} required /></label>
        <label className="block text-sm">Viagens até<input type="date" className={`${fieldClass} mt-1`} value={query.dateTo} onChange={event => setQuery({ ...query, dateTo: event.target.value })} required /></label>
        <label className="block text-sm">Simular próxima viagem em<input type="date" className={`${fieldClass} mt-1`} value={query.referenceDate} onChange={event => setQuery({ ...query, referenceDate: event.target.value })} required /></label>
        <label className="block text-sm">Ou um ID de viagem<input inputMode="numeric" className={`${fieldClass} mt-1`} value={query.tripId || ''} onChange={event => setQuery({ ...query, tripId: event.target.value })} placeholder="Opcional · ignora o período" /></label>
      </fieldset>
      <button type="submit" disabled={busy || disabled} className={primaryClass}>{busy ? 'Analisando cobertura…' : page ? 'Atualizar diagnóstico' : 'Analisar viagens'}</button>
    </form>
    {error ? <p role="alert" className="semantic-panel-danger rounded-lg p-3">{error}{page ? ' Os resultados abaixo são da consulta anterior.' : ''}</p> : null}
    {busy ? <p role="status" className="text-sm text-muted">Conferindo os exemplos e as revisões disponíveis. Nenhuma viagem será alterada.</p> : null}
    {page ? <>
      <p className="text-xs text-muted">Base consultada em {formatDateTimeBR(page.generatedAt)} · Simulação para {displayDate(page.referenceDate)} · {activeQuery?.tripId ? `Viagem #${activeQuery.tripId}` : `Viagens de ${displayDate(page.dateFrom)} a ${displayDate(page.dateTo)}`}</p>
      <div className="flex flex-wrap items-center gap-3"><label className="min-w-0 flex-1 text-sm">Buscar nas viagens carregadas<input className={`${fieldClass} mt-1`} value={term} onChange={event => setTerm(event.target.value)} placeholder="Cliente pendente, cidade, motorista ou ID" /></label><label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={onlyMissing} onChange={event => setOnlyMissing(event.target.checked)} />Só viagens com lacunas</label></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Cobertura das viagens exibidas">
        {[['Viagens exibidas', items.length], ['Com referência', totals.referenced], ['Precisam de atenção', totals.missing], ['Conferir cliente/local', totals.identity]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-surface p-3"><strong className="block text-2xl tabular-nums">{value}</strong><span className="text-xs text-muted">{label}</span></div>)}
      </div>
      <p className="text-xs text-muted">Os contadores somam clientes/locais nas viagens exibidas; o mesmo cliente pode aparecer em mais de uma viagem. “Com referência” não é garantia de acerto: o motorista continua conferindo a sequência.</p>
      {!items.length ? <p className="text-sm">{page.items.length ? 'Nenhuma viagem nos filtros atuais.' : 'Nenhuma viagem encontrada neste período ou ID. Experimente outro período.'}</p> : items.map(item => <article key={`${item.companyId}:${item.tripId}`} className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{item.routeName}</h3><p className="mt-1 text-sm text-muted">Viagem #{item.tripId} · {displayDate(item.operationDate)} · {item.driverName} · Empresa operacional {item.companyId}</p></div><span className={`rounded-full border px-3 py-1 text-xs ${item.missingCount ? 'semantic-panel-warning' : 'border-border'}`}>{item.totalVisits ? `${item.referencedCount} de ${item.totalVisits} com referência` : 'Sem clientes para analisar'}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-blue-500/10" role="img" aria-label={`${item.referencedCount} de ${item.totalVisits} clientes/locais com referência`}><div className="h-full bg-blue-500" style={{ width: `${item.totalVisits ? item.referencedCount / item.totalVisits * 100 : 0}%` }} /></div>
        <p className="text-sm">{item.exampleVersion ? `Esta viagem já tem exemplo salvo · revisão ${item.exampleVersion}.` : 'Esta viagem ainda não tem exemplo cadastrado.'} {item.trainingExample ? `Referência selecionada: ${item.trainingExample.routeName} · viagem #${item.trainingExample.tripId}, revisão ${item.trainingExample.version}.` : 'Nenhum exemplo fotográfico compatível selecionado; revisões dos motoristas também são consideradas.'}</p>
        {item.truncated ? <p className="semantic-panel-warning rounded-lg p-2 text-sm">A consulta atingiu o limite do histórico recente. A cobertura pode estar incompleta.</p> : null}
        {item.missing.length ? <details open><summary className="min-h-[44px] cursor-pointer py-3 font-semibold">{item.missingCount} clientes/locais para conferir</summary><ul className="space-y-2">{item.missing.map(visit => <li key={visit.key} className="rounded-lg border border-border bg-card p-3 text-sm"><strong>{visit.customer || 'Cliente não identificado'}</strong><p className="mt-1">{visit.address || 'Endereço não informado'}</p><p className="mt-1 text-xs text-muted">Empresa {visit.companyId} · NFs {visit.invoices.join(', ')}</p><p className="mt-2 text-sm">{visit.state === 'check_identity' ? 'Conferir identidade/local de entrega. Há dados insuficientes ou NFs separadas; cadastrar mais fotos sozinho pode não resolver.' : 'Sem posição de referência para esta composição e motorista. Procure uma foto que mostre este cliente junto aos outros e cadastre a sequência.'}</p></li>)}</ul></details> : item.totalVisits ? <p className="text-sm">Todos os clientes/locais desta composição têm referência na simulação.</p> : null}
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || disabled} className={buttonClass} onClick={() => onOpen(String(item.tripId))}>{item.exampleVersion ? 'Conferir exemplo desta viagem' : 'Cadastrar exemplo desta viagem'}</button><details className="text-sm"><summary className="min-h-[44px] cursor-pointer px-2 py-3 text-accent">Como o Astro chegou a este resultado</summary><p className="max-w-3xl text-muted">{item.explanation}</p></details></div>
      </article>)}
      {page.nextCursor ? <button type="button" disabled={busy || disabled} className={buttonClass} onClick={() => void load(true)}>Analisar mais viagens</button> : null}
      <p className="text-xs text-muted">A base considera empresa, motorista, cliente/local e dia da simulação. Exemplos isolados e nomes parecidos não comprovam encaixe. Cadastre a ordem da foto; depois atualize o diagnóstico. Esta análise não altera planos, destinos ou status.</p>
    </> : <p className="text-sm text-muted">Comece pelas viagens dos últimos 30 dias ou informe um ID. A consulta é feita quando você solicita.</p>}
  </section>;
}
