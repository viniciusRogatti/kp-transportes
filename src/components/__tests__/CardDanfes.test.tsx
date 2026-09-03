import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import axios from 'axios';
import CardDanfes from '../CardDanfes';
import { IDanfe, IInvoiceSearchContext } from '../../types/types';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

const buildDanfe = (invoiceNumber: string, status: string): IDanfe => ({
  customer_id: '1',
  company_id: 1,
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
    return_batches: [],
    driver_name: 'Joao da Silva',
    trip_id: 44,
    trip_date: '2026-03-23',
    trip_run_number: 2,
    latest_occurrence: {
      id: 9,
      description: 'Cliente recusou mercadoria danificada',
      status: 'pending',
      created_at: '2026-03-23T11:30:00.000Z',
      resolved_at: null,
    },
  },
};

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CardDanfes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('informa que o motorista ainda esta sendo carregado', () => {
    render(
      <CardDanfes
        danfes={[buildDanfe('123456', 'assigned')]}
        driverLoadingByInvoice={{ '123456': true }}
      />,
    );

    expect(screen.getAllByText('Carregando motorista...').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sem motorista')).not.toBeInTheDocument();
  });

  it('diferencia falha de consulta de uma NF realmente sem motorista', () => {
    render(
      <CardDanfes
        danfes={[buildDanfe('123456', 'assigned')]}
        driverErrorByInvoice={{ '123456': true }}
      />,
    );

    expect(screen.getAllByText('Motorista indisponível').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sem motorista')).not.toBeInTheDocument();
  });

  it('isola o motorista quando duas empresas possuem o mesmo numero de NF', () => {
    const first = { ...buildDanfe('123456', 'assigned'), company_id: 3 };
    const second = { ...buildDanfe('123456', 'assigned'), company_id: 4, barcode: 'outro-codigo' };
    render(
      <CardDanfes
        danfes={[first, second]}
        invoiceContextByNf={{
          '3::123456': { ...CONTEXT_FIXTURE['123456'], driver_name: 'Motorista Empresa 3' },
          '4::123456': { ...CONTEXT_FIXTURE['123456'], driver_name: 'Motorista Empresa 4' },
        }}
      />,
    );

    expect(screen.getByText('Motorista: Motorista Empresa 3')).toBeInTheDocument();
    expect(screen.getByText('Motorista: Motorista Empresa 4')).toBeInTheDocument();
  });

  it('mostra o lote da devolucao, o envio finalizado e permite abrir o lote', () => {
    const onOpenReturnBatch = jest.fn();
    render(
      <CardDanfes
        danfes={[buildDanfe('123456', 'returned')]}
        invoiceContextByNf={{
          '123456': {
            ...CONTEXT_FIXTURE['123456'],
            return_count: 1,
            return_types: ['total'],
            return_batches: [{
              batch_code: 'RET-20260716-123456',
              batch_status: 'closed',
              workflow_status: 'awaiting_control_tower',
              sent_to_control_tower_at: '2026-07-16T18:00:00.000Z',
              received_by_control_tower_at: null,
              is_sent: true,
            }],
          },
        }}
        onOpenReturnBatch={onOpenReturnBatch}
      />,
    );

    expect(screen.getByText('Lote RET-20260716-123456: enviado/finalizado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir lote de devolucao RET-20260716-123456' }));
    expect(onOpenReturnBatch).toHaveBeenCalledWith('RET-20260716-123456', '123456');
  });

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
    expect(screen.getByRole('button', { name: 'Abrir última rota da NF 123456' })).toBeInTheDocument();
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

  it('abre o monitoramento focado na última rota vinculada à NF', () => {
    render(
      <CardDanfes
        danfes={[buildDanfe('123456', 'delivered')]}
        invoiceContextByNf={CONTEXT_FIXTURE}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abrir última rota da NF 123456' }));
    expect(window.location.hash).toBe('#/delivery-monitoring?nf=123456&trip=44&date=2026-03-23');
  });

  it('mostra o vinculo de refaturamento na NF cancelada e a referencia reversa na NF nova', async () => {
    render(
      <CardDanfes
        danfes={[
          buildDanfe('777111', 'cancelled'),
          buildDanfe('777222', 'pending'),
        ].map((danfe) => {
          if (danfe.invoice_number === '777111') {
            return {
              ...danfe,
              replacement_invoice_number: '777222',
              replacement_reason: 'Refaturada',
            };
          }

          return {
            ...danfe,
            replaced_invoice_number: '777111',
          };
        })}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mostrar detalhes da NF 777111' }));
    });

    expect(screen.getByText('Motivo/observacao:')).toBeInTheDocument();
    expect(screen.getByText('Refaturada — NF nova: 777222')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Voltar para frente do card da NF 777111' }));
      fireEvent.click(screen.getByRole('button', { name: 'Mostrar detalhes da NF 777222' }));
    });

    expect(screen.getByText('Substitui a NF cancelada:')).toBeInTheDocument();
    expect(screen.getAllByText('777111').length).toBeGreaterThan(0);
  });

  it('cancela uma NF sem rota e vincula a NF de refaturamento pela pesquisa', async () => {
    const sourceDanfe = buildDanfe('880011', 'pending');
    const replacementDanfe = buildDanfe('880022', 'pending');
    const cancelledDanfe = { ...sourceDanfe, status: 'cancelled' };
    const linkedDanfe = {
      ...cancelledDanfe,
      replacement_invoice_number: '880022',
      replacement_reason: 'Refaturada por troca comercial',
    };
    const onDanfeUpdated = jest.fn();

    mockedAxios.patch
      .mockResolvedValueOnce({ data: cancelledDanfe } as never)
      .mockResolvedValueOnce({ data: linkedDanfe } as never);
    mockedAxios.get.mockResolvedValue({ data: replacementDanfe } as never);

    render(
      <CardDanfes
        danfes={[sourceDanfe]}
        allowStatusActions
        onDanfeUpdated={onDanfeUpdated}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar detalhes da NF 880011' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alterar status da NF 880011' }));
    fireEvent.click(screen.getByRole('radio', { name: /Cancelada/ }));
    fireEvent.change(screen.getByLabelText('NF substituta (opcional)'), { target: { value: '880022' } });
    fireEvent.change(screen.getByLabelText('Motivo/observação'), { target: { value: 'Refaturada por troca comercial' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar status' }));

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/danfes/nf/880011/status'),
        { status: 'cancelled', companyId: 1 },
      );
      expect(mockedAxios.patch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/danfes/nf/880011/replacement'),
        {
          replacementInvoiceNumber: '880022',
          replacementReason: 'Refaturada por troca comercial',
          companyId: 1,
        },
      );
    });

    expect(onDanfeUpdated).toHaveBeenCalledWith(expect.objectContaining({
      invoice_number: '880011',
      status: 'cancelled',
      replacement_invoice_number: '880022',
    }));
  });
});
