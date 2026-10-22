export type CustomerLocationChange = {
  locationId: string;
  label: string;
  kind: 'sole' | 'correction' | 'secondary' | 'confirmed';
  changedAt: string | null;
  driverId: number | null;
  driverName: string | null;
};
export function locationChangeLabel(change: CustomerLocationChange) {
  const action = change.kind === 'sole' ? 'Único local corrigido' : change.kind === 'correction' ? 'Ponto de entrega corrigido' : change.kind === 'secondary' ? 'Local secundário informado' : 'Local de entrega informado';
  const author = change.driverName || (change.driverId ? `motorista #${change.driverId}` : 'motorista');
  const time = change.changedAt ? new Date(change.changedAt) : null;
  return `${action} por ${author}${time && Number.isFinite(time.getTime()) ? ` · ${time.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}`;
}
