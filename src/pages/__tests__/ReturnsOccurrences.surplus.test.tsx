import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { pdf } from '@react-pdf/renderer';
import ReturnsOccurrences from '../ReturnsOccurrences';
import verifyToken from '../../utils/verifyToken';
import { showConfirm } from '../../utils/dialog';

jest.mock('axios');
jest.mock('../../utils/verifyToken');
jest.mock('../../utils/dialog', () => ({ showConfirm: jest.fn() }));
jest.mock('../../components/Header', () => () => <div data-testid="header" />);
jest.mock('../../components/ReturnReceiptPDF', () => () => null);
jest.mock('@react-pdf/renderer', () => ({
  pdf: jest.fn(() => ({
    toBlob: jest.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
  })),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedVerifyToken = verifyToken as jest.Mock;
const mockedShowConfirm = showConfirm as jest.MockedFunction<typeof showConfirm>;

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
  await screen.findByText('Localizar nota fiscal');
}

async function continueAfterReturnLookup() {
  fireEvent.click(await screen.findByRole('button', { name: /continuar para tipo e produtos/i }));
  await screen.findByText('Selecione os produtos e adicione ao lote');
}

describe('ReturnsOccurrences - sobra com inversao', () => {
  const existingOccurrence = {
    id: 91, company_id: 1, invoice_number: '1694432', status: 'pending',
    workflow_status: 'pending_transportadora', reason: 'faltou_no_carregamento', scope: 'items',
    edit_version: 'version-91', items: [{ product_id: 'RV001899', product_description: 'Produto Faltante', product_type: 'UN', quantity: 1 }],
  };
  function mockOccurrenceLookup(rows: any[] = [existingOccurrence], fail = false) {
    const fallback = mockedAxios.get.getMockImplementation();
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/occurrences/search?invoice_number=')) {
        return fail ? Promise.reject(new Error('Falha sintética na consulta')) : Promise.resolve({ data: rows });
      }
      if (url.includes('/danfes/nf/')) return Promise.resolve({ data: {
        invoice_number: '1694432', company_id: 1,
        Customer: { name_or_legal_entity: 'Cliente Teste', city: 'Santos' },
        DanfeProducts: [
          { Product: { code: 'RV001899', description: 'Produto Faltante', type: 'UN' }, quantity: 1, type: 'UN' },
          { Product: { code: 'RV002000', description: 'Segundo Produto', type: 'UN' }, quantity: 5, type: 'UN' },
        ],
      } });
      return fallback!(url);
    });
  }
  async function searchOccurrence() {
    renderPage(['/returns-occurrences?tab=occurrences']);
    fireEvent.click(await screen.findByRole('button', { name: 'Criar ocorrencia' }));
    const dialog = await screen.findByRole('dialog', { name: 'Formulário de ocorrência' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'NF da ocorrencia' }), { target: { value: '1694432' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buscar NF de ocorrencia' }));
    return dialog;
  }
  it('reabre ocorrência existente, mantém o primeiro item e acrescenta outro no mesmo registro', async () => {
    mockOccurrenceLookup();
    const dialog = await searchOccurrence();
    await within(dialog).findByText(/Esta NF já possui a ocorrência #91/);
    expect(within(dialog).getByText('Editar ocorrencia #91')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByDisplayValue('RV001899 - Produto Faltante'), { target: { value: 'RV002000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Adicionar item/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar alteracoes' }));
    await waitFor(() => expect(mockedAxios.put).toHaveBeenCalledWith(expect.stringContaining('/occurrences/91'), expect.objectContaining({
      expected_version: 'version-91', scope: 'items',
      items: [expect.objectContaining({ product_id: 'RV001899', quantity: 1 }), expect.objectContaining({ product_id: 'RV002000', quantity: 1 })],
    })));
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
  it('preserva também o item de uma ocorrência legada', async () => {
    mockOccurrenceLookup([{ ...existingOccurrence, items: [], product_id: 'RV001899', product_description: 'Produto Faltante', product_type: 'UN', quantity: 1 }]);
    const dialog = await searchOccurrence();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Salvar alteracoes' }));
    await waitFor(() => expect(mockedAxios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ scope: 'items', items: [expect.objectContaining({ product_id: 'RV001899', quantity: 1 })] })));
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
  it('bloqueia cadastro quando não consegue consultar ocorrências existentes', async () => {
    mockOccurrenceLookup([], true);
    const dialog = await searchOccurrence();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Não foi possível conferir a NF');
    expect(within(dialog).queryByRole('button', { name: 'Registrar ocorrencia' })).not.toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
  it('consulta NF na empresa da sessão e recusa ocorrência de outra empresa', async () => {
    mockOccurrenceLookup([{ ...existingOccurrence, company_id: 2 }]);
    const dialog = await searchOccurrence();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Não foi possível conferir a NF');
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/danfes/nf/1694432?companyId=1'));
    expect(within(dialog).queryByRole('button', { name: 'Salvar alteracoes' })).not.toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
  it.each([
    [[{ ...existingOccurrence, status: 'resolved', workflow_status: 'finalized' }], /já foi tratada/],
    [[{ ...existingOccurrence, status: 'resolved', workflow_status: 'awaiting_control_tower' }], /já foi tratada/],
    [[existingOccurrence, { ...existingOccurrence, id: 92 }], /2 ocorrências antigas: #91, #92/],
  ])('sinaliza ocorrência tratada ou duplicatas antigas sem excluir nem criar', async (rows, message) => {
    mockOccurrenceLookup(rows as any[]);
    const dialog = await searchOccurrence();
    expect(await within(dialog).findByText(message as RegExp)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Registrar ocorrencia' })).not.toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });
  it('trocar a NF invalida o registro carregado até uma nova busca', async () => {
    mockOccurrenceLookup();
    const dialog = await searchOccurrence();
    await within(dialog).findByRole('button', { name: 'Salvar alteracoes' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'NF da ocorrencia' }), { target: { value: '1234567' } });
    expect(within(dialog).queryByRole('button', { name: 'Salvar alteracoes' })).not.toBeInTheDocument();
    expect(mockedAxios.put).not.toHaveBeenCalled();
  });
  it('reconfere rascunho antigo e usa os itens salvos na ocorrência existente', async () => {
    localStorage.setItem('kp_returns_occurrence_draft_v1', JSON.stringify({
      invoiceNumber: '1694432', reason: 'produto_avariado', productCode: 'RV002000',
      productType: 'UN', quantityInput: '5', items: [{ product_id: 'RV002000', quantity: 5 }],
    }));
    mockOccurrenceLookup();
    renderPage(['/returns-occurrences?tab=occurrences']);
    fireEvent.click(await screen.findByRole('button', { name: 'Criar ocorrencia' }));
    const dialog = await screen.findByRole('dialog', { name: 'Formulário de ocorrência' });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Salvar alteracoes' }));
    await waitFor(() => expect(mockedAxios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      reason: 'faltou_no_carregamento', items: [expect.objectContaining({ product_id: 'RV001899', quantity: 1 })],
    })));
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
  it('um conflito mantém os itens visíveis e orienta recarregar, sem novo POST', async () => {
    mockOccurrenceLookup();
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.put.mockRejectedValueOnce({ response: { status: 409, data: { error: 'A ocorrência foi atualizada.' } } });
    const dialog = await searchOccurrence();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Salvar alteracoes' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Seu preenchimento continua visível');
    expect(within(dialog).getByDisplayValue('RV001899 - Produto Faltante')).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
  it('oferece também motoristas e placas além das oito primeiras opções', async () => {
    const fallback = mockedAxios.get.getMockImplementation();
    mockedAxios.get.mockImplementation((url: string, ...args: any[]) => {
      if (url.endsWith('/drivers')) return Promise.resolve({ data: Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), name: `Motorista ${i + 1}` })) });
      if (url.endsWith('/cars')) return Promise.resolve({ data: Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), model: 'Truck', license_plate: `TEST${i + 1}` })) });
      return fallback!(url, ...args);
    });
    renderPage();
    await openNewReturnModal();
    fireEvent.focus(screen.getByRole('combobox', { name: 'Motorista da devolucao' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Motorista 12' }));
    expect(screen.getByRole('combobox', { name: 'Motorista da devolucao' })).toHaveValue('Motorista 12');
    fireEvent.focus(screen.getByRole('combobox', { name: 'Veiculo da devolucao' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Truck - TEST12' }));
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });
  async function prepareSurplusReview() {
    renderPage();
    await openNewReturnModal();
    await fillTransportStep();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar sobra sem NF' }));
    fireEvent.change(screen.getByPlaceholderText('Ex.: CARGA-123'), { target: { value: 'CARGA-TESTE' } });
    fireEvent.change(screen.getByPlaceholderText('Ex.: RV001496'), { target: { value: 'RV001496' } });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Unidade do produto da sobra' })).toHaveValue('UN'));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar sobra na lista' }));
  }

  it('revisa itens por nota e bloqueia gravação duplicada, preservando o rascunho após falha', async () => {
    await prepareSurplusReview();
    expect(screen.getByRole('region', { name: /Conferência de/ })).toHaveTextContent('1 UN');
    let rejectSave!: (reason: Error) => void;
    mockedAxios.post.mockImplementation(() => new Promise((_, reject) => { rejectSave = reject; }));
    const save = screen.getByRole('button', { name: 'Concluir devolucao' });
    fireEvent.click(save); fireEvent.click(save);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar devolucao' }));
    expect(screen.getByRole('dialog', { name: 'Nova devolucao' })).toBeInTheDocument();
    await act(async () => rejectSave(new Error('Falha sintética')));
    expect(await screen.findByText(/Não foi possível confirmar a gravação/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Conferência de/ })).toHaveTextContent('RV001496');
    expect(screen.getByRole('button', { name: 'Concluir devolucao' })).toBeEnabled();
  });

  it('não deixa repetir o cadastro quando a gravação funciona e apenas o PDF falha', async () => {
    (pdf as jest.Mock).mockReturnValue({ toBlob: jest.fn().mockRejectedValue(new Error('PDF indisponível')) });
    await prepareSurplusReview();
    fireEvent.click(screen.getByRole('button', { name: 'Concluir devolucao' }));
    expect(await screen.findByText(/Devolução salva no lote RET-TESTE-1, mas o PDF falhou/)).toBeInTheDocument();
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Nova devolucao' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível confirmar a gravação/)).not.toBeInTheDocument();
  });

  it('mostra erro de limite junto à quantidade, sem perder os campos', async () => {
    renderPage();
    await openNewReturnModal();
    await fillTransportStep();
    fireEvent.change(screen.getByPlaceholderText('Digite a NF'), { target: { value: '1694432' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar NF de devolucao' }));
    await screen.findByText('NF carregada: 1694432 | Cliente: Cliente Teste');
    await continueAfterReturnLookup();
    fireEvent.click(screen.getByLabelText('Parcial'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Produto da devolucao parcial' }), { target: { value: 'RV001899' } });
    const quantity = screen.getByRole('textbox', { name: 'Quantidade da devolução parcial' });
    fireEvent.change(quantity, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar produto' }));
    expect(quantity).toHaveAttribute('aria-invalid', 'true');
    expect(quantity).toHaveValue('2');
    expect(await screen.findByText('Quantidade excede o limite da NF. Disponível: 1 UN.')).toBeInTheDocument();
    fireEvent.change(quantity, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar produto' }));
    expect(quantity).toHaveAttribute('aria-invalid', 'false');
  });

  it('protege o envio da ocorrência e mantém NF e motivo após falha', async () => {
    renderPage(['/?tab=occurrences']);
    fireEvent.click(await screen.findByRole('button', { name: 'Criar ocorrencia' }));
    const dialog = screen.getByRole('dialog', { name: 'Formulário de ocorrência' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'NF da ocorrencia' }), { target: { value: '1694432' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Buscar NF de ocorrencia' }));
    await within(dialog).findByText('NF selecionada: 1694432 | Cliente: Cliente Teste');
    let rejectSave!: (reason: Error) => void;
    mockedAxios.post.mockImplementation(() => new Promise((_, reject) => { rejectSave = reject; }));
    const save = within(dialog).getByRole('button', { name: 'Registrar ocorrencia' });
    fireEvent.click(save); fireEvent.click(save);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar popup' }));
    expect(dialog).toBeInTheDocument();
    await act(async () => rejectSave(new Error('Falha sintética')));
    expect(await within(dialog).findByText(/Não foi possível confirmar o salvamento/)).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'NF da ocorrencia' })).toHaveValue('1694432');
    expect(within(dialog).getByDisplayValue('Faltou no carregamento')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Registrar ocorrencia' })).toBeEnabled();
  });

  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.put.mockReset();
    mockedAxios.patch.mockReset();
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
    (mockedAxios as any).defaults = { headers: { common: {} } };

    mockedVerifyToken.mockReset();
    mockedVerifyToken.mockResolvedValue(true);
    mockedShowConfirm.mockReset();
    mockedShowConfirm.mockResolvedValue(true);
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
    localStorage.setItem('company_id', '1');

    window.alert = jest.fn();
    window.open = jest.fn(() => null) as any;
    URL.createObjectURL = jest.fn(() => 'blob:test') as any;
    URL.revokeObjectURL = jest.fn() as any;
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
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

  it('edita lote pendente usando o mesmo wizard da criacao', async () => {
    const batch = {
      batch_code: 'RET-20260806-EDITAVEL',
      batch_status: 'open',
      workflow_status: 'pending_transportadora',
      driver_id: 1,
      vehicle_plate: 'ABC-1234',
      return_date: '2026-08-06',
      sent_to_control_tower_at: null,
      received_by_control_tower_at: null,
      Driver: { id: 1, name: 'Motorista Teste' },
      notes: [{
        id: 10,
        invoice_number: '1694432',
        return_type: 'total',
        items: [{ product_id: 'RV001899', product_description: 'Produto Faltante', product_type: 'UN', quantity: 1 }],
      }],
      aggregated_items: [],
    };
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/drivers')) return Promise.resolve({ data: [{ id: '1', name: 'Motorista Teste' }] });
      if (url.includes('/cars')) return Promise.resolve({ data: [{ id: '1', model: 'Truck', license_plate: 'ABC-1234' }] });
      if (url.includes('/products') || url.includes('/occurrences/search')) return Promise.resolve({ data: [] });
      if (url.includes('/returns/batches/search')) return Promise.resolve({ data: [batch] });
      return Promise.resolve({ data: [] });
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar lote' }));

    expect(await screen.findByRole('dialog', { name: 'Lote de devolucao RET-20260806-EDITAVEL' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Etapas da devolucao' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Motorista da devolucao' })).toHaveValue('Motorista Teste');
    expect(screen.getByRole('combobox', { name: 'Veiculo da devolucao' })).toHaveValue('Truck - ABC-1234');

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Localizar nota fiscal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Etapa 4.*Revisao do lote/i }));

    expect(await screen.findByText('Notas fiscais do lote RET-20260806-EDITAVEL')).toBeInTheDocument();
    expect(screen.getByText('NF 1694432', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar lote' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar outra NF' }));
    expect(screen.getByRole('button', { name: /Etapa 1.*Editar.*Transporte/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Etapa 2.*Nota fiscal/i })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('textbox', { name: 'Número da NF da devolução' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Número da NF da devolução' })).toHaveAttribute('maxlength', '7');
    fireEvent.click(screen.getByRole('button', { name: /Etapa 1.*Editar.*Transporte/i }));
    expect(screen.getByRole('combobox', { name: 'Motorista da devolucao' })).toHaveValue('Motorista Teste');
    expect(screen.getByRole('combobox', { name: 'Veiculo da devolucao' })).toHaveValue('Truck - ABC-1234');
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

    fireEvent.change(screen.getByRole('textbox', { name: 'Observação do PDF da devolução' }), {
      target: { value: 'Conferir duas caixas avariadas no recebimento.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Concluir devolucao' }));

    await waitFor(() => {
      const createBatchCall = mockedAxios.post.mock.calls.find(([url]) => String(url).includes('/returns/batches/create'));
      expect(createBatchCall).toBeTruthy();
      const payload = createBatchCall?.[1] as any;
      expect(payload.notes[0].is_inversion).toBe(false);
      expect(payload.notes[0]).not.toHaveProperty('inversion');
      expect(payload.notes[0].load_number).toBe('CARGA-123');
      expect(payload.observation).toBe('Conferir duas caixas avariadas no recebimento.');
    });

    expect(pdf).toHaveBeenCalled();
    const pdfDocument = (pdf as jest.Mock).mock.calls[0][0] as React.ReactElement;
    expect(pdfDocument.props.observation).toBe('Conferir duas caixas avariadas no recebimento.');
  });

  it.each([
    ['UN', 'FILE CONG PCT 400GR CX 20UN', 2, 40, 3],
    ['KG', 'FILE CONG CX 20KG', 5, 100, 30],
  ])('converte caixas ao registrar devolucao parcial em %s', async (unit, description, boxes, limit, returned) => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/drivers')) {
        return Promise.resolve({ data: [{ id: '1', name: 'Motorista Teste' }] });
      }

      if (url.includes('/cars')) {
        return Promise.resolve({ data: [{ id: '1', model: 'Truck', license_plate: 'ABC-1234' }] });
      }

      if (url.includes('/products')) {
        return Promise.resolve({
          data: [{ code: 'PA000014', description, type: 'CX', price: '10.00' }],
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
                description,
                type: 'CX',
              },
              quantity: boxes,
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
      target: { value: unit },
    });

    await screen.findByText(`Limite da NF para o tipo selecionado: ${limit} | Restante para adicionar: ${limit}`);

    fireEvent.change(screen.getByRole('textbox', { name: 'Quantidade da devolução parcial' }), { target: { value: String(returned) } });
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar produto' }));

    expect(screen.getByText('PA000014', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Tipo: ${unit} \\| Qtd: ${returned}`))).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Produto da devolucao parcial' })).toHaveValue('');
    expect(screen.getByText('1 item(ns) selecionado(s). A NF só entra no lote ao clicar no botão abaixo.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Produto da devolucao parcial' }), { target: { value: 'PA000014' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Quantidade da devolução parcial' }), { target: { value: String(boxes) } });
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar produto' }));
    const remainingBoxes = (boxes - returned * boxes / limit).toLocaleString('pt-BR');
    expect(await screen.findByText(`Quantidade excede o limite da NF. Disponível: ${remainingBoxes} CX.`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Concluir seleção e adicionar NF ao lote' }));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Há um produto em preenchimento'));

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
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar produto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir seleção e adicionar NF ao lote' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar produto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir seleção e adicionar NF ao lote' }));
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

  it('mantém faltante individual na total e devolve os demais produtos', async () => {
    const defaultGet = mockedAxios.get.getMockImplementation();
    mockedAxios.get.mockImplementation(((url: string) => {
      if (url.includes('/danfes/nf/')) return Promise.resolve({ data: {
        invoice_number: '1694432', Customer: { name_or_legal_entity: 'Cliente Teste', city: 'Santos' },
        DanfeProducts: [
          { Product: { code: 'A', description: 'Produto ausente', type: 'UN' }, quantity: 1, type: 'UN' },
          { Product: { code: 'B', description: 'Produto que retorna', type: 'UN' }, quantity: 2, type: 'UN' },
        ],
      } });
      return defaultGet?.(url);
    }) as any);
    renderPage();
    await openNewReturnModal();
    await fillTransportStep();
    fireEvent.change(screen.getByPlaceholderText('Digite a NF'), { target: { value: '1694432' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar NF de devolucao' }));
    await screen.findByText('NF carregada: 1694432 | Cliente: Cliente Teste');
    await continueAfterReturnLookup();
    expect(screen.getByLabelText('Total')).toBeChecked();
    fireEvent.click(screen.getAllByLabelText('Produto faltante')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Concluir seleção e adicionar NF ao lote' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir devolucao' }));
    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/returns/batches/create'),
      expect.objectContaining({ notes: [expect.objectContaining({ return_type: 'total', items: [
        expect.objectContaining({ product_id: 'A', is_missing: true, keep_in_stock: false }),
        expect.objectContaining({ product_id: 'B', is_missing: false, keep_in_stock: false }),
      ] })] }),
    ));
  });

  it('pergunta e envia a confirmacao para alterar NF pendente de devolucao total', async () => {
    const defaultGet = mockedAxios.get.getMockImplementation();
    mockedAxios.get.mockImplementation(((url: string) => {
      if (url.includes('/danfes/nf/')) return Promise.resolve({ data: {
        invoice_number: '1694432',
        status: 'pending',
        Customer: { name_or_legal_entity: 'Cliente Teste', city: 'Santos' },
        DanfeProducts: [
          { Product: { code: 'A', description: 'Produto devolvido', type: 'UN' }, quantity: 1, type: 'UN' },
        ],
      } });
      return defaultGet?.(url);
    }) as any);
    mockedShowConfirm.mockResolvedValueOnce(true);

    renderPage();
    await openNewReturnModal();
    await fillTransportStep();
    fireEvent.change(screen.getByPlaceholderText('Digite a NF'), { target: { value: '1694432' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar NF de devolucao' }));
    await screen.findByText('NF carregada: 1694432 | Cliente: Cliente Teste');
    await continueAfterReturnLookup();
    fireEvent.click(screen.getByRole('button', { name: 'Concluir seleção e adicionar NF ao lote' }));

    await waitFor(() => expect(mockedShowConfirm).toHaveBeenCalledWith(
      expect.stringContaining('status Pendente'),
      expect.objectContaining({ confirmLabel: 'Alterar para devolvida' }),
    ));
    await screen.findByText('NF 1694432', { selector: 'strong' });

    fireEvent.click(screen.getByRole('button', { name: 'Concluir devolucao' }));
    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/returns/batches/create'),
      expect.objectContaining({ notes: [expect.objectContaining({
        invoice_number: '1694432',
        return_type: 'total',
        change_status_to_returned: true,
      })] }),
    ));
  });

  it('mantem a NF em reentrega quando o usuario recusa a alteracao de status', async () => {
    const defaultGet = mockedAxios.get.getMockImplementation();
    mockedAxios.get.mockImplementation(((url: string) => {
      if (url.includes('/danfes/nf/')) return Promise.resolve({ data: {
        invoice_number: '1694432',
        status: 'redelivery',
        Customer: { name_or_legal_entity: 'Cliente Teste', city: 'Santos' },
        DanfeProducts: [
          { Product: { code: 'A', description: 'Produto devolvido', type: 'UN' }, quantity: 1, type: 'UN' },
        ],
      } });
      return defaultGet?.(url);
    }) as any);
    mockedShowConfirm.mockResolvedValueOnce(false);

    renderPage();
    await openNewReturnModal();
    await fillTransportStep();
    fireEvent.change(screen.getByPlaceholderText('Digite a NF'), { target: { value: '1694432' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar NF de devolucao' }));
    await screen.findByText('NF carregada: 1694432 | Cliente: Cliente Teste');
    await continueAfterReturnLookup();
    fireEvent.click(screen.getByRole('button', { name: 'Concluir seleção e adicionar NF ao lote' }));

    await waitFor(() => expect(mockedShowConfirm).toHaveBeenCalledWith(
      expect.stringContaining('status Reentrega'),
      expect.objectContaining({ cancelLabel: 'Manter status atual' }),
    ));
    await screen.findByText('NF 1694432', { selector: 'strong' });

    fireEvent.click(screen.getByRole('button', { name: 'Concluir devolucao' }));
    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/returns/batches/create'),
      expect.objectContaining({ notes: [expect.objectContaining({
        invoice_number: '1694432',
        change_status_to_returned: false,
      })] }),
    ));
  });

  it('preenche pela base e confirma antes de aceitar tipo divergente', async () => {
    const defaultGet = mockedAxios.get.getMockImplementation();
    mockedAxios.get.mockImplementation(((url: string) => {
      if (url.includes('/return-data/occurrences/by-invoice/1694432')) {
        return Promise.resolve({
          data: {
            invoice_number: '1694432',
            invoice_number_normalized: '1694432',
            consolidated_status: 'approved',
            total_occurrences: 1,
            approved_count: 1,
            rejected_count: 0,
            latest_base_update: '2026-07-30T22:27:00.000Z',
            occurrences: [{
              id: 8356,
              source_occurrence_id: '8356',
              approval_status: 'approved',
              inferred_return_type: 'total',
              effective_return_type: 'total',
              operational_return_type: null,
              items: [],
            }],
          },
        });
      }
      return defaultGet?.(url);
    }) as any);

    renderPage();
    mockedShowConfirm.mockResolvedValueOnce(false).mockResolvedValue(true);
    await openNewReturnModal();
    await fillTransportStep();

    fireEvent.change(screen.getByPlaceholderText('Digite a NF'), { target: { value: '1694432' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar NF de devolucao' }));
    await screen.findByText('NF carregada: 1694432 | Cliente: Cliente Teste');
    await continueAfterReturnLookup();

    expect(screen.getByLabelText('Total')).toBeChecked();
    expect(screen.getByTestId('return-base-compact-reminder')).toHaveTextContent('Possui ocorrência aprovada');
    expect(screen.getByTestId('return-base-compact-reminder')).toHaveTextContent('Tipo sugerido pela base: Total');
    fireEvent.click(screen.getByLabelText('Parcial'));
    await waitFor(() => expect(mockedShowConfirm).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Total')).toBeChecked();

    fireEvent.click(screen.getByLabelText('Parcial'));
    const partialProduct = await screen.findByRole('combobox', { name: 'Produto da devolucao parcial' });
    expect(mockedShowConfirm).toHaveBeenCalledWith(
      expect.stringContaining('A base de devoluções classifica esta NF como Total, mas você selecionou Parcial.'),
      expect.any(Object),
    );
    expect(screen.getByText(/O usuário confirmou que deseja manter essa diferença/)).toBeInTheDocument();
    fireEvent.change(partialProduct, {
      target: { value: 'RV001899' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar produto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir seleção e adicionar NF ao lote' }));

    expect(await screen.findByText('NF 1694432', { selector: 'strong' })).toBeInTheDocument();
    expect(mockedShowConfirm).toHaveBeenCalledTimes(2);
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
    expect(screen.getByText(/leia este aviso e confirme para continuar/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Concluir seleção e adicionar NF ao lote' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ciente, continuar para tipo e produtos' }));

    expect(await screen.findByText('Selecione os produtos e adicione ao lote')).toBeInTheDocument();
    expect(screen.getByTestId('return-base-compact-reminder')).toHaveTextContent('NF não localizada na base de devoluções');
    expect(screen.getByTestId('return-base-compact-reminder')).not.toHaveTextContent('Base atualizada em');
    expect(screen.getByRole('button', { name: 'Concluir seleção e adicionar NF ao lote' })).toBeEnabled();
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
    fireEvent.click(screen.getByRole('button', { name: 'Ver ocorrências' }));
    expect(await screen.findByText('ID OC-10')).toBeInTheDocument();
    await continueAfterReturnLookup();
    expect(screen.getByRole('button', { name: 'Concluir seleção e adicionar NF ao lote' })).toBeEnabled();
    expect(screen.getByTestId('return-base-compact-reminder')).toHaveTextContent('2 ocorrências aprovadas');
  });
});
