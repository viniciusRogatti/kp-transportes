import type { TrainingDraft } from './draft';
import type { TrainingTrip } from './api';

export function draftKey(data: TrainingTrip) {
  const login = localStorage.getItem('user_login');
  const company = localStorage.getItem('company_id');
  if (!login || !company) throw new Error('Entre novamente no sistema para identificar o autor do rascunho.');
  return `astro-training-web-v1:${encodeURIComponent(company)}:${encodeURIComponent(login)}:${data.trip.companyId}:${data.trip.id}`;
}
export function readDraft(key: string): TrainingDraft | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const strings = (items: unknown): items is string[] => Array.isArray(items) && items.every(item => typeof item === 'string');
    if (!value || typeof value.routeName !== 'string' || typeof value.note !== 'string'
      || !strings(value.order) || !strings(value.separatedStopIds)
      || (value.invoiceOrder !== undefined && !strings(value.invoiceOrder))
      || !value.exclusions || typeof value.exclusions !== 'object' || Array.isArray(value.exclusions)
      || !Object.entries(value.exclusions).every(([id, reason]) => /^\d+$/.test(id) && ['not_taken', 'photo_unknown'].includes(String(reason)))
      || !Number.isSafeInteger(value.expectedVersion) || value.expectedVersion < 0 || typeof value.sourceRevision !== 'string'
      || (value.request !== null && (!value.request || typeof value.request.fingerprint !== 'string' || typeof value.request.clientEventId !== 'string'))) throw new Error();
    return value;
  } catch { throw new Error('O rascunho deste navegador não pôde ser lido. Ele foi preservado. Use “Reabrir da base” para substituí-lo após conferir.'); }
}
export function writeDraft(key: string, draft: TrainingDraft) {
  try { localStorage.setItem(key, JSON.stringify(draft)); }
  catch { throw new Error('Não foi possível guardar o rascunho no navegador. Libere espaço e tente novamente antes de sair.'); }
}
