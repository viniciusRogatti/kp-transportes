import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';

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

describe('RoutePlanning - autocomplete de atribuicao', () => {
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
    expect(await screen.findByText(/NF 8888/)).toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringMatching(/\/danfes$/), expect.objectContaining({ params: expect.objectContaining({ view: 'routing', includeRoutingBacklog: true }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: /Sair do modo edição/ }));
    expect(screen.queryByText(/Modo edição: rota/)).not.toBeInTheDocument();
  });

});
