import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';

import RoutePlanning from '../RoutePlanning';
import verifyToken from '../../utils/verifyToken';

jest.mock('axios');
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
        ] });
      }
      if (url.includes('/cars')) {
        return Promise.resolve({ data: [
          { id: 10, model: 'Volvo FH', license_plate: 'ABC-1234' },
          { id: 11, model: 'Scania R', license_plate: 'XYZ-9876' },
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

    const carInput = screen.getByPlaceholderText('Digite placa ou veículo');
    fireEvent.change(carInput, { target: { value: '1234' } });

    const carOption = await screen.findByRole('option', { name: 'Volvo FH - ABC-1234 - Disponível' });
    fireEvent.click(carOption);

    await waitFor(() => expect(carInput).toHaveValue('Volvo FH - ABC-1234'));
  });
});
