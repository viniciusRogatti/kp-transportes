import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { listAlertHistory } from '../services/alertsService';
import { IAlertHistoryRow } from '../types/types';
import { formatDateTimeBR } from '../utils/dateDisplay';

export default function CentralBotAlerts({ nf, refreshKey, onCount }: { nf: string; refreshKey: number; onCount: (count: number) => void }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<IAlertHistoryRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    listAlertHistory({ status: 'OPEN', source: 'ALERT', search: nf, limit: 500 }).then((data) => {
      if (active) { setRows(data.rows || []); onCount((data.rows || []).length); setError(''); }
    }).catch(() => { if (active) setError('Não foi possível carregar os alertas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [nf, refreshKey, onCount]);
  return <section className="mt-4 rounded-2xl border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Alertas do bot</h3><button type="button" onClick={() => navigate('/alerts')} className="rounded-lg border border-border px-3 py-2 text-sm">Abrir central de alertas</button></div>
    <p className="mt-1 text-sm text-muted">Confira a legenda e o motorista da postagem. Para corrigir, publique uma nova foto no grupo com somente o número da NF.</p>
    {error ? <p role="alert" className="mt-3 semantic-panel-danger rounded-lg border p-3">{error}</p> : loading ? <p className="mt-3 text-sm text-muted">Carregando alertas...</p> : <>
      <p className="mt-3 text-xs text-muted">{rows.length} alerta(s) pendente(s)</p>
      <ul className="mt-3 grid gap-3 lg:grid-cols-2">{rows.map((row) => <li key={row.id} className="rounded-xl border border-border bg-surface p-4"><h4 className="font-bold">{row.title}</h4><p className="mt-2 text-sm text-muted">{row.message}</p><p className="mt-3 text-xs text-muted">{formatDateTimeBR(row.created_at)}</p><button type="button" onClick={() => navigate('/alerts')} className="mt-3 rounded-lg semantic-solid-info px-3 py-2 text-sm">Ver alerta</button></li>)}</ul>
    </>}
  </section>;
}
