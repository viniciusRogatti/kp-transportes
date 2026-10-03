import { IOccurrence } from '../../types/types';
import { RetainedReminder } from '../retainedReminders';
import { linkRetainedOccurrences } from '../retainedOccurrenceReminders';

const reminder: RetainedReminder = { companyId: 1, matchType: 'customer', retainedInvoiceNumber: '1886686', retainedCustomerName: 'Cliente exemplo', routeInvoiceNumbers: ['2000000'], city: 'Campinas', ageDays: 3 };
const occurrence = (changes: Partial<IOccurrence> = {}): IOccurrence => ({
  id: 12, company_id: 1, invoice_number: '1886686', reason: 'faltou_na_carga', status: 'pending', workflow_status: 'pending_transportadora',
  created_at: '2026-10-03', resolved_at: null, description: 'Falta', product_id: null, product_description: null, quantity: null, age_business_days: 0,
  items: [{ product_id: 'P1', product_description: 'Produto exemplo', product_type: 'KG', quantity: 2.5 }], ...changes,
});

test('liga a NF retida, mesmo sem ela na rota e com ocorrência de hoje', () => {
  const [result] = linkRetainedOccurrences([reminder], [occurrence(), occurrence()]);
  expect(result.linkedOccurrences).toHaveLength(1);
  expect(result.linkedOccurrences![0].instruction).toContain('Para retirar o canhoto retido da NF 1886686, levar o produto faltante');
  expect(result.linkedOccurrences![0].itemSummary).toBe('P1 - Produto exemplo: 2,5 KG');
});

test.each([
  { company_id: 2 }, { company_id: undefined }, { invoice_number: '2000000' },
  { status: 'resolved' as const }, { resolved_at: '2026-10-03' }, { workflow_status: 'finalized' as const },
])('não vincula outra NF/empresa ou ocorrência encerrada: %j', changes => {
  expect(linkRetainedOccurrences([reminder], [occurrence(changes)])[0].linkedOccurrences).toEqual([]);
});

test('não presume falta quando a ocorrência trata de avaria', () => {
  const [result] = linkRetainedOccurrences([reminder], [occurrence({ reason: 'produto_avariado' })]);
  expect(result.linkedOccurrences![0].instruction).toContain('Conferir a pendência');
  expect(result.linkedOccurrences![0].instruction).not.toContain('levar o produto faltante');
});

test('usa produtos legados e não inventa quantidade ausente', () => {
  const [result] = linkRetainedOccurrences([reminder], [occurrence({ items: [], product_id: 'LEGADO', quantity: null })]);
  expect(result.linkedOccurrences![0].itemSummary).toBe('LEGADO: quantidade não informada');
  expect(linkRetainedOccurrences([reminder], [occurrence({ items: [] })])[0].linkedOccurrences![0].itemSummary).toContain('Confirmar com a operação');
});

test('preserva lembrete simples quando não existe ocorrência', () => {
  expect(linkRetainedOccurrences([reminder], [])[0]).toEqual({ ...reminder, linkedOccurrences: [] });
});
