// Regras do editor web; a implementação anterior do APK fica como referência histórica.
import type { ExclusionReason, TrainingPayload, TrainingTrip, TrainingStop } from './api';
export type TrainingDraft = {
  routeName: string; note: string; separatedStopIds: string[]; order: string[]; invoiceOrder?: string[];
  exclusions: Record<string, ExclusionReason>; expectedVersion: number; sourceRevision: string;
  request: { fingerprint: string; clientEventId: string } | null;
};
function planVisits(stops: TrainingStop[]) {
  const groups = new Map<string, TrainingStop[]>();
  for (const stop of stops) groups.set(stop.key, [...(groups.get(stop.key) || []), stop]);
  return Array.from(groups.values());
}
function separatePlanStops(stops: TrainingStop[], separatedIds: string[]): TrainingStop[] {
  return stops.map(stop => ({ ...stop, baseKey: stop.baseKey || stop.key, separateDelivery: separatedIds.includes(stop.id), key: separatedIds.includes(stop.id) ? `separate:${Number(stop.id)}` : stop.baseKey || stop.key }));
}
export function initialDraft(data: TrainingTrip): TrainingDraft {
  const saved = data.example;
  const separatedStopIds = saved?.snapshot.separatedStopIds.map(String) || data.stops.filter(stop => stop.separateDelivery).map(stop => stop.id);
  const stops = separatePlanStops(data.stops, separatedStopIds);
  const keys = planVisits(stops).map(group => group[0].key);
  const savedKeys = saved ? saved.snapshot.stopIds.map(id => stops.find(stop => stop.id === String(id))?.key).filter((key): key is string => Boolean(key)) : [];
  return {
    separatedStopIds, routeName: saved?.routeName || '', note: saved?.snapshot.note || '',
    order: Array.from(new Set([...savedKeys, ...keys])),
    ...(saved ? { invoiceOrder: Array.from(new Set([...saved.snapshot.stopIds.map(String), ...stops.map(stop => stop.id)])) } : {}),
    exclusions: Object.fromEntries((saved?.snapshot.exclusions || []).filter(item => data.stops.some(stop => stop.id === String(item.stopId))).map(item => [String(item.stopId), item.reason])),
    expectedVersion: saved?.version || 0, sourceRevision: data.sourceRevision, request: null,
  };
}
export function activeGroups(data: TrainingTrip, draft: TrainingDraft) {
  const groups = planVisits(separatePlanStops(data.stops, draft.separatedStopIds));
  return draft.order.map(key => (groups.find(group => group[0].key === key) || []).filter(stop => !draft.exclusions[stop.id])).filter(group => group.length > 0);
}
export function moveToNumber(draft: TrainingDraft, activeKeys: string[], key: string, text: string): TrainingDraft {
  const position = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(position) || position < 1 || position > activeKeys.length || !activeKeys.includes(key)) throw new Error(`Digite uma posição de 1 a ${activeKeys.length}.`);
  const next = activeKeys.filter(value => value !== key);
  next.splice(position - 1, 0, key);
  return { ...draft, order: [...next, ...draft.order.filter(value => !activeKeys.includes(value))], request: null };
}
export function excludeNotes(draft: TrainingDraft, ids: string[], reason: ExclusionReason | null): TrainingDraft {
  const exclusions = { ...draft.exclusions };
  ids.forEach(id => { if (reason) exclusions[id] = reason; else delete exclusions[id]; });
  return { ...draft, exclusions, request: null };
}
export function payloadFor(data: TrainingTrip, draft: TrainingDraft, createId: () => string): { payload: TrainingPayload; draft: TrainingDraft } {
  if (interleavedInvoices(data, draft).length) throw new Error('Confira as NFs do mesmo cliente que ficaram em posições separadas antes de salvar.');
  const body = {
    expectedVersion: draft.expectedVersion, sourceRevision: draft.sourceRevision,
    separatedStopIds: draft.separatedStopIds.map(Number), routeName: draft.routeName.trim(), note: draft.note.trim(),
    stopIds: activeInvoices(data, draft).map(stop => Number(stop.id)),
    exclusions: Object.entries(draft.exclusions).map(([id, reason]) => ({ stopId: Number(id), reason })),
  };
  const fingerprint = JSON.stringify(body);
  const clientEventId = draft.request?.fingerprint === fingerprint ? draft.request.clientEventId : createId();
  return { payload: { ...body, clientEventId }, draft: { ...draft, request: { fingerprint, clientEventId } } };
}

/** The photo numbers invoices, not visits. Older local drafts still use visit keys. */
export function activeInvoices(data: TrainingTrip, draft: TrainingDraft) {
  const fallback = activeGroups(data, draft).flat();
  const byId = new Map(fallback.map(stop => [stop.id, stop]));
  return Array.from(new Set([...(draft.invoiceOrder || []), ...fallback.map(stop => stop.id)]))
    .flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
}

export function orderInvoices(data: TrainingTrip, draft: TrainingDraft, ids: string[]): TrainingDraft {
  const active = activeInvoices(data, draft);
  if (ids.length !== active.length || new Set(ids).size !== active.length || ids.some(id => !active.some(stop => stop.id === id))) throw new Error('A lista mudou. Confira as NFs antes de organizar.');
  return { ...draft, invoiceOrder: [...ids, ...(draft.invoiceOrder || []).filter(id => !ids.includes(id))], request: null };
}

export function moveInvoice(data: TrainingTrip, draft: TrainingDraft, id: string, text: string) {
  const ids = activeInvoices(data, draft).map(stop => stop.id);
  const position = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(position) || position < 1 || position > ids.length || !ids.includes(id)) throw new Error(`Digite uma posição de 1 a ${ids.length}.`);
  const next = ids.filter(value => value !== id);
  next.splice(position - 1, 0, id);
  return orderInvoices(data, draft, next);
}

/** Later blocks of an existing visit must be explicitly separated before saving. */
export function interleavedInvoices(data: TrainingTrip, draft: TrainingDraft) {
  const seen = new Set<string>();
  let previous = '';
  let repeated = false;
  return activeInvoices(data, draft).filter(stop => {
    if (stop.key !== previous) {
      repeated = seen.has(stop.key);
      seen.add(stop.key); previous = stop.key;
    }
    return repeated;
  });
}

const invoiceDigits = (value: string) => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
export function previewInvoiceSequence(data: TrainingTrip, draft: TrainingDraft, text: string) {
  // Accept numeric dictation, not guesses about spoken number words or punctuation inside an NF.
  const cleaned = text.replace(/\b(?:nfs?|nota|notas|fiscal|fiscais|vírgula|virgula|e)\b/gi, ' ').trim();
  if (!cleaned || /[^\d\s,;\n]/.test(cleaned)) throw new Error('Informe apenas números, separados por espaço, vírgula ou uma NF por linha. Confira os números transcritos pelo teclado.');
  const tokens = cleaned.split(/[\s,;]+/).filter(Boolean);
  if (!tokens.length) throw new Error('Informe pelo menos uma NF para conferir a sequência.');
  const active = activeInvoices(data, draft);
  const chosen: string[] = [];
  for (const token of tokens) {
    const number = invoiceDigits(token);
    const exact = active.filter(stop => invoiceDigits(stop.invoice) === number);
    const matches = exact.length ? exact : active.filter(stop => stop.invoice.replace(/\D/g, '').endsWith(token));
    if (!matches.length) throw new Error(`NF ou final ${token} não encontrado entre as notas incluídas. Confira também “Fora do exemplo”.`);
    if (matches.length > 1) throw new Error(`O número ${token} corresponde a mais de uma NF: ${matches.map(stop => `${stop.invoice} (empresa ${stop.companyId})`).join(', ')}. Use o número completo; se ainda houver duplicidade, mova essas notas pela lista.`);
    if (chosen.includes(matches[0].id)) throw new Error(`A NF ${matches[0].invoice} foi informada mais de uma vez. Confira a sequência.`);
    chosen.push(matches[0].id);
  }
  const remainder = active.filter(stop => !chosen.includes(stop.id)).map(stop => stop.id);
  const next = orderInvoices(data, draft, [...chosen, ...remainder]);
  return { draft: next, entered: chosen.length, remaining: remainder.length };
}

export function changeTrainingSeparation(data: TrainingTrip, draft: TrainingDraft, id: string, separate: boolean): TrainingDraft {
  const current = separatePlanStops(data.stops, draft.separatedStopIds);
  const allIds = draft.order.flatMap(key => current.filter(stop => stop.key === key).map(stop => stop.id));
  const separatedStopIds = separate ? Array.from(new Set([...draft.separatedStopIds, id])) : draft.separatedStopIds.filter(value => value !== id);
  const next = separatePlanStops(data.stops, separatedStopIds);
  const result = { ...draft, separatedStopIds, order: Array.from(new Set(allIds.map(stopId => next.find(stop => stop.id === stopId)!.key))), request: null };
  if (!separate && draft.invoiceOrder) {
    const byId = new Map(next.map(stop => [stop.id, stop]));
    const ordered = Array.from(new Set([...draft.invoiceOrder, ...allIds])).flatMap(stopId => byId.has(stopId) ? [byId.get(stopId)!] : []);
    const joinedKey = byId.get(id)?.key;
    const family = ordered.filter(stop => stop.key === joinedKey);
    let inserted = false;
    result.invoiceOrder = ordered.flatMap(stop => {
      if (stop.key !== joinedKey) return [stop.id];
      if (inserted) return [];
      inserted = true;
      return family.map(member => member.id);
    });
  }
  return result;
}
