import { buildOccurrenceReminders } from '../occurrenceReminders';

describe('buildOccurrenceReminders', () => {
  it('inclui apenas ocorrencia antiga e acionavel do mesmo cliente', () => {
    const reminders = buildOccurrenceReminders([
      { customer_id: '12.345/0001', invoice_number: '300' } as any,
    ], [
      {
        id: 7,
        invoice_number: '100',
        customer_id: '123450001',
        customer_name: 'Cliente A',
        status: 'pending',
        reason: 'faltou_na_carga',
        age_business_days: 3,
        items: [{ product_id: '4577', product_description: 'Tilapia', product_type: 'CX', quantity: 2 }],
      } as any,
      {
        id: 8,
        invoice_number: '101',
        customer_id: 'OUTRO',
        status: 'pending',
        reason: 'faltou_na_carga',
        age_business_days: 5,
      } as any,
    ]);

    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({
      occurrenceId: 7,
      routeInvoiceNumbers: ['300'],
      ageBusinessDays: 3,
    });
    expect(reminders[0].itemSummary).toContain('4577');
  });
});
