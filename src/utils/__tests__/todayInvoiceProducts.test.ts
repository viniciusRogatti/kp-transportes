import { groupTodayInvoiceProducts, formatGroupedProductQuantity } from '../todayInvoiceProducts';
import { IDanfe } from '../../types/types';

function buildDanfe(overrides: Partial<IDanfe> = {}): IDanfe {
  return {
    customer_id: '1',
    invoice_number: '1001',
    barcode: '123456',
    load_number: 'CARGA-1',
    invoice_date: '2026-03-16',
    departure_time: '08:00',
    total_quantity: 0,
    gross_weight: '0',
    net_weight: '0',
    total_value: '0',
    created_at: '2026-03-16T00:00:00.000Z',
    updated_at: '2026-03-16T00:00:00.000Z',
    Customer: {
      name_or_legal_entity: 'Cliente teste',
      phone: null,
      address: null,
      city: 'Campinas',
      cnpj_or_cpf: '00000000000000',
    },
    DanfeProducts: [],
    ...overrides,
  };
}

describe('todayInvoiceProducts', () => {
  it('agrupa produtos e ordena alfabeticamente pela descricao', () => {
    const danfes: IDanfe[] = [
      buildDanfe({
        invoice_number: '1001',
        DanfeProducts: [
          {
            quantity: 2,
            price: '0',
            total_price: '0',
            type: 'UN',
            Product: {
              code: 'B2',
              description: 'Banana',
              price: '0',
              type: 'UN',
            },
          },
          {
            quantity: 1,
            price: '0',
            total_price: '0',
            type: 'UN',
            Product: {
              code: 'A1',
              description: 'Abacaxi',
              price: '0',
              type: 'UN',
            },
          },
        ],
      }),
      buildDanfe({
        invoice_number: '1002',
        DanfeProducts: [
          {
            quantity: 3,
            price: '0',
            total_price: '0',
            type: 'UN',
            Product: {
              code: 'B2',
              description: 'Banana',
              price: '0',
              type: 'UN',
            },
          },
        ],
      }),
    ];

    const groupedProducts = groupTodayInvoiceProducts(danfes);

    expect(groupedProducts).toHaveLength(2);
    expect(groupedProducts[0].Product.description).toBe('Abacaxi');
    expect(groupedProducts[1].Product.description).toBe('Banana');
    expect(groupedProducts[1].quantity).toBe(5);
  });

  it('normaliza quantidade para nao exibir artefatos de float', () => {
    expect(formatGroupedProductQuantity(3)).toBe('3');
    expect(formatGroupedProductQuantity(1.5000000001)).toBe('1.5');
    expect(formatGroupedProductQuantity(2.3456)).toBe('2.346');
  });
});
