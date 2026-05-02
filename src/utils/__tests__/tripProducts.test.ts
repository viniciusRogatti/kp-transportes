import { collectTripProductsByNote, groupTripProductsByCodeAndUnit } from '../tripProducts';
import { IDanfe, ITripNote } from '../../types/types';

describe('tripProducts', () => {
  it('usa os produtos da danfe quando disponiveis e faz fallback para os produtos da rota nas notas restantes', () => {
    const tripNotes: ITripNote[] = [
      {
        invoice_number: '100',
        status: 'pending',
        order: 1,
        city: 'A',
        gross_weight: '10',
        products: [
          {
            code: 'P1',
            description: 'Produto 1',
            type: 'CX',
            quantity: 2,
          },
        ],
      },
      {
        invoice_number: '200',
        status: 'pending',
        order: 2,
        city: 'B',
        gross_weight: '5',
        products: [
          {
            code: 'P2',
            description: 'Produto 2',
            type: 'UN',
            quantity: 3,
          },
        ],
      },
    ];

    const danfes: IDanfe[] = [
      {
        customer_id: '1',
        invoice_number: '100',
        barcode: '100',
        invoice_date: '2026-05-02',
        departure_time: '08:00',
        total_quantity: 1,
        gross_weight: '10',
        net_weight: '9',
        total_value: '100',
        created_at: '2026-05-02T08:00:00.000Z',
        updated_at: '2026-05-02T08:00:00.000Z',
        Customer: {
          name_or_legal_entity: 'Cliente A',
          phone: null,
          address: null,
          city: 'A',
          cnpj_or_cpf: '1',
        },
        DanfeProducts: [
          {
            quantity: 2,
            price: '10',
            total_price: '20',
            type: 'CX',
            Product: {
              code: 'P1',
              description: 'Produto 1',
              price: '10',
              type: 'CX',
            },
          },
        ],
      },
    ] as IDanfe[];

    const collected = collectTripProductsByNote(tripNotes, danfes);
    const grouped = groupTripProductsByCodeAndUnit(collected);

    expect(grouped).toEqual([
      expect.objectContaining({
        quantity: 2,
        code: 'P1',
        description: 'Produto 1',
        type: 'CX',
      }),
      expect.objectContaining({
        quantity: 3,
        code: 'P2',
        description: 'Produto 2',
        type: 'UN',
      }),
    ]);
  });
});
