import { IDanfe, IReceiptBacklogRow } from '../../types/types';
import { buildRetainedReminders, selectRetainedRowsForRoute } from '../retainedReminders';

const buildDanfe = (overrides: Partial<IDanfe> = {}): IDanfe => ({
  customer_id: 'CUST-1',
  invoice_number: '200001',
  barcode: '200001',
  invoice_date: '2026-05-08',
  departure_time: '08:00:00',
  total_quantity: 1,
  gross_weight: '10',
  net_weight: '10',
  total_value: '100',
  created_at: '2026-05-08T10:00:00.000Z',
  updated_at: '2026-05-08T10:00:00.000Z',
  Customer: {
    name_or_legal_entity: 'Cliente Base',
    phone: null,
    address: 'Rua Base',
    address_number: '10',
    neighborhood: 'Centro',
    city: 'Campinas',
    state: 'SP',
    zip_code: '13000-000',
    cnpj_or_cpf: '00000000000100',
  },
  DanfeProducts: [],
  ...overrides,
});

describe('buildRetainedReminders', () => {
  it('gera alerta simples quando existe entrega do mesmo cliente na rota', () => {
    const routeDanfes: IDanfe[] = [
      buildDanfe({
        customer_id: 'CUST-77',
        invoice_number: '300001',
        Customer: {
          ...buildDanfe().Customer,
          name_or_legal_entity: 'Cliente Alvo',
          city: 'Sumare',
        },
      }),
    ];

    const retainedRows: IReceiptBacklogRow[] = [
      {
        queue_type: 'retained',
        nf_id: '199001',
        invoice_number: '199001',
        customer_id: 'CUST-77',
        customer_name: 'Cliente Alvo',
        city: 'Sumare',
        status: 'PENDING',
      },
    ];

    const reminders = buildRetainedReminders(routeDanfes, retainedRows);

    expect(reminders).toEqual([
      expect.objectContaining({
        matchType: 'customer',
        retainedInvoiceNumber: '199001',
        retainedCustomerName: 'Cliente Alvo',
        routeInvoiceNumbers: ['300001'],
      }),
    ]);
  });

  it('gera alerta com endereco quando apenas a cidade coincide', () => {
    const routeDanfes: IDanfe[] = [
      buildDanfe({
        customer_id: 'CUST-90',
        invoice_number: '300010',
        Customer: {
          ...buildDanfe().Customer,
          name_or_legal_entity: 'Outro Cliente',
          city: 'Campinas',
        },
      }),
    ];

    const retainedRows: IReceiptBacklogRow[] = [
      {
        queue_type: 'retained',
        nf_id: '199010',
        invoice_number: '199010',
        customer_id: 'CUST-91',
        customer_name: 'Cliente Retido',
        city: 'Campinas',
        status: 'PENDING',
      },
    ];

    const retainedDanfesByInvoice = new Map<string, IDanfe>([
      ['199010', buildDanfe({
        customer_id: 'CUST-91',
        invoice_number: '199010',
        Customer: {
          ...buildDanfe().Customer,
          name_or_legal_entity: 'Cliente Retido',
          address: 'Rua das Flores',
          address_number: '45',
          neighborhood: 'Jardim Brasil',
          city: 'Campinas',
          state: 'SP',
        },
      })],
    ]);

    const reminders = buildRetainedReminders(routeDanfes, retainedRows, retainedDanfesByInvoice);

    expect(reminders).toEqual([
      expect.objectContaining({
        matchType: 'city',
        retainedInvoiceNumber: '199010',
        retainedCustomerName: 'Cliente Retido',
        city: 'Campinas',
        addressLine: 'Rua das Flores, 45 • Jardim Brasil • Campinas/SP',
      }),
    ]);
  });

  it('nao usa fallback por cidade quando o cliente ja esta em outra rota do mesmo dia', () => {
    const routeDanfes: IDanfe[] = [
      buildDanfe({
        customer_id: 'CUST-90',
        invoice_number: '300010',
        Customer: {
          ...buildDanfe().Customer,
          name_or_legal_entity: 'Outro Cliente',
          city: 'Campinas',
        },
      }),
    ];

    const retainedRows: IReceiptBacklogRow[] = [
      {
        queue_type: 'retained',
        nf_id: '199010',
        invoice_number: '199010',
        customer_id: 'CUST-91',
        customer_name: 'Cliente Retido',
        city: 'Campinas',
        status: 'PENDING',
      },
    ];

    const selectedRows = selectRetainedRowsForRoute({
      routeDanfes,
      retainedRows,
      sameDayCustomerIds: ['CUST-91'],
    });

    expect(selectedRows).toEqual([]);
  });

  it('mantem o alerta quando a rota atual e a que atende o cliente no dia', () => {
    const routeDanfes: IDanfe[] = [
      buildDanfe({
        customer_id: 'CUST-91',
        invoice_number: '300011',
        Customer: {
          ...buildDanfe().Customer,
          name_or_legal_entity: 'Cliente Retido',
          city: 'Campinas',
        },
      }),
    ];

    const retainedRows: IReceiptBacklogRow[] = [
      {
        queue_type: 'retained',
        nf_id: '199011',
        invoice_number: '199011',
        customer_id: 'CUST-91',
        customer_name: 'Cliente Retido',
        city: 'Campinas',
        status: 'PENDING',
      },
    ];

    const selectedRows = selectRetainedRowsForRoute({
      routeDanfes,
      retainedRows,
      sameDayCustomerIds: ['CUST-91'],
    });

    expect(selectedRows).toEqual(retainedRows);
  });

  it('nao usa fallback por cidade quando o customer_id do mesmo cliente varia so na formatacao', () => {
    const routeDanfes: IDanfe[] = [
      buildDanfe({
        customer_id: '12.345.678/0001-90',
        invoice_number: '300012',
        Customer: {
          ...buildDanfe().Customer,
          name_or_legal_entity: 'Cliente Retido',
          city: 'Campinas',
        },
      }),
    ];

    const retainedRows: IReceiptBacklogRow[] = [
      {
        queue_type: 'retained',
        nf_id: '199012',
        invoice_number: '199012',
        customer_id: '12345678000190',
        customer_name: 'Cliente Retido',
        city: 'Campinas',
        status: 'PENDING',
      },
    ];

    const selectedRows = selectRetainedRowsForRoute({
      routeDanfes,
      retainedRows,
      sameDayCustomerIds: ['12.345.678/0001-90'],
    });

    expect(selectedRows).toEqual(retainedRows);
  });
});
