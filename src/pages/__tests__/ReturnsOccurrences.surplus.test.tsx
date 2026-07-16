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
    (pdf as jest.Mock).mockReturnValue({
      toBlob: jest.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
    });

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
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Unidade do produto da sobra' })).toHaveValue('UN'));

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar sobra na lista' }));

    await screen.findByRole('option', { name: 'Motorista Teste' });
    await screen.findByRole('option', { name: 'Truck - ABC-1234' });
    const driverSelect = screen.getByRole('combobox', { name: 'Motorista da devolucao' });
    const vehicleSelect = screen.getByRole('combobox', { name: 'Veiculo da devolucao' });
    fireEvent.change(driverSelect, { target: { value: '1' } });
    fireEvent.change(vehicleSelect, { target: { value: '1' } });
    expect(driverSelect).toHaveValue('1');
    expect(vehicleSelect).toHaveValue('1');

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

    await screen.findByText('NF + tipo de devolucao');

    fireEvent.click(screen.getByLabelText('Parcial'));
    fireEvent.change(screen.getByPlaceholderText('Digite a NF'), { target: { value: '1754803' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar NF de devolucao' }));

    await screen.findByText('NF carregada: 1754803 | Cliente: Cliente Teste');

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
});
