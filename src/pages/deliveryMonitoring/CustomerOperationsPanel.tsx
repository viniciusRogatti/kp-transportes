import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../data';

type Profile = {
  policy: { alertAfterMinutes: number; source: string };
  canConfigure: boolean;
  learning: { samples: number; meanServiceMinutes: number | null; windowDays: number; truncated: boolean; locations: { visitKey: string; samples: number; meanServiceMinutes: number | null; suggestedAlertMinutes: number | null }[] };
};
export function CustomerOperationsPanel({ companyId, customerId }: { companyId: number; customerId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [minutes, setMinutes] = useState('20');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const url = `${API_URL}/api/delivery-monitoring/customers/${companyId}/${encodeURIComponent(customerId)}/operations`;
  async function load() {
    setBusy(true); setError('');
    try { const { data } = await axios.get<Profile>(url); setProfile(data); setMinutes(String(data.policy.alertAfterMinutes)); }
    catch { setError('Não foi possível consultar os tempos deste cliente. Tente novamente.'); }
    finally { setBusy(false); }
  }
  async function save(value: number) {
    if (!Number.isInteger(value) || value < 5 || value > 480) { setError('Informe de 5 a 480 minutos inteiros.'); return; }
    setBusy(true); setError(''); setNotice('');
    try { const { data } = await axios.put<{ policy: Profile['policy'] }>(url, { alertAfterMinutes: value }); setProfile(current => current ? { ...current, policy: data.policy } : null); setMinutes(String(value)); setNotice('Tempo salvo para este cliente.'); }
    catch { setError('Não foi possível salvar o tempo. A configuração anterior foi preservada.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Tempo de atendimento do cliente" className="mt-3 border-t border-border pt-3 text-xs">
    {!profile ? <button type="button" className="rounded-lg border border-border bg-card px-3 py-2 text-text" disabled={busy} onClick={load}>{busy ? 'Consultando tempos…' : 'Tempos e alertas deste cliente'}</button> : <div className="space-y-3">
      <p className="font-semibold text-text">Avisar após {profile.policy.alertAfterMinutes} minutos no cliente · {profile.policy.source === 'team' ? 'configurado pela equipe' : 'padrão inicial'}</p>
      <p className="text-muted">{profile.learning.meanServiceMinutes === null ? 'Ainda não há atendimentos completos medidos.' : `Média: ${profile.learning.meanServiceMinutes.toLocaleString('pt-BR')} min · ${profile.learning.samples} atendimentos.`} Histórico dos últimos {profile.learning.windowDays} dias, reunindo os motoristas. O aprendizado não altera o limite automaticamente.</p>
      {profile.learning.truncated ? <p role="status">Amostra limitada às 1.000 viagens mais recentes.</p> : null}
      {profile.canConfigure ? <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void save(Number(minutes)); }}>
        <label className="grid gap-1 text-text">Limite de atendimento (minutos)<input type="number" min={5} max={480} step={1} value={minutes} disabled={busy} onChange={event => setMinutes(event.target.value)} className="w-32 rounded-lg border border-border bg-card p-2 text-text" /></label>
        <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-white">Salvar limite</button>
        <button type="button" disabled={busy} onClick={() => setMinutes('60')} className="rounded-lg border border-border px-3 py-2 text-text">Preencher 60 min · mercado</button>
      </form> : null}
      {profile.learning.locations.filter(item => item.suggestedAlertMinutes !== null).map(item => <p key={item.visitKey} className="text-muted">Sugestão observada: {item.suggestedAlertMinutes} min ({item.samples} atendimentos). {profile.canConfigure ? <button type="button" disabled={busy} className="text-blue-600 underline" onClick={() => setMinutes(String(item.suggestedAlertMinutes))}>Usar no formulário</button> : null}</p>)}
      {!profile.learning.locations.some(item => item.suggestedAlertMinutes !== null) ? <p className="text-muted">Sugestão disponível após pelo menos 5 atendimentos distribuídos por 14 dias. Continue coletando os tempos.</p> : null}
    </div>}
    {error ? <p role="alert" className="mt-2 text-red-600">{error}</p> : null}
    {notice ? <p role="status" className="mt-2 text-text">{notice}</p> : null}
  </section>;
}
