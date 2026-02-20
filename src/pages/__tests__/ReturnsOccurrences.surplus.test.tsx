import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

function renderPage() {
  return render(
    <MemoryRouter>
      <ReturnsOccurrences />
    </MemoryRouter>,
  );
}

describe('ReturnsOccurrences - sobra com inversao', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.put.mockReset();
    mockedAxios.delete.mockReset();
    (mockedAxios as any).defaults = { headers: { common: {} } };

    mockedVerifyToken.mockReset();
    mockedVerifyToken.mockResolvedValue(true);

    mockedAxios.post.mockImplementation((url: string) => {
      if (url.includes('/returns/batches/create')) {
        return Promise.resolve({ data: { batch_code: 'RET-TESTE-1' } });
      }
      return Promise.resolve({ data: {} });
    });

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

  it('renderiza campos condicionais de inversao e limpa ao desligar toggle', async () => {
    renderPage();

    await screen.findByText('NF + tipo de devolucao');

    fireEvent.click(screen.getByLabelText('Sobra'));

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

    await screen.findByText('NF + tipo de devolucao');

    fireEvent.click(screen.getByLabelText('Sobra'));

    fireEvent.change(screen.getByPlaceholderText('Ex.: CARGA-123'), { target: { value: 'CARGA-123' } });
    fireEvent.change(screen.getByPlaceholderText('Ex.: RV001496'), { target: { value: 'RV001496' } });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar sobra na lista' }));

    const motoristaField = screen.getByText('Motorista').closest('div');
    const veiculoField = screen.getByText('Veiculo / Placa').closest('div');
    expect(motoristaField).toBeTruthy();
    expect(veiculoField).toBeTruthy();

    fireEvent.change(within(motoristaField as HTMLElement).getByRole('combobox'), { target: { value: '1' } });
    fireEvent.change(within(veiculoField as HTMLElement).getByRole('combobox'), { target: { value: '1' } });

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
});
