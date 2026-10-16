import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { pdf } from '@react-pdf/renderer';

import RoutePlanning from '../RoutePlanning';
import verifyToken from '../../utils/verifyToken';
import GlobalAlertHost from '../../components/ui/GlobalAlertHost';

jest.mock('axios');
jest.mock('../../hooks/useRouteCatalog', () => () => ({ data: { routes: [{ id: 'campinas', name: 'Campinas', cities: ['Campinas'] }] }, isLoading: false, isError: false }));
jest.mock('../../utils/verifyToken');
jest.mock('../../components/Header', () => () => <div data-testid="header" />);
jest.mock('../../components/Popup', () => () => null);
jest.mock('../../components/ProductListPDF', () => () => null);
jest.mock('../../components/SalmonLoadListPDF', () => () => null);
jest.mock('@react-pdf/renderer', () => ({
  pdf: jest.fn(() => ({
    toBlob: jest.fn(),
  })),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedVerifyToken = verifyToken as jest.Mock;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/routePlanning']}>
      <GlobalAlertHost />
      <RoutePlanning />
    </MemoryRouter>,
  );
}

async function openEdition() {
  const originalGet = mockedAxios.get.getMockImplementation()!;
  const trip = {
    id: 77, date: formatTestDate(), driver_id: 1, car_id: 10, run_number: 2, gross_weight: '10',
    Driver: { id: 1, name: 'João da Silva' }, Car: { id: 10, model: 'Volvo FH', license_plate: 'ABC-1234' },
    TripNotes: [
      { id: 11, company_id: 1, invoice_number: '123', customer_name: 'Cliente Mar', city: 'Campinas', order: 1, status: 'assigned', gross_weight: '3' },
      { id: 12, company_id: 2, invoice_number: '123', customer_name: 'Cliente Pronto', city: 'Campinas', order: 2, status: 'assigned', gross_weight: '3' },
      { id: 13, company_id: 1, invoice_number: '456', customer_name: 'Cliente entregue', city: 'Campinas', order: 3, status: 'delivered', gross_weight: '4' },
    ],
  };
  mockedAxios.get.mockImplementation((url: string, config?: any) => {
    if (url.includes('/trips/search/date/')) return Promise.resolve({ data: [trip] });
    if (url.endsWith('/danfes')) return Promise.resolve({ data: [
      { invoice_number: '999', company_id: 1, status: 'pending', invoice_date: '2026-01-01', gross_weight: '15', Customer: { name_or_legal_entity: 'Cliente disponível', city: 'Campinas' }, DanfeProducts: [] },
    ] });
    return originalGet(url, config);
  });
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Viagens' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Editar rota' }));
  await screen.findByText(/Modo edição: rota #77/);
  expect(await screen.findAllByLabelText('Editar ordem da NF 123')).toHaveLength(2);
  return { trip };
}

function formatTestDate() {
  const date = new Date();
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

describe('RoutePlanning - autocomplete de atribuicao', () => {
  it('atualiza canhotos e ocorrências ao imprimir, pagina e sinaliza falha sem usar ocorrência antiga', async () => {
    const trip = { id: 88, date: formatTestDate(), Driver: { name: 'Motorista teste' }, Car: { license_plate: 'TEST000' }, TripNotes: [{ invoice_number: '2000000', company_id: 1 }] };
    const danfe = { invoice_number: '2000000', company_id: 1, company: { code: 'mar_e_rio' }, customer_id: 'C1', Customer: { name_or_legal_entity: 'Cliente teste', city: 'Campinas' }, DanfeProducts: [] };
    let resolved = false;
    let failed = false;
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/trips/search/date/')) return Promise.resolve({ data: [trip] });
      if (url.includes('/danfes/batch')) return Promise.resolve({ data: [danfe] });
      if (url.includes('/api/receipts/backlog')) {
        const offset = new URL(url).searchParams.get('offset');
        return Promise.resolve({ data: { total: 2, rows: [{ company_id: 1, invoice_number: offset === '1' ? '1886686' : '999', customer_id: offset === '1' ? 'C1' : 'C2', city: 'Campinas', queue_type: 'retained', status: 'PENDING' }] } });
      }
      if (url.includes('/occurrences/search')) return failed ? Promise.reject(new Error('offline')) : Promise.resolve({ data: [{ id: 99, company_id: 1, invoice_number: '1886686', customer_id: 'C1', status: resolved ? 'resolved' : 'pending', reason: 'faltou_na_carga', age_business_days: 4, items: [{ product_id: 'P1', quantity: 2, product_type: 'CX' }] }] });
      return Promise.resolve({ data: [] });
    });
    const createUrl = URL.createObjectURL;
    const revokeUrl = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:preview');
    URL.revokeObjectURL = jest.fn();
    const open = jest.spyOn(window, 'open').mockReturnValue(null);
    (pdf as jest.Mock).mockClear();
    (pdf as jest.Mock).mockReturnValue({ toBlob: jest.fn().mockResolvedValue(new Blob()) });
    try {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Viagens' }));
      const print = await screen.findByRole('button', { name: 'Imprimir produtos' });
      fireEvent.click(print);
      await waitFor(() => expect(pdf).toHaveBeenCalledTimes(1));
      expect((pdf as jest.Mock).mock.calls[0][0].props.retainedReminders.find((item: any) => item.retainedInvoiceNumber === '1886686').linkedOccurrences).toHaveLength(1);
      expect((pdf as jest.Mock).mock.calls[0][0].props.occurrenceReminders).toHaveLength(0);
      resolved = true;
      fireEvent.click(print);
      await waitFor(() => expect(pdf).toHaveBeenCalledTimes(2));
      expect((pdf as jest.Mock).mock.calls[1][0].props.retainedReminders.every((item: any) => item.linkedOccurrences.length === 0)).toBe(true);
      failed = true;
      fireEvent.click(print);
      await waitFor(() => expect(pdf).toHaveBeenCalledTimes(3));
      expect((pdf as jest.Mock).mock.calls[2][0].props.reminderLookupWarning).toContain('Não foi possível conferir');
    } finally {
      open.mockRestore();
      URL.createObjectURL = createUrl;
      URL.revokeObjectURL = revokeUrl;
    }
  });
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.put.mockReset();
    mockedAxios.delete.mockReset();
    mockedVerifyToken.mockResolvedValue(true);
    localStorage.setItem('token', 'token-teste');

    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/drivers')) {
        return Promise.resolve({ data: [
          { id: 1, name: 'João da Silva' },
          { id: 2, name: 'Maria Conferência' },
          { id: 3, name: 'Marcus Vinicius' },
          { id: 4, name: 'Vinicius Mota' },
        ] });
      }
      if (url.includes('/cars')) {
        return Promise.resolve({ data: [
          { id: 10, model: 'Volvo FH', license_plate: 'ABC-1234' },
          { id: 11, model: 'Scania R', license_plate: 'XYZ-9876' },
          { id: 12, model: 'Mercedes Atego', license_plate: 'VIN-1000' },
          { id: 13, model: 'Volkswagen Delivery', license_plate: 'VIN-2000' },
        ] });
      }
      if (url.includes('/trips/search/date/')) {
        return Promise.reject(new Error('Falha temporária ao carregar rotas'));
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('exibe e seleciona motorista e veículo ao digitar, inclusive sem acento', async () => {
    renderPage();

    const driverInput = await screen.findByPlaceholderText('Digite nome do motorista');
    fireEvent.focus(driverInput);
    fireEvent.change(driverInput, { target: { value: 'joao' } });

    const driverOption = await screen.findByRole('option', { name: 'João da Silva - Disponível' });
    fireEvent.click(driverOption);

    await waitFor(() => expect(driverInput).toHaveValue('João da Silva'));
    await waitFor(() => expect(screen.getByPlaceholderText('Digite NF ou código de barras')).toHaveFocus());

    const carInput = screen.getByPlaceholderText('Digite placa ou veículo');
    fireEvent.change(carInput, { target: { value: '1234' } });

    const carOption = await screen.findByRole('option', { name: 'Volvo FH - ABC-1234 - Disponível' });
    fireEvent.click(carOption);

    await waitFor(() => expect(carInput).toHaveValue('Volvo FH - ABC-1234'));
  });

  it('mantém a opção clicada quando há mais de um motorista ou veículo correspondente', async () => {
    renderPage();

    const driverInput = await screen.findByPlaceholderText('Digite nome do motorista');
    fireEvent.focus(driverInput);
    fireEvent.change(driverInput, { target: { value: 'vin' } });

    const secondDriverOption = await screen.findByRole('option', { name: 'Vinicius Mota - Disponível' });
    fireEvent.click(secondDriverOption);

    await waitFor(() => expect(driverInput).toHaveValue('Vinicius Mota'));

    const carInput = screen.getByPlaceholderText('Digite placa ou veículo');
    fireEvent.change(carInput, { target: { value: 'VIN' } });

    const secondCarOption = await screen.findByRole('option', {
      name: 'Volkswagen Delivery - VIN-2000 - Disponível',
    });
    fireEvent.click(secondCarOption);

    await waitFor(() => expect(carInput).toHaveValue('Volkswagen Delivery - VIN-2000'));
  });
  it('devolve o foco à NF após confirmar o motorista com Enter e fechar um aviso', async () => {
    renderPage();
    const driver = await screen.findByPlaceholderText('Digite nome do motorista');
    fireEvent.change(driver, { target: { value: 'joao' } });
    await screen.findByRole('option', { name: 'João da Silva - Disponível' });
    fireEvent.keyDown(driver, { key: 'Enter' });
    const lookup = screen.getByPlaceholderText('Digite NF ou código de barras');
    await waitFor(() => expect(lookup).toHaveFocus());
    fireEvent.keyDown(lookup, { key: 'Enter' });
    const ok = await screen.findByRole('button', { name: 'Entendi' });
    fireEvent.click(ok);
    await waitFor(() => expect(lookup).toHaveFocus());
  });

  it('bloqueia o scroll da página na roteirização e mantém o scroll na caixa de NFs', async () => {
    renderPage();

    await screen.findByPlaceholderText('Digite NF ou código de barras');
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    expect(screen.getByLabelText('Notas adicionadas à viagem')).toHaveClass('overflow-y-auto');

    fireEvent.click(screen.getByRole('button', { name: 'Viagens' }));
    await waitFor(() => expect(document.body.style.overflow).toBe(''));
  });

  it('adiciona somente as notas disponíveis da rota escolhida e não as duplica', async () => {
    const originalGet = mockedAxios.get.getMockImplementation()!;
    mockedAxios.get.mockImplementation((url: string, config?: any) => {
      if (url.includes('/trips/search/date/')) return Promise.resolve({ data: [] });
      if (url.endsWith('/danfes')) return Promise.resolve({ data: [
        { invoice_number: '9001', company_id: 1, status: 'pending', gross_weight: '15', Customer: { name_or_legal_entity: 'Cliente Campinas', city: 'Campinas' }, DanfeProducts: [] },
        { invoice_number: '9002', company_id: 1, status: 'pending', gross_weight: '20', Customer: { name_or_legal_entity: 'Cliente Santos', city: 'Santos' }, DanfeProducts: [] },
      ] });
      return originalGet(url, config);
    });
    renderPage();
    const driver = await screen.findByPlaceholderText('Digite nome do motorista');
    fireEvent.change(driver, { target: { value: 'joao' } });
    await screen.findByRole('option', { name: 'João da Silva - Disponível' });
    fireEvent.keyDown(driver, { key: 'Enter' });
    fireEvent.change(screen.getByPlaceholderText('Digite placa ou veículo'), { target: { value: '1234' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Volvo FH - ABC-1234 - Disponível' }));
    fireEvent.click(screen.getByRole('button', { name: 'Por rota' }));
    const route = screen.getByLabelText('Selecionar rota planejada');
    await screen.findByRole('option', { name: /Campinas · 1 nota/ });
    fireEvent.change(route, { target: { value: 'campinas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar rota' }));
    expect(screen.getByLabelText('Editar ordem da NF 9001')).toBeInTheDocument();
    expect(screen.queryByLabelText('Editar ordem da NF 9002')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar rota' })).toBeDisabled();
    await waitFor(() => expect(screen.getByPlaceholderText('Digite NF ou código de barras')).toHaveFocus());
  });

  it('mantém a nota recém-bipada visível mesmo quando a lista estava longe do fim', async () => {
    const originalGet = mockedAxios.get.getMockImplementation()!;
    mockedAxios.get.mockImplementation((url: string, config?: any) => {
      if (url.includes('/trips/search/date/')) return Promise.resolve({ data: [] });
      if (url.includes('/danfes/nf/9003')) return Promise.resolve({ data: {
        invoice_number: '9003',
        company_id: 1,
        status: 'pending',
        gross_weight: '12',
        Customer: { name_or_legal_entity: 'Cliente bipada', city: 'Campinas' },
        DanfeProducts: [],
      } });
      return originalGet(url, config);
    });

    renderPage();
    const driver = await screen.findByPlaceholderText('Digite nome do motorista');
    fireEvent.change(driver, { target: { value: 'joao' } });
    fireEvent.click(await screen.findByRole('option', { name: 'João da Silva - Disponível' }));
    const car = screen.getByPlaceholderText('Digite placa ou veículo');
    fireEvent.change(car, { target: { value: '1234' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Volvo FH - ABC-1234 - Disponível' }));

    const notesContainer = screen.getByLabelText('Notas adicionadas à viagem');
    Object.defineProperty(notesContainer, 'scrollHeight', { configurable: true, value: 600 });
    Object.defineProperty(notesContainer, 'clientHeight', { configurable: true, value: 200 });
    notesContainer.scrollTop = 0;
    fireEvent.scroll(notesContainer);

    const lookup = screen.getByPlaceholderText('Digite NF ou código de barras');
    fireEvent.change(lookup, { target: { value: '9003' } });
    fireEvent.keyDown(lookup, { key: 'Enter' });

    expect(await screen.findByLabelText('Editar ordem da NF 9003')).toBeInTheDocument();
    await waitFor(() => expect(notesContainer.scrollTop).toBe(600));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Ir para a última/ })).not.toBeInTheDocument());
  });

  it('consulta pendências anteriores na edição e permite sair do modo de edição', async () => {
    const originalGet = mockedAxios.get.getMockImplementation()!;
    const date = new Date();
    const dateLabel = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    const trip = { id: 77, date: dateLabel, driver_id: 1, car_id: 10, run_number: 1, gross_weight: '10', Driver: { id: 1, name: 'João da Silva' }, Car: { id: 10, model: 'Volvo FH', license_plate: 'ABC-1234' }, TripNotes: [] };
    mockedAxios.get.mockImplementation((url: string, config?: any) => {
      if (url.includes('/trips/search/date/')) return Promise.resolve({ data: [trip] });
      if (url.endsWith('/danfes')) return Promise.resolve({ data: config?.params?.includeRoutingBacklog ? [
        { invoice_number: '8888', company_id: 1, status: 'redelivery', invoice_date: '2026-01-01', gross_weight: '15', Customer: { name_or_legal_entity: 'Cliente antigo', city: 'Campinas' }, DanfeProducts: [] },
      ] : [] });
      return originalGet(url, config);
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Viagens' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Editar rota' }));
    expect(await screen.findByText(/Modo edição: rota #77/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Editar viagem' })).not.toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringMatching(/\/danfes$/), expect.objectContaining({ params: expect.objectContaining({ view: 'routing', includeRoutingBacklog: true }) }));
    expect(screen.queryByLabelText('Selecionar cidade')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exibir' }));
    expect(await screen.findByRole('option', { name: /Campinas · 1 nota/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sair do modo edição/ }));
    expect(screen.queryByText(/Modo edição: rota/)).not.toBeInTheDocument();
  });

  it('mostra os cards diretamente, mantém notas finalizadas bloqueadas e preserva a NF homônima no rascunho', async () => {
    await openEdition();
    const list = within(screen.getByLabelText('Notas adicionadas à viagem'));
    expect(list.getByText(/Cliente Mar/)).toBeInTheDocument();
    expect(list.getByText(/Cliente Pronto/)).toBeInTheDocument();
    expect(list.getAllByRole('button', { name: 'Remover' })[2]).toBeDisabled();
    fireEvent.click(list.getAllByRole('button', { name: 'Remover' })[0]);
    await waitFor(() => {
      const updatedList = within(screen.getByLabelText('Notas adicionadas à viagem'));
      expect(updatedList.queryByText(/Cliente Mar/)).not.toBeInTheDocument();
      expect(updatedList.getByText(/Cliente Pronto/)).toBeInTheDocument();
    });
    expect(mockedAxios.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sair do modo edição/ }));
    expect(mockedAxios.put).not.toHaveBeenCalled();
  });

  it('envia juntas as retiradas do modo de edição somente ao atualizar a viagem', async () => {
    await openEdition();
    mockedAxios.put.mockResolvedValue({ data: {} });
    const list = within(screen.getByLabelText('Notas adicionadas à viagem'));
    fireEvent.click(list.getAllByRole('button', { name: 'Remover' })[0]);
    fireEvent.click(within(screen.getByLabelText('Notas adicionadas à viagem')).getAllByRole('button', { name: 'Remover' })[0]);
    expect(mockedAxios.put).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Não imprimir' }));

    await waitFor(() => expect(mockedAxios.put).toHaveBeenCalledWith(expect.stringMatching(/\/trips\/remove-note\/77$/),
      { noteIds: [11, 12] }, expect.objectContaining({ headers: expect.any(Object) })));
  });

});
