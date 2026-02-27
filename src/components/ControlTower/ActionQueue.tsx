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
  if (priority === 'critical') return 'bg-rose-100 text-[color:var(--color-danger)] border border-rose-500/50';
  if (priority === 'high') return 'bg-amber-100 text-[color:var(--color-warning)] border border-amber-500/40';
  return 'bg-sky-100 text-sky-300 border border-sky-500/40';
}

function statusBadge(status: ActionQueueItem['status']) {
  const map: Record<ActionQueueItem['status'], string> = {
    PENDENTE: 'bg-rose-100 text-[color:var(--color-danger)]',
    SOLICITADA: 'bg-amber-100 text-[color:var(--color-warning)]',
    EM_ROTA: 'bg-sky-100 text-sky-300',
    COLETADA: 'bg-emerald-100 text-[color:var(--color-success)]',
    CANCELADA: 'bg-surface-2 text-muted',
  };
  return map[status];
}

function ActionQueue({ rows, loading, canManageStatus = false, onTogglePriority, onCancelPickup, onMarkInRoute, onMarkCollected, onOpen }: ActionQueueProps) {
  const collectionRows = rows.filter((item) => item.returnType === 'coleta');

  return (
    <Card className="border-border bg-card text-text">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fila de ação</h3>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">{collectionRows.length} itens</span>
      </div>

      {loading ? <p className="text-sm text-muted">Carregando fila...</p> : null}

      <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
        {collectionRows.map((item) => (
          <div
            key={item.id}
            className={`rounded-md border p-3 ${item.pickupPriority ? 'border-rose-500/70 bg-rose-100 shadow-[0_0_0_1px_rgba(244,63,94,0.25)]' : 'border-border bg-card'}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-[11px] uppercase ${priorityBadge(item.priority)}`}>{item.priority}</span>
              <span className={`rounded-full px-2 py-1 text-[11px] ${statusBadge(item.status)}`}>{item.status}</span>
              {item.pickupPriority ? (
                <span className="rounded-full border border-rose-500/70 bg-rose-100 px-2 py-1 text-[11px] text-[color:var(--color-danger)]">Prioridade manual</span>
              ) : null}
              <span className="text-xs text-muted">Idade: {item.ageHours}h</span>
            </div>
            <p className="text-sm text-text">{item.issue}</p>
            <p className="mt-1 text-xs text-muted">NF {item.invoiceNumber} | {item.customer} | {item.city} | {item.route}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                tone="secondary"
                className={`h-8 text-xs text-text ${item.pickupPriority ? 'bg-rose-100 hover:bg-rose-800/60' : 'bg-surface-2'}`}
                onClick={() => onTogglePriority(item.id, !item.pickupPriority)}
              >
                <Siren className="mr-1 h-3.5 w-3.5" /> {item.pickupPriority ? 'Remover prioridade' : 'Priorizar coleta'}
              </Button>
              {canManageStatus ? (
                <Button tone="secondary" className="h-8 bg-surface-2 text-xs text-text" onClick={() => onMarkInRoute(item.id)}>
                  <Route className="mr-1 h-3.5 w-3.5" /> Marcar em rota
                </Button>
              ) : null}
              {canManageStatus ? (
                <Button tone="secondary" className="h-8 bg-surface-2 text-xs text-text" onClick={() => onMarkCollected(item.id)}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Marcar coletada
                </Button>
              ) : null}
              {item.status !== 'COLETADA' && item.status !== 'CANCELADA' ? (
                <Button tone="secondary" className="h-8 bg-rose-100 text-xs text-[color:var(--color-danger)] hover:bg-rose-800/60" onClick={() => onCancelPickup(item.id)}>
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Cancelar coleta
                </Button>
              ) : null}
              <Button tone="outline" className="h-8 border-border bg-transparent text-xs text-text" onClick={() => onOpen(item.id)}>
                <ArrowRightCircle className="mr-1 h-3.5 w-3.5" /> Abrir detalhes
              </Button>
            </div>
          </div>
        ))}
        {!collectionRows.length && !loading ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-card p-3 text-sm text-muted">
            <AlertTriangle className="h-4 w-4" /> Nenhum item pendente na fila.
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default ActionQueue;
