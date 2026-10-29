import { useEffect, useRef, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import Header from '../components/Header';
import TrainingEditor, { buttonClass, displayDate, fieldClass, primaryClass } from '../features/astroTraining/TrainingEditor';
import { trainingApi, trainingError, type ExampleSummary, type TrainingTrip } from '../features/astroTraining/api';
import { initialDraft, payloadFor, type TrainingDraft } from '../features/astroTraining/draft';
import { draftKey, readDraft, writeDraft } from '../features/astroTraining/storage';
import CoveragePanel from '../features/astroTraining/CoveragePanel';

export default function AstroTraining() {
  const [tripId, setTripId] = useState('');
  const [data, setData] = useState<TrainingTrip | null>(null);
  const [draft, setDraft] = useState<TrainingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState('');
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState<{ tripId: number; name: string; version: number } | null>(null);
  const [examples, setExamples] = useState<ExampleSummary[] | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [listError, setListError] = useState('');
  const [confirmReload, setConfirmReload] = useState(false);
  const [editorGeneration, setEditorGeneration] = useState(0);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const reloadRef = useRef<HTMLElement>(null);
  useEffect(() => { if (confirmReload) { reloadRef.current?.scrollIntoView?.({ block: 'center' }); reloadRef.current?.focus(); } }, [confirmReload]);
  useEffect(() => { if (error || localError || success) { feedbackRef.current?.scrollIntoView?.({ block: 'center' }); feedbackRef.current?.focus(); } }, [error, localError, success]);

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (cause) { setError(trainingError(cause)); }
    finally { locked.current = false; setBusy(false); }
  }
  function change(next: TrainingDraft) {
    if (!data) return;
    setDraft(next);
    try { writeDraft(draftKey(data), next); setLocalError(''); }
    catch (cause) { setLocalError(trainingError(cause)); }
  }
  function openTrip(value: string, discard = false) {
    void run(async () => {
      if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error('Digite o ID numérico da viagem que aparece no romaneio.');
      const next = await trainingApi.trip(value.trim());
      const key = draftKey(next);
      setData(next); setDraft(null); setSuccess(null); setLocalError(''); setConfirmReload(false);
      const restored = discard ? initialDraft(next) : readDraft(key) || initialDraft(next);
      // Replace a draft only after the user confirms and the fresh lookup succeeds.
      if (discard) writeDraft(key, restored);
      setDraft(restored); setEditorGeneration(current => current + 1);
    });
  }
  function save(next: TrainingDraft) {
    void run(async () => {
      if (!data) return;
      const request = payloadFor(data, next, () => crypto.randomUUID());
      setDraft(request.draft);
      // Persist the exact event ID before PUT. A timeout/reload resends the same request.
      writeDraft(draftKey(data), request.draft); setLocalError('');
      const result = await trainingApi.save(data.trip.id, request.payload);
      try { localStorage.removeItem(draftKey(data)); }
      catch { setLocalError('Salvo na base, mas não foi possível limpar o rascunho antigo deste navegador.'); }
      setSuccess({ tripId: data.trip.id, name: request.payload.routeName, version: result.version });
      setData(null); setDraft(null); setTripId(''); setExamples(null); setCursor(null); setListError('');
    });
  }
  function list(before?: number) {
    void run(async () => {
      setListError('');
      try {
        const page = await trainingApi.list(before);
        setExamples(current => before ? [...(current || []), ...page.items.filter(item => !current?.some(previous => previous.id === item.id))] : page.items);
        setCursor(page.nextCursor);
      } catch (cause) { setListError(trainingError(cause)); }
    });
  }
  return <><Header /><main className="mx-auto max-w-6xl space-y-5 p-4 pb-8 pt-[calc(var(--header-height)+1rem)] text-text">
    <header className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-3"><span className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-blue-500"><BookOpen className="h-6 w-6" /></span><div><p className="text-xs font-bold uppercase tracking-widest text-muted">Astro · Base de exemplos</p><h1 className="text-2xl font-bold">Treinamento do Astro</h1></div></div>
      <p className="mt-4 max-w-3xl text-sm text-muted">Use o ID do romaneio e organize as NFs pela ordem da foto do carregamento. Os exemplos salvos compõem a base de sequências do Astro.</p>
    </header>
    <div ref={feedbackRef} tabIndex={-1} className="space-y-3">
    {error ? <p role="alert" className="semantic-panel-danger rounded-xl p-4">{error}</p> : null}
    {localError ? <p role="alert" className="semantic-panel-warning rounded-xl p-4">{localError}</p> : null}
    {busy ? <p role="status" className="text-sm text-muted">Aguarde a confirmação da base…</p> : null}
    </div>
    {data ? <>
      {confirmReload ? <section ref={reloadRef} tabIndex={-1} aria-label="Substituir rascunho" className="space-y-3 rounded-xl border border-border bg-card p-4"><p>Substituir a edição deste navegador pelo último exemplo salvo na base?</p><div className="flex flex-wrap gap-2"><button disabled={busy} type="button" className={primaryClass} onClick={() => openTrip(String(data.trip.id), true)}>Substituir rascunho e reabrir</button><button disabled={busy} type="button" className={buttonClass} onClick={() => setConfirmReload(false)}>Manter edição</button></div></section> : null}
      {draft ? <TrainingEditor key={editorGeneration} data={data} draft={draft} busy={busy || confirmReload} onChange={change} onSave={save} onReload={() => setConfirmReload(true)} onBack={() => { if (localError) { setError('O rascunho ainda não foi guardado. Tente salvar ou faça uma nova edição antes de trocar de viagem.'); return; } setData(null); setDraft(null); setError(''); }} /> : <button type="button" disabled={busy} className={buttonClass} onClick={() => setConfirmReload(true)}>Reabrir da base</button>}
    </> : <>
      {success ? <section role="status" className="semantic-panel-success space-y-2 rounded-xl border p-4"><h2 className="font-bold">Exemplo salvo na base · revisão {success.version}</h2><p>Viagem #{success.tripId} · {success.name}</p><button type="button" disabled={busy} className={buttonClass} onClick={() => openTrip(String(success.tripId))}>Editar este exemplo</button></section> : null}
      <section className="grid gap-6 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
        <form className="space-y-3" onSubmit={event => { event.preventDefault(); openTrip(tripId); }}><label className="block font-semibold">{success ? 'ID da próxima viagem' : 'ID da viagem no romaneio'}<input autoFocus inputMode="numeric" className={`${fieldClass} mt-2`} aria-label="ID da viagem" placeholder="Ex.: 18427" value={tripId} onChange={event => setTripId(event.target.value)} disabled={busy} /></label><button type="submit" disabled={busy || !tripId.trim()} className={`${primaryClass} inline-flex items-center gap-2`}><Search className="h-4 w-4" />Buscar viagem</button><p className="text-xs text-muted">Já salvou este ID? Abra para conferir ou editar o mesmo exemplo.</p></form>
        <div className="space-y-3 text-sm"><h2 className="font-bold">Da foto para a base</h2><ol className="list-inside list-decimal space-y-2 text-muted"><li>Confira motorista, data e NFs da viagem.</li><li>Organize a sequência e deixe fora o que não foi levado.</li><li>Dê um nome ao exemplo e salve.</li></ol><p className="text-xs text-muted">O cadastro não altera a viagem original. A foto representa a ordem do carregamento, não comprova o percurso executado.</p></div>
      </section>
      <CoveragePanel onOpen={id => openTrip(id)} disabled={busy} />
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Exemplos salvos</h2><button type="button" className={buttonClass} disabled={busy} onClick={() => list()}>{examples ? 'Atualizar exemplos' : 'Consultar exemplos'}</button></div>
        {listError ? <p role="alert" className="semantic-panel-danger rounded-lg p-3">{listError}</p> : null}
        {examples === null ? <p className="text-sm text-muted">Consulte os exemplos para retomar uma viagem já organizada.</p> : examples.length === 0 && !listError ? <p className="text-sm text-muted">Nenhum exemplo salvo. Comece pelo ID de uma viagem.</p> : <div className="grid gap-3 sm:grid-cols-2">{examples.map(example => <button key={example.id} type="button" disabled={busy} aria-label={`Editar viagem ${example.tripId}`} className="space-y-2 rounded-xl border border-border bg-surface p-4 text-left hover:border-blue-500 disabled:opacity-50" onClick={() => openTrip(String(example.tripId))}><strong className="block break-words">#{example.tripId} · {example.routeName}</strong><span className="block text-sm text-muted">{example.driverName} · {displayDate(example.operationDate)}</span><span className="block text-xs text-muted">Empresa {example.companyId} · {example.includedCount} NFs incluídas · {example.excludedCount} fora · revisão {example.version}</span></button>)}</div>}
        {cursor ? <button type="button" disabled={busy} className={buttonClass} onClick={() => list(cursor)}>Ver mais exemplos</button> : null}
      </section>
    </>}
  </main></>;
}
