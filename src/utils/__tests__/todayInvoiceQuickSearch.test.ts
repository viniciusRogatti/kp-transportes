import { buildTodayInvoiceProductMatches } from '../todayInvoiceQuickSearch';

const danfe = {
  company_id: 1,
  invoice_number: '123',
  status: 'assigned',
  Customer: { name_or_legal_entity: 'Cliente', city: 'Campinas' },
  DanfeProducts: [
    { Product: { code: '4577', description: 'Filé de Tilápia', type: 'CX' }, quantity: 3, type: 'CX' },
    { Product: { code: '9999', description: 'Outro produto', type: 'UN' }, quantity: 1, type: 'UN' },
  ],
} as any;

describe('buildTodayInvoiceProductMatches', () => {
  it('retorna apenas o produto procurado com motorista e placa', () => {
    const rows = buildTodayInvoiceProductMatches([danfe], 'file de tilapia', {
      123: { driverName: 'Jonas', vehiclePlate: 'ABC1D23', tripId: 8 },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      productCode: '4577',
      driverName: 'Jonas',
      vehiclePlate: 'ABC1D23',
      quantity: 3,
    });
  });
});
