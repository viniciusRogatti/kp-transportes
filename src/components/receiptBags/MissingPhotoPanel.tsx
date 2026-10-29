import { Camera, RefreshCcw, WifiOff } from 'lucide-react';
import { useState } from 'react';
import type { MissingReceiptPhoto } from '../../utils/receiptPhotoPendencies';
import { formatDateBR, formatDateTimeBR } from '../../utils/dateDisplay';

type Props = {
  items: MissingReceiptPhoto[]; offline: boolean; failed: boolean; loading: boolean;
  syncedAt: string | null; storageError: boolean; disabled: boolean;
  onOpen: (item: MissingReceiptPhoto) => void; onRefresh: () => void;
};

export default function MissingPhotoPanel(props: Props) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const visible = props.items.filter(item => [item.invoice_number, item.customer_name, item.driver?.name,
    item.trip_id, item.company?.name].join(' ').toLocaleLowerCase('pt-BR').includes(term));
  const stale = props.offline || props.failed;
  return (
    <section aria-labelledby="missing-photo-title" className="mt-3 rounded-2xl border-2 semantic-panel-danger p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="missing-photo-title" className="flex flex-wrap items-center gap-2 text-lg font-black"><Camera className="h-5 w-5 shrink-0" />Presentes sem foto
            {props.items.length || props.syncedAt ? <span className="rounded-full semantic-solid-danger px-2.5 py-0.5 text-base">{props.items.length}</span> : null}
          </h2>
          <p className="mt-1 text-sm font-bold">Fotografe e publique no grupo antes de encaminhar os canhotos.</p>
          <p className="mt-1 text-xs">Malotes em aberto de todas as datas. Presença física não substitui a postagem da foto.</p>
        </div>
        <button type="button" onClick={props.onRefresh} disabled={props.loading || props.offline} className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border border-current px-3 py-2 text-xs font-black disabled:opacity-50"><RefreshCcw className={`h-4 w-4 ${props.loading ? 'animate-spin' : ''}`} />Verificar fotos</button>
      </div>
      {stale ? <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-current p-3 text-sm font-bold"><WifiOff className="mt-0.5 h-4 w-4 shrink-0" />{props.offline ? 'Sem conexão.' : 'Não foi possível atualizar as fotos.'} A lista salva continua visível. Aguarde a confirmação do sistema antes de encaminhar os documentos.</p> : null}
      {props.syncedAt ? <p className="mt-2 text-xs">Última verificação: {formatDateTimeBR(props.syncedAt)}.</p> : null}
      {props.storageError ? <p role="alert" className="mt-2 text-sm font-bold">Não foi possível guardar a lista neste navegador. Mantenha esta tela aberta até conferir as fotos.</p> : null}
      {props.items.length ? <>
        <label className="mt-3 block text-xs font-bold">Localizar presente sem foto<input value={search} onChange={event => setSearch(event.target.value)} placeholder="NF, cliente, rota ou motorista" className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /></label>
        <div className="scrollbar-ui mt-2 max-h-72 space-y-2 overflow-y-auto">
          {visible.map(item => <div key={`${item.bag_id}-${item.company_id}-${item.invoice_number}`} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-text sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="font-black">NF {item.invoice_number} · {item.customer_name || 'Cliente não identificado'}</p>
              <p className="mt-1 text-xs text-muted">Rota #{item.trip_id} · {item.driver?.name || 'Motorista não identificado'} · {formatDateBR(item.operation_date)} · {item.company?.name || (item.company_id ? `Empresa #${item.company_id}` : 'Empresa a conferir')}</p>
              <p className="mt-1 text-xs font-black text-[color:var(--semantic-danger-text)]">{item.confirmation_uncertain ? 'Presença a verificar: confirmação sem resposta.' : item.needs_refresh ? 'Pendência salva: reabra a conferência para verificar a foto.' : 'Documento presente · foto ainda não confirmada no grupo'}</p>
            </div>
            <button type="button" disabled={props.disabled || props.offline} onClick={() => props.onOpen(item)} aria-label={`Conferir foto da NF ${item.invoice_number} na rota ${item.trip_id}`} className="min-h-[44px] shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-black text-white disabled:opacity-50">Abrir conferência</button>
          </div>)}
          {!visible.length ? <p className="py-3 text-sm">Nenhum resultado nesta busca. Limpe o filtro para ver todas as pendências.</p> : null}
        </div>
      </> : <p className="mt-3 text-sm font-semibold">{props.loading ? 'Verificando fotos...' : stale || !props.syncedAt ? 'Aguardando uma consulta completa para confirmar as pendências.' : 'Nenhum canhoto presente aguardando foto nesta consulta.'}</p>}
    </section>
  );
}
