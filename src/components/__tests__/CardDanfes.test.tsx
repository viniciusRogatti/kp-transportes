import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import CardDanfes from '../CardDanfes';
import { IDanfe, IInvoiceSearchContext } from '../../types/types';

const buildDanfe = (invoiceNumber: string, status: string): IDanfe => ({
  customer_id: '1',
  invoice_number: invoiceNumber,
  status,
  barcode: `barcode-${invoiceNumber}`,
  load_number: 'CARGA-10',
  representative_name: null,
  invoice_date: '2026-03-23',
  departure_time: '08:00:00',
  total_quantity: 12,
  gross_weight: '120.50',
  net_weight: '118.90',
  total_value: '3500.00',
  created_at: '2026-03-23T10:00:00.000Z',
  updated_at: '2026-03-23T10:00:00.000Z',
  Customer: {
    name_or_legal_entity: 'Cliente Teste',
    phone: '11999999999',
    address: 'Rua A',
    address_number: '100',
    neighborhood: 'Centro',
    city: 'Sao Paulo',
    state: 'SP',
    zip_code: '01000-000',
    cnpj_or_cpf: '12345678000199',
    representative_name: null,
  },
  DanfeProducts: [{
    quantity: 12,
    price: '10.00',
    total_price: '120.00',
    type: 'UN',
    Product: {
      code: 'P1',
      description: 'Produto teste',
      price: '10.00',
      type: 'UN',
    },
  }],
});

const CONTEXT_FIXTURE: Record<string, IInvoiceSearchContext> = {
  '123456': {
    occurrence_count: 1,
    occurrence_pending_count: 1,
    occurrence_resolved_count: 0,
    credit_letter_count: 0,
    credit_letter_pending_count: 0,
    credit_letter_completed_count: 0,
    return_count: 0,
    return_types: [],
    driver_name: 'Joao da Silva',
    latest_occurrence: {
      id: 9,
      description: 'Cliente recusou mercadoria danificada',
      status: 'pending',
      created_at: '2026-03-23T11:30:00.000Z',
      resolved_at: null,
    },
  },
};

describe('CardDanfes', () => {
  it('exibe legenda, motorista, bordas corretas e permite filtrar pela legenda', async () => {
    render(
      <CardDanfes
        danfes={[
          buildDanfe('123456', 'delivered'),
          buildDanfe('654321', 'returned'),
          buildDanfe('999888', 'on_the_way'),
        ]}
        invoiceContextByNf={CONTEXT_FIXTURE}
      />,
    );

    expect(screen.getByTestId('danfe-status-legend')).toBeInTheDocument();
    expect(screen.getByTestId('danfe-card-123456')).toHaveClass('status-border-delivered');
    expect(screen.getByTestId('danfe-card-654321')).toHaveClass('status-border-returned');
    expect(screen.getByTestId('danfe-card-999888')).toHaveClass('status-border-on-the-way');
    expect(screen.getByText('Motorista: Joao da Silva')).toBeInTheDocument();
    expect(screen.getByText('Ocorrencias: 1')).toBeInTheDocument();
    expect(screen.getAllByText('Cliente recusou mercadoria danificada').length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Filtrar por Entregue' }));
    });

    expect(screen.getByText('Filtro ativo: Entregue. Exibindo 1 de 3 NF(s).')).toBeInTheDocument();
    expect(screen.getByTestId('danfe-card-123456')).toBeInTheDocument();
    expect(screen.queryByTestId('danfe-card-654321')).not.toBeInTheDocument();
    expect(screen.queryByTestId('danfe-card-999888')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Limpar filtro de status' }));
    });

    expect(screen.getByTestId('danfe-card-654321')).toBeInTheDocument();
    expect(screen.getByTestId('danfe-card-999888')).toBeInTheDocument();
    expect(screen.queryByText('Filtro ativo: Entregue. Exibindo 1 de 3 NF(s).')).not.toBeInTheDocument();
  });
});
