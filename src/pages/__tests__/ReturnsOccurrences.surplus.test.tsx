import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { pdf } from '@react-pdf/renderer';
import ReturnsOccurrences from '../ReturnsOccurrences';
import verifyToken from '../../utils/verifyToken';

jest.mock('axios');
jest.mock('../../utils/verifyToken');
jest.mock('../../components/Header', () => () => <div data-testid="header" />);
jest.mock('../../components/ReturnReceiptPDF', () => () => null);
jest.mock('@react-pdf/renderer', () => ({
  pdf: jest.fn(() => ({
    toBlob: jest.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
  })),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedVerifyToken = verifyToken as jest.Mock;

function mockInitialGets() {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url.includes('/drivers')) {
      return Promise.resolve({ data: [{ id: '1', name: 'Motorista Teste' }] });
    }

    if (url.includes('/cars')) {
      return Promise.resolve({ data: [{ id: '1', model: 'Truck', license_plate: 'ABC-1234' }] });
    }

    if (url.includes('/products')) {
      return Promise.resolve({
        data: [{ code: 'RV001496', description: 'Produto Sobra', type: 'UN', price: '10.00' }],
      });
    }

    if (url.includes('/occurrences/search')) {
      return Promise.resolve({ data: [] });
    }

    if (url.includes('/returns/batches/search')) {
      return Promise.resolve({ data: [] });
    }

    if (url.includes('/danfes/nf/')) {
      return Promise.resolve({
        data: {
          invoice_number: '1694432',
          Customer: { name_or_legal_entity: 'Cliente Teste', city: 'Santos' },
          DanfeProducts: [{ Product: { code: 'RV001899', description: 'Produto Faltante', type: 'UN' }, quantity: 1, type: 'UN' }],
        },
      });
    }

    return Promise.resolve({ data: [] });
  });
}

function renderPage(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ReturnsOccurrences />
    </MemoryRouter>,
  );
}

async function openNewReturnModal() {
  fireEvent.click(await screen.findByRole('button', { name: '+ Nova devolucao' }));
  return screen.findByRole('dialog', { name: 'Nova devolucao' });
}

async function fillTransportStep() {
  const driverInput = await screen.findByRole('combobox', { name: 'Motorista da devolucao' });
  fireEvent.focus(driverInput);
  fireEvent.change(driverInput, { target: { value: 'Motorista' } });
  fireEvent.click(await screen.findByRole('option', { name: 'Motorista Teste' }));

  const vehicleInput = screen.getByRole('combobox', { name: 'Veiculo da devolucao' });
  fireEvent.focus(vehicleInput);
  fireEvent.change(vehicleInput, { target: { value: 'ABC-1234' } });
  fireEvent.click(await screen.findByRole('option', { name: 'Truck - ABC-1234' }));

  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByText('Digite ou leia o codigo de barras da NF');
}

async function continueAfterReturnLookup() {
  fireEvent.click(await screen.findByRole('button', { name: /continuar para tipo e produtos/i }));
  await screen.findByText('Tipo e produtos da devolucao');
}

describe('ReturnsOccurrences - sobra com inversao', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.put.mockReset();
    mockedAxios.patch.mockReset();
    mockedAxios.delete.mockReset();
    (mockedAxios as any).defaults = { headers: { common: {} } };

    mockedVerifyToken.mockReset();
    mockedVerifyToken.mockResolvedValue(true);
    (pdf as jest.Mock).mockReturnValue({
      toBlob: jest.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
    });

    mockedAxios.post.mockImplementation((url: string) => {
      if (url.includes('/returns/batches/create')) {
        return Promise.resolve({ data: { batch_code: 'RET-TESTE-1' } });
      }
      return Promise.resolve({ data: {} });
    });
    mockedAxios.patch.mockResolvedValue({ data: {} });

    mockInitialGets();

    localStorage.setItem('token', 'token-teste');
    localStorage.setItem('user_permission', 'admin');

    window.alert = jest.fn();
    window.open = jest.fn(() => null) as any;
    URL.createObjectURL = jest.fn(() => 'blob:test') as any;
    URL.revokeObjectURL = jest.fn() as any;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('permite pesquisar um lote diretamente pelo ID', async () => {
    renderPage();

    await screen.findByText('Consultar lotes de devolucao');
    fireEvent.change(screen.getByLabelText('ID do lote de devolucao'), {
      target: { value: 'RET-20260716-123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar lote' }));

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/returns/batches/search'),
        {
          params: {
            batch_code: 'RET-20260716-123456',
            workflow_status: 'all',
          },
        },
      );
    });
    expect(await screen.findByText('Nenhum lote encontrado com o ID RET-20260716-123456.')).toBeInTheDocument();
  });

  it('abre o calendario nativo ao clicar nos campos de periodo', async () => {
    const showPicker = jest.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value: showPicker,
    });

    try {
      renderPage();
      const startDateInput = await screen.findByLabelText('Data inicial dos lotes de devolucao');
      fireEvent.click(startDateInput);
      expect(showPicker).toHaveBeenCalledTimes(1);
    } finally {
      delete (HTMLInputElement.prototype as any).showPicker;
    }
  });

  it('autocompleta motorista e preenche o veiculo habitual pelo historico', async () => {
    const defaultGet = mockedAxios.get.getMockImplementation();
    mockedAxios.get.mockImplementation(((url: string) => {
      if (url.includes('/trips/suggestions/vehicle/1')) {
        return Promise.resolve({
          data: {
            suggestion: {
              car: { id: 1, model: 'Truck', license_plate: 'ABC-1234' },
              usageCount: 7,
              sampleSize: 10,
              lastUsedAt: '2026-07-28T12:00:00.000Z',
              basis: 'most_used_recently',
            },
          },
        });
      }
      return defaultGet?.(url);
    }) as typeof mockedAxios.get);

    renderPage();
    await openNewReturnModal();

    const driverInput = await screen.findByRole('combobox', { name: 'Motorista da devolucao' });
    fireEvent.focus(driverInput);
    fireEvent.change(driverInput, { target: { value: 'motorista' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Motorista Teste' }));

    expect(await screen.findByDisplayValue('Truck - ABC-1234')).toBeInTheDocument();
    expect(screen.getByText(/veículo habitual preenchido pelo histórico \(7 de 10 viagem\(ns\) recentes\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  it('oferece Emitida NF parcial ao resolver ocorrencia de falta', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/drivers') || url.includes('/cars') || url.includes('/products')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/occurrences/search')) {
        return Promise.resolve({ data: [{
          id: 77,
          invoice_number: '1798677',
          customer_name: 'Cliente Teste',
          city: 'Santos',
          reason: 'faltou_no_carregamento',
          scope: 'invoice_total',
          items: [],
          status: 'pending',
          workflow_status: 'pending_transportadora',
          description: 'Faltou no carregamento',
          created_at: '2026-07-16T12:00:00.000Z',
        }] });
      }
      if (url.includes('/returns/batches/search')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    renderPage(['/returns-occurrences?tab=occurrences']);
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como resolvida' }));

    expect(await screen.findByRole('option', { name: 'Emitida NF parcial' })).toHaveValue('nf_parcial_emitida');
  });

  it('mostra na ocorrencia os dados para o formulario de mercadoria faltante', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/drivers') || url.includes('/cars') || url.includes('/products')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/occurrences/search')) {
        return Promise.resolve({ data: [{
          id: 78,
          invoice_number: '1798678',
          customer_name: 'Cliente Teste',
          city: 'Santos',
          load_number: 'CARGA-46',
          representative_name: 'Representante da NF',
          motorista_name: 'João da Silva',
          reason: 'faltou_na_carga',
          scope: 'items',
          items: [{
            product_id: 'RV001899',
            product_description: 'Produto faltante',
            product_type: 'UN',
            quantity: 3,
            total_price: 90,
          }],
          status: 'pending',
          workflow_status: 'pending_transportadora',
          description: 'Faltou na carga',
          created_at: '2026-07-16T12:00:00.000Z',
        }] });
      }
      if (url.includes('/returns/batches/search')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    renderPage(['/returns-occurrences?tab=occurrences']);

    expect(await screen.findByLabelText('Dados para formulário de mercadoria faltante da NF 1798678')).toBeInTheDocument();
    expect(screen.getByText(/Representante da NF/)).toBeInTheDocument();
    expect(screen.getByText(/CARGA-46/)).toBeInTheDocument();
    expect(screen.getByText(/João da Silva/)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 90,00/)).toBeInTheDocument();
    expect(screen.getByText(/RV001899 - Produto faltante/)).toBeInTheDocument();
  });

  it('prioriza o ID do lote no link e exibe lote enviado sem controles de edicao', async () => {
    const batch = {
      batch_code: 'RET-20260706-1783336645087-21531',
      batch_status: 'closed',
      workflow_status: 'awaiting_control_tower',
      driver_id: 1,
      vehicle_plate: 'NDQ3B16',
      return_date: '2026-07-06',
      sent_to_control_tower_at: '2026-07-06T15:00:00.000Z',
      received_by_control_tower_at: null,
      Driver: { id: 1, name: 'Edson marcos' },
      notes: [{
        id: 10,
        invoice_number: '1798677',
        return_type: 'total',
        items: [{ product_id: 'RV004577', product_description: 'ARROZ', product_type: 'FD', quantity: 1 }],
      }],
      aggregated_items: [],
    };
    mockedAxios.get.mockImplementation((url: string, config?: any) => {
      if (url.includes('/drivers')) return Promise.resolve({ data: [{ id: '1', name: 'Edson marcos' }] });
      if (url.includes('/cars')) return Promise.resolve({ data: [{ id: '1', model: 'Truck', license_plate: 'NDQ3B16' }] });
      if (url.includes('/products') || url.includes('/occurrences/search')) return Promise.resolve({ data: [] });
      if (url.includes('/returns/batches/search')) {
        expect(config?.params).toEqual({
          batch_code: 'RET-20260706-1783336645087-21531',
          workflow_status: 'all',
        });
        return Promise.resolve({ data: [batch] });
      }
      return Promise.resolve({ data: [] });
    });

    renderPage(['/returns-occurrences?tab=returns&nf=1798677&batch=RET-20260706-1783336645087-21531']);

    expect(await screen.findByText('Lote RET-20260706-1783336645087-21531 (somente leitura)')).toBeInTheDocument();
    expect(screen.getByText('Notas fiscais do lote RET-20260706-1783336645087-21531')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar lote' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover NF' })).not.toBeInTheDocument();
  });

  it('renderiza campos condicionais de inversao e limpa ao desligar toggle', async () => {
    renderPage();
    await openNewReturnModal();
    await fillTransportStep();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar sobra sem NF' }));

    expect(screen.getByText('Numero da Carga *')).toBeInTheDocument();
    expect(screen.queryByText('NF relacionada *')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Marcar como inversao (produto veio no lugar de outro)'));
    expect(screen.getByText('NF relacionada *')).toBeInTheDocument();

    const inversionInvoiceInput = screen.getByPlaceholderText('Ex.: 1694432') as HTMLInputElement;
    fireEvent.change(inversionInvoiceInput, { target: { value: '1694432' } });
    expect(inversionInvoiceInput.value).toBe('1694432');

    fireEvent.click(screen.getByLabelText('Marcar como inversao (produto veio no lugar de outro)'));
    expect(screen.queryByText('NF relacionada *')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Marcar como inversao (produto veio no lugar de outro)'));
    const inversionInvoiceInputAfterReset = screen.getByPlaceholderText('Ex.: 1694432') as HTMLInputElement;
    expect(inversionInvoiceInputAfterReset.value).toBe('');
  });

  it('com toggle OFF envia sobra sem campo inversion no payload', async () => {
    renderPage();
    await openNewReturnModal();
    await fillTransportStep();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar sobra sem NF' }));

    fireEvent.change(screen.getByPlaceholderText('Ex.: CARGA-123'), { target: { value: 'CARGA-123' } });
    fireEvent.change(screen.getByPlaceholderText('Ex.: RV001496'), { target: { value: 'RV001496' } });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Unidade do produto da sobra' })).toHaveValue('UN'));

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar sobra na lista' }));

    fireEvent.click(screen.getByRole('button', { name: 'Concluir devolucao' }));

    await waitFor(() => {
      const createBatchCall = mockedAxios.post.mock.calls.find(([url]) => String(url).includes('/returns/batches/create'));
      expect(createBatchCall).toBeTruthy();
      const payload = createBatchCall?.[1] as any;
      expect(payload.notes[0].is_inversion).toBe(false);
      expect(payload.notes[0]).not.toHaveProperty('inversion');
      expect(payload.notes[0].load_number).toBe('CARGA-123');
    });

    expect(pdf).toHaveBeenCalled();
  });

  it('converte caixas em unidades ao registrar devolucao parcial em UN', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/drivers')) {
        return Promise.resolve({ data: [{ id: '1', name: 'Motorista Teste' }] });
      }

      if (url.includes('/cars')) {
        return Promise.resolve({ data: [{ id: '1', model: 'Truck', license_plate: 'ABC-1234' }] });
      }

      if (url.includes('/products')) {
        return Promise.resolve({
          data: [{ code: 'PA000014', description: 'FILE DE MERLUZA ARGENTINA CONG PCT 400GR CX 20UN', type: 'CX', price: '10.00' }],
        });
      }

      if (url.includes('/occurrences/search')) {
        return Promise.resolve({ data: [] });
      }

      if (url.includes('/returns/batches/search')) {
        return Promise.resolve({ data: [] });
      }

      if (url.includes('/collection-requests/action-queue')) {
        return Promise.resolve({ data: [] });
      }

      if (url.includes('/danfes/nf/1754803')) {
        return Promise.resolve({
          data: {
            invoice_number: '1754803',
            Customer: { name_or_legal_entity: 'Cliente Teste', city: 'Santos' },
            DanfeProducts: [{
              Product: {
                code: 'PA000014',
                description: 'FILE DE MERLUZA ARGENTINA CONG PCT 400GR CX 20UN',
                type: 'CX',
              },
              quantity: 2,
              type: 'CX',
            }],
          },
        });
      }

      return Promise.resolve({ data: [] });
    });

    renderPage();
    await openNewReturnModal();
    await fillTransportStep();
    fireEvent.change(screen.getByPlaceholderText('Digite a NF'), { target: { value: '1754803' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar NF de devolucao' }));

    await screen.findByText('NF carregada: 1754803 | Cliente: Cliente Teste');
    await continueAfterReturnLookup();
    fireEvent.click(screen.getByLabelText('Parcial'));

    fireEvent.change(screen.getByRole('combobox', { name: 'Produto da devolucao parcial' }), {
      target: { value: 'PA000014' },
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Unidade da devolucao parcial' }), {
      target: { value: 'UN' },
    });

    await screen.findByText('Limite da NF para o tipo selecionado: 40 | Restante para adicionar: 40');

    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar item parcial' }));

    expect(screen.getByText('PA000014', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/Tipo: UN \| Qtd: 3/)).toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalledWith(expect.stringContaining('Quantidade excede o limite da NF'));
  });

  it('registra quebra de peso separada de uma devolucao fisica', async () => {
    renderPage();
    await openNewReturnModal();
    await fillTransportStep();

    fireEvent.change(screen.getByPlaceholderText('Digite a NF'), { target: { value: '1694432' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar NF de devolucao' }));
    await screen.findByText('NF carregada: 1694432 | Cliente: Cliente Teste');
    await continueAfterReturnLookup();

    fireEvent.click(screen.getByLabelText('Quebra de peso'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Produto da devolucao parcial' }), {
      target: { value: 'RV001899' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar quebra de peso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar NF na lista' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir devolucao' }));

    await waitFor(() => {
      const createBatchCall = mockedAxios.post.mock.calls.find(([url]) => String(url).includes('/returns/batches/create'));
      const payload = createBatchCall?.[1] as any;
      expect(payload.notes[0].return_type).toBe('weight_break');
      expect(payload.notes[0].items[0]).toEqual(expect.objectContaining({
        product_id: 'RV001899',
        is_missing: false,
        keep_in_stock: false,
      }));
    });
  });

  it('marca produto faltante sem envia-lo para estoque', async () => {
    renderPage();
    await openNewReturnModal();
    await fillTransportStep();

    fireEvent.change(screen.getByPlaceholderText('Digite a NF'), { target: { value: '1694432' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar NF de devolucao' }));
    await screen.findByText('NF carregada: 1694432 | Cliente: Cliente Teste');
    await continueAfterReturnLookup();

    fireEvent.click(screen.getByLabelText('Parcial'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Produto da devolucao parcial' }), {
      target: { value: 'RV001899' },
    });
    fireEvent.click(screen.getByLabelText(/Produto faltante/));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar item parcial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar NF na lista' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir devolucao' }));

    await waitFor(() => {
      const createBatchCall = mockedAxios.post.mock.calls.find(([url]) => String(url).includes('/returns/batches/create'));
      const payload = createBatchCall?.[1] as any;
      expect(payload.notes[0].items[0]).toEqual(expect.objectContaining({
        is_missing: true,
        keep_in_stock: false,
      }));
    });
  });

  it('exige confirmacao do alerta quando a NF nao existe na base de devolucoes', async () => {
    const defaultGet = mockedAxios.get.getMockImplementation();
    mockedAxios.get.mockImplementation(((url: string) => {
      if (url.includes('/return-data/occurrences/by-invoice/1694432')) {
        return Promise.resolve({
          data: {
            invoice_number: '1694432',
            invoice_number_normalized: '1694432',
            consolidated_status: 'not_found',
            total_occurrences: 0,
            approved_count: 0,
            rejected_count: 0,
            latest_base_update: '2026-07-29T14:30:00.000Z',
            occurrences: [],
          },
        });
      }
      return defaultGet?.(url);
    }) as typeof mockedAxios.get);

    renderPage();
    await openNewReturnModal();
    await fillTransportStep();
    fireEvent.change(screen.getByPlaceholderText('Digite a NF'), { target: { value: '1694432' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar NF de devolucao' }));

    expect(await screen.findByText('Atenção: NF não localizada na base de devoluções')).toBeInTheDocument();
    expect(screen.getByText(/leia este aviso e confirme abaixo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar NF na lista' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ciente, continuar para tipo e produtos' }));

    expect(await screen.findByText('Tipo e produtos da devolucao')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar NF na lista' })).toBeEnabled();
  });

  it('mostra a consulta orientativa da base sem bloquear a NF no lote', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/drivers')) return Promise.resolve({ data: [{ id: '1', name: 'Motorista Teste' }] });
      if (url.includes('/cars')) return Promise.resolve({ data: [{ id: '1', model: 'Truck', license_plate: 'ABC-1234' }] });
      if (url.includes('/products') || url.includes('/occurrences/search') || url.includes('/returns/batches/search')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/collection-requests/action-queue')) return Promise.resolve({ data: [] });
      if (url.includes('/return-data/occurrences/overview')) {
        return Promise.resolve({ data: { latest_import: { imported_at: '2026-07-29T14:30:00.000Z' } } });
      }
      if (url.includes('/return-data/occurrences/by-invoice/1694432')) {
        return Promise.resolve({
          data: {
            invoice_number: '1694432',
            invoice_number_normalized: '1694432',
            consolidated_status: 'approved',
            total_occurrences: 2,
            approved_count: 2,
            rejected_count: 0,
            latest_base_update: '2026-07-29T14:30:00.000Z',
            occurrences: [{
              id: 1,
              source_occurrence_id: 'OC-10',
              approval_status: 'approved',
              return_reason_raw: 'Mercadoria faltante',
              return_reason_category: 'Mercadoria faltante',
              return_justification: 'Faltou item',
              approval_justification: 'Aprovado',
              carrier_name: 'KP Transportes',
              items: [{ product_description: 'Produto faltante', product_value: 10 }],
            }],
          },
        });
      }
      if (url.includes('/danfes/nf/1694432')) {
        return Promise.resolve({
          data: {
            invoice_number: '1694432',
            Customer: { name_or_legal_entity: 'Cliente Teste', city: 'Santos' },
            DanfeProducts: [{
              Product: { code: 'RV001899', description: 'Produto Faltante', type: 'UN' },
              quantity: 1,
              type: 'UN',
            }],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderPage();
    await openNewReturnModal();
    await fillTransportStep();
    fireEvent.change(screen.getByPlaceholderText('Digite a NF'), { target: { value: '1694432' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar NF de devolucao' }));

    expect(await screen.findByText('2 ocorrências aprovadas')).toBeInTheDocument();
    expect(screen.getByText(/não impede adicionar a NF nem concluir o lote/i)).toBeInTheDocument();
    await continueAfterReturnLookup();
    expect(screen.getByRole('button', { name: 'Adicionar NF na lista' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Ver ocorrências' }));
    expect(await screen.findByText('ID OC-10')).toBeInTheDocument();
    expect(screen.getAllByText(/Produto faltante/i).length).toBeGreaterThan(0);
  });
});
