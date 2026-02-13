import { useEffect, useMemo, useState } from 'react';
import { Clock3, FileText, History, Layers3, X } from 'lucide-react';
import Button from '../ui/Button';
import { ReturnBatch } from '../../types/controlTower';
import { currencyFmt, decimalFmt, formatDateTime, numberFmt } from './format';

type DrawerTab = 'summary' | 'items' | 'history' | 'actions';

interface DetailsDrawerProps {
  row: ReturnBatch | null;
  onClose: () => void;
  canManageStatus?: boolean;
  onRequestPickup: (id: string) => void;
  onCancelPickup: (id: string) => void;
  onMarkInRoute: (id: string) => void;
  onMarkCollected: (id: string) => void;
  onAddObservation: (id: string, note: string) => void;
}

const tabMeta: Array<{ id: DrawerTab; label: string; icon: JSX.Element }> = [
  { id: 'summary', label: 'Resumo', icon: <FileText className="h-4 w-4" /> },
  { id: 'items', label: 'Itens', icon: <Layers3 className="h-4 w-4" /> },
  { id: 'history', label: 'Histórico', icon: <History className="h-4 w-4" /> },
  { id: 'actions', label: 'Ações', icon: <Clock3 className="h-4 w-4" /> },
];

function DetailsDrawer({ row, onClose, canManageStatus = false, onRequestPickup, onCancelPickup, onMarkInRoute, onMarkCollected, onAddObservation }: DetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('summary');
  const [note, setNote] = useState('');

  useEffect(() => {
    setNote('');
  }, [row?.id]);

  const totals = useMemo(() => {
    if (!row) return { quantity: 0, weight: 0, value: 0 };
    return {
      quantity: row.items.reduce((acc, item) => acc + item.quantity, 0),
      weight: row.items.reduce((acc, item) => acc + item.weightKg, 0),
      value: row.items.reduce((acc, item) => acc + item.valueAmount, 0),
    };
  }, [row]);

  if (!row) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/70" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-[520px] overflow-auto border-l border-slate-700 bg-[#0d1625] p-4 text-slate-100 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold">NF {row.invoiceNumber}</h3>
            <p className="text-xs text-slate-400">Lote {row.batchCode} | {row.customer}</p>
          </div>
          <Button tone="secondary" className="h-8 bg-slate-800 text-slate-100" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {tabMeta.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs ${activeTab === tab.id ? 'bg-sky-900/60 text-sky-200' : 'bg-slate-800 text-slate-300'}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'summary' ? (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Status</strong><p>{row.status}</p></div>
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Motivo</strong><p>{row.reason}</p></div>
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Cidade/Rota</strong><p>{row.city} / {row.route}</p></div>
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Idade</strong><p>{row.ageHours} horas</p></div>
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Qtd Itens</strong><p>{numberFmt.format(totals.quantity)}</p></div>
              <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Peso</strong><p>{decimalFmt.format(totals.weight)} kg</p></div>
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-900/60 p-2"><strong>Valor estimado</strong><p>{currencyFmt.format(totals.value)}</p></div>
          </div>
        ) : null}

        {activeTab === 'items' ? (
          <div className="overflow-hidden rounded-md border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300"><tr><th className="px-2 py-1 text-left">Produto</th><th className="text-left">Tipo</th><th className="text-right">Qtd</th><th className="pr-2 text-right">Kg</th></tr></thead>
              <tbody>
                {row.items.map((item, index) => (
                  <tr key={`${item.productId}-${index}`} className="border-t border-slate-800">
                    <td className="px-2 py-1">{item.productDescription}</td>
                    <td>{item.productType}</td>
                    <td className="text-right">{numberFmt.format(item.quantity)}</td>
                    <td className="pr-2 text-right">{decimalFmt.format(item.weightKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {activeTab === 'history' ? (
          <ol className="space-y-2 border-l border-slate-700 pl-3">
            {row.events.map((event, index) => (
              <li key={`${event.at}-${index}`} className="relative rounded-md border border-slate-700 bg-slate-900/60 p-2 text-sm">
                <span className="absolute -left-[14px] top-3 h-2 w-2 rounded-full bg-sky-400" />
                <p className="text-xs text-slate-400">{formatDateTime(event.at)} | {event.actor}</p>
                <p>{event.action}</p>
                {event.note ? <p className="text-xs text-slate-400">{event.note}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}

        {activeTab === 'actions' ? (
          <div className="space-y-2">
            <Button tone="secondary" className="w-full justify-center bg-slate-800 text-slate-100" onClick={() => onRequestPickup(row.id)}>Solicitar coleta</Button>
            {row.status !== 'COLETADA' && row.status !== 'CANCELADA' ? (
              <Button tone="secondary" className="w-full justify-center bg-rose-900/50 text-rose-100 hover:bg-rose-800/60" onClick={() => onCancelPickup(row.id)}>Cancelar coleta</Button>
            ) : null}
            {canManageStatus ? (
              <Button tone="secondary" className="w-full justify-center bg-slate-800 text-slate-100" onClick={() => onMarkInRoute(row.id)}>Marcar em rota</Button>
            ) : null}
            {canManageStatus ? (
              <Button tone="secondary" className="w-full justify-center bg-slate-800 text-slate-100" onClick={() => onMarkCollected(row.id)}>Marcar coletada</Button>
            ) : null}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-[96px] w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
              placeholder="Adicionar observacao operacional"
            />
            <Button
              tone="secondary"
              className="w-full justify-center bg-slate-800 text-slate-100"
              onClick={() => {
                if (!note.trim()) return;
                onAddObservation(row.id, note.trim());
                setNote('');
              }}
            >
              Salvar observacao
            </Button>
          </div>
        ) : null}
      </aside>
    </>
  );
}

export default DetailsDrawer;
