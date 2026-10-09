import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import { API_URL } from '../data';

const reasons: Record<string, string> = { customer_hours: 'Horário do cliente', customer_unavailable: 'Cliente fechado ou indisponível', dispatch_priority: 'Prioridade da expedição', access_traffic: 'Acesso, trânsito ou bloqueio', unloading: 'Distribuição da carga / ordem de descarga', vehicle_transfer: 'Entrega transferida para outro veículo', other: 'Outro motivo' };
const scopes: Record<string, string> = { today: 'Só nesta viagem', weekday: 'Costuma acontecer neste dia da semana', recurring: 'Possível regra habitual', unknown: 'Não sei informar' };
type Stop = { id: number; key: string; customer: string; address: string; invoice: string; companyId: number };
type Change = { stopId: number; reason: string; scope: string; note: string };
type Plan = { id: number; tripId: number; driverId: number; companyId: number; operationDate: string; routeName: string; source: string; before: Stop[]; after: Stop[]; changes: Change[]; review: { decision: string; changes: Change[]; reviewerName: string; reviewedAt: string } | null };
type Page = { items: Plan[]; nextCursor: number | null };
const url = `${API_URL}/api/delivery-monitoring/route-learning`;
const group = (stops: Stop[]) => { const map = new Map<string, Stop[]>(); for (const stop of stops) map.set(stop.key, [...(map.get(stop.key) || []), stop]); return Array.from(map.values()); };
function Sequence({ stops }: { stops: Stop[] }) {
  return <ol className="max-h-72 space-y-2 overflow-auto p-2">{group(stops).map((notes, index) => <li key={notes[0].key} className="rounded-lg border border-border p-2 text-sm"><strong>{index + 1}. {notes[0].customer}</strong><p>{notes[0].address || 'Endereço não informado'}</p><p className="text-xs text-muted">Empresa {notes[0].companyId} · NFs {notes.map(note => note.invoice).join(', ')}</p></li>)}</ol>;
}
export function RoutePlanReview({ plan, onReviewed }: { plan: Plan; onReviewed: () => Promise<void> }) {
  const [changes, setChanges] = useState<Change[]>(plan.review?.changes || plan.changes);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [done, setDone] = useState(Boolean(plan.review)); const lock = useRef(false);
  const [result, setResult] = useState(plan.review?.decision || '');
  async function submit(decision: string) {
    if (lock.current || done) return;
    lock.current = true; setBusy(true); setError('');
    try { await axios.post(`${url}/${plan.id}/review`, { decision, changes }); setDone(true); setResult(decision); await onReviewed(); }
    catch (cause) { setError(axios.isAxiosError(cause) ? cause.response?.data?.message || 'Falha ao salvar a revisão. Tente novamente.' : 'Falha ao atualizar a revisão.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const field = 'min-h-[44px] w-full rounded-lg border border-border bg-card p-2 text-text';
  return <article className="space-y-4 rounded-2xl border border-border bg-card p-4 text-text">
    <div><h2 className="text-lg font-semibold">{plan.routeName || `Viagem #${plan.tripId}`}</h2><p className="text-sm text-muted">{plan.operationDate} · Viagem #{plan.tripId} · Motorista #{plan.driverId} · Empresa operacional {plan.companyId} · Plano #{plan.id}</p><p className="text-sm">{done ? result === 'approve' ? 'Revisado: elegível para aprendizado' : 'Revisado: não usar como padrão' : 'Aguardando revisão'} · {plan.source === 'driver' ? 'Sequência organizada pelo motorista' : plan.source === 'suggestion_accepted' ? 'Sugestão aceita sem ajuste; não conta como exemplo independente' : 'Sugestão ajustada pelo motorista; preservada para análise, sem treinar nesta etapa'}</p></div>
    <details><summary className="cursor-pointer py-2 font-semibold">Comparar sequência anterior e salva</summary><div className="grid gap-3 md:grid-cols-2"><section><h3 className="font-semibold">Antes da edição</h3><Sequence stops={plan.before} /></section><section><h3 className="font-semibold">Salva pelo motorista</h3><Sequence stops={plan.after} /></section></div></details>
    <div className="space-y-3"><h3 className="font-semibold">Relato original do motorista</h3>{plan.changes.length ? plan.changes.map(change => { const stop = plan.after.find(item => item.id === change.stopId); return <p key={change.stopId} className="text-sm">{stop?.customer} · {stop?.address}: {reasons[change.reason]} · {scopes[change.scope]}{change.note ? ` — ${change.note}` : ''}</p>; }) : <p className="text-sm text-muted">Nenhum motivo informado. A ausência de motivo não comprova uma regra habitual.</p>}</div>
    <div className="space-y-3"><h3 className="font-semibold">Explicação revisada pela expedição</h3>{changes.map((change, index) => { const stop = plan.after.find(item => item.id === change.stopId); const update = (values: Partial<Change>) => setChanges(current => current.map((item, i) => i === index ? { ...item, ...values } : item)); return <fieldset key={change.stopId} disabled={busy || done} className="space-y-2 rounded-xl border border-border p-3"><legend className="text-sm font-semibold">{stop?.customer} · {stop?.address}</legend>
      <label className="block text-sm">Motivo<select aria-label={`Motivo de ${stop?.customer}, ${stop?.address}`} className={field} value={change.reason} onChange={event => update({ reason: event.target.value })}>{Object.entries(reasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block text-sm">Alcance<select aria-label={`Alcance de ${stop?.customer}, ${stop?.address}`} className={field} value={change.scope} onChange={event => update({ scope: event.target.value })}>{Object.entries(scopes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block text-sm">Observação<textarea className={field} value={change.note} maxLength={500} onChange={event => update({ note: event.target.value })} /></label>
    </fieldset>; })}
    {!done ? <label className="block text-sm">Acrescentar motivo para uma parada<select className={field} value="" disabled={busy} onChange={event => { const id = Number(event.target.value); if (id) setChanges(current => [...current, { stopId: id, reason: 'other', scope: 'today', note: '' }]); }}><option value="">Selecionar cliente e endereço</option>{group(plan.after).filter(notes => !changes.some(change => notes.some(note => note.id === change.stopId))).map(notes => <option key={notes[0].key} value={notes[0].id}>{notes[0].customer} — {notes[0].address}</option>)}</select></label> : null}</div>
    <p className="text-xs text-muted">A revisão não muda a ordem da viagem, o status das notas ou o cadastro do cliente. Exceções desta viagem não ensinam um padrão permanente. Os atendimentos continuam registrados separadamente.</p>
    {error ? <p role="alert" className="text-red-600">{error}</p> : null}
    {!done ? <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void submit('approve')} className="min-h-[44px] rounded-lg bg-blue-600 px-4 text-white">Confirmar explicações e revisar plano</button><button type="button" disabled={busy} onClick={() => void submit('exclude')} className="min-h-[44px] rounded-lg border border-border px-4">Não usar este plano como padrão</button></div> : <p role="status" className="text-sm">Revisão preservada no histórico{plan.review?.reviewerName ? ` · ${plan.review.reviewerName}` : ''}.</p>}
  </article>;
}
export default function RouteLearning() {
  const [page, setPage] = useState<Page | null>(null); const [cursor, setCursor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const version = useRef(0);
  const load = useCallback(async () => {
    const request = ++version.current; setBusy(true); setError('');
    try { const response = await axios.get<Page>(url, { params: cursor ? { before: cursor } : {} }); if (request === version.current) setPage(response.data); }
    catch { if (request === version.current) setError('Não foi possível consultar o aprendizado. Tente atualizar.'); }
    finally { if (request === version.current) setBusy(false); }
  }, [cursor]);
  const invalidate = useCallback(() => { version.current++; }, []);
  useEffect(() => { void load(); return invalidate; }, [load, invalidate]);
  return <><Header /><main className="mx-auto max-w-6xl space-y-5 p-4"><div className="rounded-2xl border border-border bg-card p-5 text-text"><h1 className="text-2xl font-semibold">Aprendizado de rotas</h1><p className="mt-2 text-sm text-muted">Revise as sequências e os motivos apontados pelos motoristas. A roteirização automática de veículos é uma etapa futura.</p><button type="button" disabled={busy} onClick={() => void load()} className="mt-3 min-h-[44px] rounded-lg border border-border px-4">Atualizar</button></div>
    {error ? <p role="alert" className="text-red-600">{error}</p> : null}{busy ? <p role="status">Carregando planos…</p> : null}
    {!busy && !error && page?.items.length === 0 ? <p>Nenhum plano registrado nesta página.</p> : null}
    {!busy && !error ? page?.items.map(plan => <RoutePlanReview key={`${plan.id}:${plan.review?.reviewedAt || ''}`} plan={plan} onReviewed={load} />) : null}
    <div className="flex gap-2">{cursor ? <button type="button" disabled={busy} className="min-h-[44px] rounded-lg border border-border px-4 text-text" onClick={() => setCursor(null)}>Mais recentes</button> : null}{page?.nextCursor ? <button type="button" disabled={busy} className="min-h-[44px] rounded-lg border border-border px-4 text-text" onClick={() => setCursor(page.nextCursor)}>Planos anteriores</button> : null}</div>
  </main></>;
}
