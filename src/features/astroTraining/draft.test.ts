import { readDraft } from './storage';
import type { TrainingDraft } from './draft';
import { changeTrainingSeparation, activeGroups, activeInvoices, excludeNotes, initialDraft, interleavedInvoices, moveInvoice, moveToNumber, orderInvoices, payloadFor, previewInvoiceSequence } from './draft';
import type { TrainingTrip } from './api';
const restore = (draft: TrainingDraft) => { localStorage.setItem('parity-test', JSON.stringify(draft)); return readDraft('parity-test')!; };
const data: TrainingTrip = {
  trip: { id: 128, companyId: 1, driverId: 3, driverName: 'Teste', operationDate: '2026-10-09' }, sourceRevision: 'revision-1', example: null,
  stops: Array.from({ length: 10 }, (_, index) => ({ id: String(index + 1), key: index === 9 ? '1' : String(index + 1), customer: 'Mesmo nome', address: `Rua ${index + 1}`, invoice: `000${index + 1}`, companyId: 1, weightKg: null })),
};
test('mover 9 para 2 insere e desloca sem trocar duas posições, mantendo NFs agrupadas', () => {
  const initial = initialDraft(data);
  const next = moveToNumber(initial, initial.order, '9', '2');
  expect(next.order).toEqual(['1', '9', '2', '3', '4', '5', '6', '7', '8']);
  expect(payloadFor(data, next, () => 'request').payload.stopIds).toEqual([1, 10, 9, 2, 3, 4, 5, 6, 7, 8]);
  expect(initial.order[8]).toBe('9');
});
test('excluir só uma NF preserva as outras da parada; restauração não perde nenhuma nota', () => {
  const initial = initialDraft(data);
  const excluded = excludeNotes(initial, ['1'], 'not_taken');
  expect(activeGroups(data, excluded)[0].map(stop => stop.id)).toEqual(['10']);
  expect(payloadFor(data, excluded, () => 'request').payload.exclusions).toEqual([{ stopId: 1, reason: 'not_taken' }]);
  expect(payloadFor(data, excludeNotes(excluded, ['1'], null), () => 'request').payload.stopIds).toContain(1);
});
test('reenvio após timeout usa mesmo ID; conteúdo diferente recebe outra operação', () => {
  const first = payloadFor(data, initialDraft(data), () => 'request-1');
  expect(payloadFor(data, first.draft, () => 'request-2').payload.clientEventId).toBe('request-1');
  expect(payloadFor(data, { ...first.draft, routeName: 'Outro nome' }, () => 'request-2').payload.clientEventId).toBe('request-2');
});
test.each(['0', '10', '-1', '2.5', 'abc', ''])('recusa posição inválida %s', value => {
  const initial = initialDraft(data);
  expect(() => moveToNumber(initial, initial.order, '9', value)).toThrow('Digite uma posição');
});
test('reabre o exemplo salvo, adiciona nota nova e preserva exclusão por NF', () => {
  const saved: TrainingTrip = { ...data, example: { id: 1, tripId: 128, companyId: 1, driverId: 3, driverName: 'Teste', operationDate: '2026-10-09', routeName: 'Rio Claro', version: 2, updatedAt: '2026-10-24', includedCount: 2, excludedCount: 1, sourceChanged: true, snapshot: { stopIds: [3, 1], separatedStopIds: [], exclusions: [{ stopId: 2, reason: 'photo_unknown' }], note: 'Foto' } } };
  const next = initialDraft(saved);
  expect(next.order.slice(0, 2)).toEqual(['3', '1']);
  expect(next.order).toContain('9'); expect(next.exclusions['2']).toBe('photo_unknown'); expect(next.expectedVersion).toBe(2);
});

test('separa NF histórica, move independente e restaura o agrupamento sem perder notas', () => {
  const split = changeTrainingSeparation(data, initialDraft(data), '10', true);
  expect(activeGroups(data, split)).toHaveLength(10);
  const moved = moveToNumber(split, split.order, 'separate:10', '7');
  const payload = payloadFor(data, moved, () => 'split').payload;
  expect(payload.stopIds[6]).toBe(10); expect(payload.separatedStopIds).toEqual([10]);
  const joined = changeTrainingSeparation(data, moved, '10', false);
  expect(activeGroups(data, joined)).toHaveLength(9);
  expect(payloadFor(data, joined, () => 'join').payload.stopIds.slice(0, 2)).toEqual([1, 10]);
});

const photo: TrainingTrip = { ...data, stops: Array.from({ length: 30 }, (_, index) => ({ ...data.stops[0], id: String(index + 1), key: `client-${Math.floor(index / 2)}`, invoice: String(10001 + index) })) };
test('foto de 30 NFs mantém 30 posições e 15 paradas; insere a NF 29 na posição 2', () => {
  const initial = initialDraft(photo);
  const next = moveInvoice(photo, initial, '29', '2');
  expect(activeInvoices(photo, next).map(stop => stop.id).slice(0, 5)).toEqual(['1', '29', '2', '3', '4']);
  expect(activeGroups(photo, next)).toHaveLength(15);
  expect(activeInvoices(photo, next)).toHaveLength(30);
  expect(activeInvoices(photo, initial)[28].id).toBe('29');
});
test('sequência aceita final único, NF completa e ditado numérico; prévia preserva as não informadas', () => {
  const preview = previewInvoiceSequence(photo, initialDraft(photo), 'NF 030, 10002 e 001');
  expect(preview.entered).toBe(3); expect(preview.remaining).toBe(27);
  expect(activeInvoices(photo, preview.draft).slice(0, 5).map(stop => stop.id)).toEqual(['30', '2', '1', '3', '4']);
});
test.each(['2 10002', '99999', '1', 'dez vinte', '10001.10002', '', ', ;'])('recusa sequência ambígua, repetida, desconhecida ou não numérica: %s', text => {
  expect(() => previewInvoiceSequence(photo, initialDraft(photo), text)).toThrow();
});
test('NF duplicada entre empresas não é escolhida arbitrariamente', () => {
  const duplicate = { ...photo, stops: [photo.stops[0], { ...photo.stops[0], id: '200', key: 'company-2', companyId: 2 }] };
  expect(() => previewInvoiceSequence(duplicate, initialDraft(duplicate), '10001')).toThrow('empresa 2');
});
test('NF excluída não é reinserida por ditado; restauração preserva a sequência', () => {
  const initial = orderInvoices(photo, initialDraft(photo), photo.stops.map(stop => stop.id).reverse());
  const excluded = excludeNotes(initial, ['30'], 'not_taken');
  expect(() => previewInvoiceSequence(photo, excluded, '10030')).toThrow('Fora do exemplo');
  expect(activeInvoices(photo, excludeNotes(excluded, ['30'], null))[0].id).toBe('30');
});
test('intercalar clientes exige confirmação; após separar, payload e reabertura preservam a ordem por NF', () => {
  const next = moveInvoice(photo, initialDraft(photo), '29', '2');
  expect(interleavedInvoices(photo, next).map(stop => stop.id)).toEqual(['2', '30']);
  expect(() => payloadFor(photo, next, () => 'event')).toThrow('posições separadas');
  const confirmed = interleavedInvoices(photo, next).reduce((draft, stop) => changeTrainingSeparation(photo, draft, stop.id, true), next);
  const { payload } = payloadFor(photo, confirmed, () => 'event');
  expect(payload.stopIds.slice(0, 4)).toEqual([1, 29, 2, 3]);
  expect(payload.separatedStopIds).toEqual([2, 30]);
  expect(payload.stopIds).toHaveLength(30);
  const restored = restore(confirmed);
  expect(payloadFor(photo, restored, () => 'event').payload.stopIds).toEqual(payload.stopIds);
  const joined = changeTrainingSeparation(photo, restored, '2', false);
  expect(activeInvoices(photo, joined).slice(0, 3).map(stop => stop.id)).toEqual(['1', '2', '29']);
});
test('NFs vizinhas do mesmo cliente permanecem agrupadas, mesmo invertendo sua ordem', () => {
  const next = moveInvoice(photo, initialDraft(photo), '2', '1');
  expect(interleavedInvoices(photo, next)).toEqual([]);
  expect(payloadFor(photo, next, () => 'event').payload.stopIds.slice(0, 3)).toEqual([2, 1, 3]);
  expect(payloadFor(photo, next, () => 'event').payload.separatedStopIds).toEqual([]);
});
test('migra rascunho antigo por parada sem perder exclusões nem separar todas as NFs', () => {
  const old = restore({ ...initialDraft(photo), invoiceOrder: undefined });
  expect(activeInvoices(photo, old)).toHaveLength(30);
  expect(payloadFor(photo, old, () => 'event').payload.separatedStopIds).toEqual([]);
});
test('reagrupar uma família não reorganiza outras famílias que ainda serão conferidas', () => {
  const small = { ...photo, stops: photo.stops.slice(0, 6) };
  const split = changeTrainingSeparation(small, initialDraft(small), '2', true);
  const ordered = orderInvoices(small, split, ['1', '3', '2', '5', '4', '6']);
  const joined = changeTrainingSeparation(small, ordered, '2', false);
  expect(activeInvoices(small, joined).map(stop => stop.id)).toEqual(['1', '2', '3', '5', '4', '6']);
  expect(interleavedInvoices(small, joined).map(stop => stop.id)).toEqual(['4', '6']);
});
