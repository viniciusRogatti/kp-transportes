import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { exclusionReasons, trainingError, type ExclusionReason, type TrainingTrip } from './api';
import { activeInvoices, changeTrainingSeparation, excludeNotes, interleavedInvoices, moveInvoice, previewInvoiceSequence, type TrainingDraft } from './draft';

export const fieldClass = 'min-h-[44px] w-full rounded-lg border border-border bg-card px-3 py-2 text-text';
export const buttonClass = 'min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-text hover:border-blue-500 disabled:opacity-50';
export const primaryClass = 'min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
export const displayDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || 'Data não informada';
};

function Position({ position, max, invoice, onMove }: { position: number; max: number; invoice: string; onMove: (text: string) => void }) {
  const [text, setText] = useState(String(position));
  return <form className="flex items-center gap-1" onSubmit={event => { event.preventDefault(); onMove(text); }}>
    <input aria-label={`Posição da NF ${invoice}`} title={`Posição de 1 a ${max}`} inputMode="numeric" value={text} onChange={event => setText(event.target.value)} onFocus={event => event.target.select()} className={`${fieldClass} max-w-[4rem] text-center font-bold`} />
    <button type="submit" className={buttonClass} aria-label={`Mover NF ${invoice} para a posição informada`}>Mover</button>
  </form>;
}

export default function TrainingEditor({ data, draft, busy, onChange, onSave, onReload, onBack }: {
  data: TrainingTrip; draft: TrainingDraft; busy: boolean;
  onChange: (draft: TrainingDraft) => void; onSave: (draft: TrainingDraft) => void; onReload: () => void; onBack: () => void;
}) {
  const [sequence, setSequence] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof previewInvoiceSequence> | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmSplit, setConfirmSplit] = useState(false);
  const dragId = useRef<string | null>(null);
  const splitRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (confirmSplit) { splitRef.current?.scrollIntoView?.({ block: 'center' }); splitRef.current?.focus(); } }, [confirmSplit]);
  useEffect(() => { if (error) { errorRef.current?.scrollIntoView?.({ block: 'center' }); errorRef.current?.focus(); } }, [error]);
  const invoices = activeInvoices(data, draft);
  const outside = data.stops.filter(stop => draft.exclusions[stop.id]);
  const interleaved = interleavedInvoices(data, draft);
  const stale = draft.sourceRevision !== data.sourceRevision || draft.expectedVersion !== (data.example?.version || 0);
  function change(next: TrainingDraft) {
    setPreview(null); setConfirmSplit(false); setError(''); setNotice(''); onChange(next);
  }
  function move(id: string, text: string) {
    try { change(moveInvoice(data, draft, id, text)); setNotice(`NF movida para a posição ${Number(text)}.`); }
    catch (cause) { setError(trainingError(cause)); }
  }
  function save() {
    setError('');
    if (draft.routeName.trim().length < 3) { setError('Dê um nome ao exemplo, com pelo menos 3 caracteres.'); return; }
    if (interleaved.length) { setConfirmSplit(true); return; }
    onSave(draft);
  }
  return <div className="space-y-4">
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Viagem #{data.trip.id}</h2><p className="mt-1 text-sm text-muted">{data.trip.driverName} · {displayDate(data.trip.operationDate)} · Empresa operacional {data.trip.companyId}</p></div>
        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm">{data.example ? `Salvo · revisão ${data.example.version}` : 'Novo exemplo'}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm"><strong>{invoices.length} NFs incluídas</strong><span>{outside.length} fora do exemplo</span><span className="text-muted">{data.stops.length} NFs na viagem</span></div>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} className={buttonClass} onClick={onBack}>Outra viagem</button><button type="button" disabled={busy} className={buttonClass} onClick={onReload}>Reabrir da base</button></div>
      {stale || data.example?.sourceChanged ? <p role="alert" className="semantic-panel-warning mt-4 rounded-lg p-3 text-sm">{stale ? 'O rascunho tem uma versão anterior da base. Se o último envio ficou sem resposta, tente salvar novamente para confirmar o mesmo pedido; caso haja conflito, reabra da base.' : 'A carga mudou desde o exemplo salvo. Confira todas as NFs antes de salvar uma nova revisão.'}</p> : null}
    </section>
    {error ? <p ref={errorRef} tabIndex={-1} role="alert" className="semantic-panel-danger rounded-lg p-3">{error}</p> : null}
    {notice ? <p role="status" className="text-sm text-accent">{notice}</p> : null}
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
        <section className="min-w-0 space-y-3">
          <div><h3 className="font-bold">NFs na ordem da foto</h3><p className="mt-1 text-sm text-muted">Arraste pela alça no computador ou informe a posição e toque em Mover. As outras notas se deslocam na sequência.</p></div>
          <ol className="space-y-2" aria-label="Sequência de NFs">
            {invoices.map((stop, index) => <li key={stop.id} className="rounded-xl border border-border bg-card p-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-3" onDragOver={event => { if (!busy && dragId.current) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onDrop={event => { event.preventDefault(); if (!busy && dragId.current) move(dragId.current, String(index + 1)); dragId.current = null; }}>
              <div className="flex items-start gap-2 sm:row-span-2">
                <button type="button" draggable={!busy} aria-label={`Arrastar NF ${stop.invoice}`} title="Arraste para outra posição ou use os controles abaixo" onDragStart={event => { dragId.current = stop.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', stop.id); }} onDragEnd={() => { dragId.current = null; }} className="flex min-h-[44px] w-11 shrink-0 cursor-grab items-center justify-center rounded-lg border border-border text-muted"><GripVertical className="h-5 w-5" /></button>
                <div className="min-w-0 flex-1 break-words"><p className="font-bold"><span className="mr-2 text-blue-500">{index + 1}.</span>NF {stop.invoice}</p><p className="mt-1 text-sm font-semibold">{stop.customer || 'Cliente não informado'}</p><p className="mt-1 text-sm text-muted">{stop.address || 'Endereço não informado'}</p><p className="mt-1 text-xs text-muted">Empresa {stop.companyId}{stop.separateDelivery ? ' · Entrega separada' : ''}</p></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
                <Position key={`${stop.id}:${index}`} position={index + 1} max={invoices.length} invoice={stop.invoice} onMove={text => move(stop.id, text)} />
                <button type="button" className={buttonClass} disabled={busy || index === 0} aria-label={`Subir NF ${stop.invoice}`} onClick={() => move(stop.id, String(index))}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" className={buttonClass} disabled={busy || index === invoices.length - 1} aria-label={`Descer NF ${stop.invoice}`} onClick={() => move(stop.id, String(index + 2))}><ArrowDown className="h-4 w-4" /></button>
              </div>
              <details className="mt-2 text-sm"><summary className="min-h-[44px] cursor-pointer py-3 text-accent">Opções da NF {stop.invoice}</summary>
                <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => change(changeTrainingSeparation(data, draft, stop.id, !stop.separateDelivery))}>{stop.separateDelivery ? 'Juntar novamente' : 'Separar esta NF'}</button>
                  <label className="block w-full">Deixar fora do exemplo<select aria-label={`Excluir NF ${stop.invoice}`} className={`${fieldClass} mt-1`} value="" onChange={event => { if (event.target.value) change(excludeNotes(draft, [stop.id], event.target.value as ExclusionReason)); }}><option value="">Escolha o motivo</option>{Object.entries(exclusionReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                </div>
              </details>
            </li>)}
          </ol>
          {!invoices.length ? <p className="rounded-xl border border-border p-4 text-sm">Nenhuma NF incluída. Recoloque as notas que fazem parte deste exemplo.</p> : null}
        </section>
        <aside className="min-w-0 space-y-4">
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h3 className="font-bold">Informar NFs na ordem</h3><p className="text-sm text-muted">Cole números completos ou finais únicos, separados por espaço, vírgula ou linha.</p>
            <label className="block text-sm">Sequência de NFs<textarea className={`${fieldClass} mt-1 min-h-[110px]`} value={sequence} maxLength={12000} onChange={event => { setSequence(event.target.value); setPreview(null); }} placeholder="12345, 67890, 54321" /></label>
            <button type="button" className={buttonClass} onClick={() => { setError(''); try { setPreview(previewInvoiceSequence(data, draft, sequence)); } catch (cause) { setPreview(null); setError(trainingError(cause)); } }}>Conferir sequência</button>
            {preview ? <div className="space-y-3 rounded-lg border border-blue-500/30 p-3"><p className="text-sm font-semibold">{preview.entered} NFs reconhecidas</p><p className="text-sm">{preview.remaining ? `${preview.remaining} NFs não informadas ficarão ao final, na ordem atual. Nenhuma será excluída.` : 'Todas as NFs incluídas foram informadas.'}</p><ol className="max-h-72 space-y-2 overflow-auto text-sm">{activeInvoices(data, preview.draft).map((stop, index) => <li key={stop.id}>{index + 1}. NF {stop.invoice} · {stop.customer} · Empresa {stop.companyId}</li>)}</ol><button type="button" className={primaryClass} onClick={() => { change(preview.draft); setNotice('Sequência aplicada. Confira a lista antes de salvar.'); }}>Aplicar esta sequência</button></div> : null}
          </section>
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h3 className="font-bold">Identificação do exemplo</h3>
            <label className="block text-sm">Nome do exemplo<input className={`${fieldClass} mt-1`} value={draft.routeName} maxLength={100} onChange={event => change({ ...draft, routeName: event.target.value, request: null })} placeholder="Rio Claro · Limeira · Araras" /></label>
            <label className="block text-sm">Observação (opcional)<textarea className={`${fieldClass} mt-1`} value={draft.note} maxLength={500} onChange={event => change({ ...draft, note: event.target.value, request: null })} /></label>
            <p className="text-xs text-muted">O nome pode se repetir. Cada ID de viagem mantém seu exemplo; editar o mesmo ID cria uma nova revisão.</p>
          </section>
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h3 className="font-bold">Fora do exemplo ({outside.length})</h3>
            {!outside.length ? <p className="text-sm text-muted">Todas as NFs estão incluídas.</p> : outside.map(stop => <div key={stop.id} className="space-y-2 border-t border-border pt-3 text-sm"><strong>NF {stop.invoice} · {stop.customer}</strong><p>{stop.address || 'Endereço não informado'} · Empresa {stop.companyId}</p><p className="text-muted">{exclusionReasons[draft.exclusions[stop.id]]}</p><button type="button" className={buttonClass} onClick={() => change(excludeNotes(draft, [stop.id], null))}>Recolocar NF {stop.invoice}</button></div>)}
          </section>
        </aside>
      </div>
      {confirmSplit ? <section ref={splitRef} tabIndex={-1} aria-label="Conferir entregas separadas" className="semantic-panel-warning space-y-3 rounded-xl border p-4"><h3 className="font-bold">Conferir entregas separadas</h3><p className="text-sm">Estas NFs têm o mesmo cliente/local de outras notas, mas ficaram em outro ponto da sequência. Confirme a separação neste exemplo ou volte e coloque-as lado a lado.</p><ul>{interleaved.map(stop => <li key={stop.id}>NF {stop.invoice} · {stop.customer} · Empresa {stop.companyId}</li>)}</ul><div className="flex flex-wrap gap-2"><button type="button" className={primaryClass} onClick={() => { const next = interleaved.reduce((current, stop) => changeTrainingSeparation(data, current, stop.id, true), draft); change(next); onSave(next); }}>Confirmar separação e salvar</button><button type="button" className={buttonClass} onClick={() => setConfirmSplit(false)}>Voltar à lista</button></div></section> : null}
    </fieldset>
      <footer className="sticky bottom-[calc(var(--mobile-bottom-nav-height)+env(safe-area-inset-bottom)+12px)] min-[769px]:bottom-0 z-10 rounded-xl border border-border bg-card p-3 shadow-soft">
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className={primaryClass} onClick={save}>{busy ? 'Aguarde…' : data.example ? 'Salvar alterações' : 'Salvar exemplo'}</button></div>
        <p className="mt-2 text-xs text-muted">Rascunho neste navegador · Viagem original preservada.</p>
      </footer>
  </div>;
}
