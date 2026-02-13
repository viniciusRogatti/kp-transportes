import { AlertTriangle, ArrowRightCircle, CheckCircle2, Route, Siren, XCircle } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { ActionQueueItem } from '../../types/controlTower';

interface ActionQueueProps {
  rows: ActionQueueItem[];
  loading?: boolean;
  canManageStatus?: boolean;
  onTogglePriority: (id: string, pickupPriority: boolean) => void;
  onCancelPickup: (id: string) => void;
  onMarkInRoute: (id: string) => void;
  onMarkCollected: (id: string) => void;
  onOpen: (id: string) => void;
}

function priorityBadge(priority: ActionQueueItem['priority']) {
  if (priority === 'critical') return 'bg-rose-900/50 text-rose-300 border border-rose-500/50';
  if (priority === 'high') return 'bg-amber-900/40 text-amber-300 border border-amber-500/40';
  return 'bg-sky-900/35 text-sky-300 border border-sky-500/40';
}

function statusBadge(status: ActionQueueItem['status']) {
  const map: Record<ActionQueueItem['status'], string> = {
    PENDENTE: 'bg-rose-950/60 text-rose-300',
    SOLICITADA: 'bg-amber-950/60 text-amber-300',
    EM_ROTA: 'bg-sky-950/60 text-sky-300',
    COLETADA: 'bg-emerald-950/60 text-emerald-300',
    CANCELADA: 'bg-slate-800 text-slate-300',
  };
  return map[status];
}

function ActionQueue({ rows, loading, canManageStatus = false, onTogglePriority, onCancelPickup, onMarkInRoute, onMarkCollected, onOpen }: ActionQueueProps) {
  return (
    <Card className="border-slate-800 bg-[#101b2b] text-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fila de ação</h3>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{rows.length} itens</span>
      </div>

      {loading ? <p className="text-sm text-slate-400">Carregando fila...</p> : null}

      <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
        {rows.map((item) => (
          <div
            key={item.id}
            className={`rounded-md border p-3 ${item.pickupPriority ? 'border-rose-500/70 bg-rose-950/20 shadow-[0_0_0_1px_rgba(244,63,94,0.25)]' : 'border-slate-700 bg-slate-900/60'}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-[11px] uppercase ${priorityBadge(item.priority)}`}>{item.priority}</span>
              <span className={`rounded-full px-2 py-1 text-[11px] ${statusBadge(item.status)}`}>{item.status}</span>
              {item.pickupPriority ? (
                <span className="rounded-full border border-rose-500/70 bg-rose-900/40 px-2 py-1 text-[11px] text-rose-200">Prioridade manual</span>
              ) : null}
              <span className="text-xs text-slate-400">Idade: {item.ageHours}h</span>
            </div>
            <p className="text-sm text-slate-200">{item.issue}</p>
            <p className="mt-1 text-xs text-slate-400">NF {item.invoiceNumber} | {item.customer} | {item.city} | {item.route}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                tone="secondary"
                className={`h-8 text-xs text-slate-100 ${item.pickupPriority ? 'bg-rose-900/60 hover:bg-rose-800/60' : 'bg-slate-800'}`}
                onClick={() => onTogglePriority(item.id, !item.pickupPriority)}
              >
                <Siren className="mr-1 h-3.5 w-3.5" /> {item.pickupPriority ? 'Remover prioridade' : 'Priorizar coleta'}
              </Button>
              {canManageStatus ? (
                <Button tone="secondary" className="h-8 bg-slate-800 text-xs text-slate-100" onClick={() => onMarkInRoute(item.id)}>
                  <Route className="mr-1 h-3.5 w-3.5" /> Marcar em rota
                </Button>
              ) : null}
              {canManageStatus ? (
                <Button tone="secondary" className="h-8 bg-slate-800 text-xs text-slate-100" onClick={() => onMarkCollected(item.id)}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Marcar coletada
                </Button>
              ) : null}
              {item.status !== 'COLETADA' && item.status !== 'CANCELADA' ? (
                <Button tone="secondary" className="h-8 bg-rose-900/50 text-xs text-rose-100 hover:bg-rose-800/60" onClick={() => onCancelPickup(item.id)}>
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Cancelar coleta
                </Button>
              ) : null}
              <Button tone="outline" className="h-8 border-slate-600 bg-transparent text-xs text-slate-200" onClick={() => onOpen(item.id)}>
                <ArrowRightCircle className="mr-1 h-3.5 w-3.5" /> Abrir detalhes
              </Button>
            </div>
          </div>
        ))}
        {!rows.length && !loading ? (
          <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-300">
            <AlertTriangle className="h-4 w-4" /> Nenhum item pendente na fila.
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default ActionQueue;
