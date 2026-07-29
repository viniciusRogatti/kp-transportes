import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ReturnDataRegistry from '../ReturnDataRegistry';
import verifyToken from '../../utils/verifyToken';

jest.mock('axios');
jest.mock('../../utils/verifyToken');
jest.mock('../../components/Header', () => () => <div>Header</div>);
jest.mock('echarts-for-react', () => () => <div data-testid="chart" />);
jest.mock('react-router', () => ({
  useNavigate: () => jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

const overview = {
  metrics: {
    total_occurrences: 4,
    distinct_invoices: 3,
    approved_occurrences: 2,
    rejected_occurrences: 1,
    unknown_occurrences: 1,
    approval_rate: 50,
    involved_value: 1500,
    distinct_customers: 3,
    unlinked_occurrences: 2,
  },
  charts: {
    customers: [{ label: 'Cliente A', count: 2 }],
    reasons: [{ label: 'Mercadoria faltante', count: 2 }],
    sellers: [{ label: 'Representante A', count: 2 }],
    products: [{ label: 'Produto A', count: 2 }],
    return_types: [{ label: 'partial', count: 2 }],
    approval_statuses: [{ label: 'approved', count: 2 }],
  },
  latest_import: {
    id: 1,
    original_file_name: 'base.xlsx',
    imported_at: '2026-07-29T14:30:00.000Z',
  },
};

describe('ReturnDataRegistry', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'token-teste');
    localStorage.setItem('user_permission', 'admin');
    mockedVerifyToken.mockResolvedValue(true as never);
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/occurrences/overview')) return Promise.resolve({ data: overview });
      if (url.endsWith('/return-data/imports')) return Promise.resolve({ data: [] });
      if (url.endsWith('/return-data/occurrences')) {
        return Promise.resolve({
          data: {
            rows: [],
            total: 0,
            page: 1,
            limit: 25,
            total_pages: 1,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
    mockedAxios.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('exibe indicadores e acesso às três abas', async () => {
    render(<ReturnDataRegistry />);

    expect(await screen.findByText('Base de devoluções')).toBeInTheDocument();
    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.getByText('NFs distintas')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.500,00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /visão geral/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ocorrências/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /importações/i })).toBeInTheDocument();
  });

  it('pré-visualiza o arquivo antes de permitir confirmar a importação', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        duplicate_file: false,
        file_name: 'base.xlsx',
        file_sha256: 'hash',
        total_rows: 12,
        total_occurrences: 10,
        created_occurrences: 7,
        updated_occurrences: 2,
        unchanged_occurrences: 1,
        approved_count: 8,
        rejected_count: 2,
        invalid_occurrences: 0,
        warnings_count: 0,
        errors_count: 0,
      },
    });

    render(<ReturnDataRegistry />);
    fireEvent.click(await screen.findByRole('button', { name: /importações/i }));

    const file = new File(['xlsx'], 'base.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(screen.getByLabelText('Planilha da base de devoluções'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: /pré-visualizar/i }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/return-data/imports/preview'),
        expect.any(FormData),
      );
    });
    expect(await screen.findByText('10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar importação/i })).toBeInTheDocument();
  });
});
