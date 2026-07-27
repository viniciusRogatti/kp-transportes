import { render, screen } from '@testing-library/react';
import axios from 'axios';
import OperationalPendencies from '../OperationalPendencies';
import {
  listDriversForReceiptFilters,
  listReceiptBacklog,
} from '../../services/receiptsService';
import verifyToken from '../../utils/verifyToken';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    isAxiosError: jest.fn(() => false),
  },
}));
jest.mock('browser-image-compression', () => jest.fn(async (file) => file));
jest.mock('../../components/Header', () => () => <div>Header</div>);
jest.mock('react-router', () => ({
  useNavigate: () => jest.fn(),
}));
jest.mock('../../utils/verifyToken');
jest.mock('../../services/receiptsService', () => ({
  listDriversForReceiptFilters: jest.fn(),
  listReceiptBacklog: jest.fn(),
  uploadReceipt: jest.fn(),
}));

const mockedVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockedListDriversForReceiptFilters = listDriversForReceiptFilters as jest.MockedFunction<typeof listDriversForReceiptFilters>;
const mockedListReceiptBacklog = listReceiptBacklog as jest.MockedFunction<typeof listReceiptBacklog>;
const mockedAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;

describe('OperationalPendencies', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'token-teste');
    mockedVerifyToken.mockResolvedValue(true as never);
    mockedAxiosGet.mockResolvedValue({ data: [] });
    mockedListDriversForReceiptFilters.mockResolvedValue([]);
    mockedListReceiptBacklog.mockResolvedValue({
      rows: [
        {
          queue_type: 'pending',
          nf_id: '1725001',
          invoice_number: '1725001',
          customer_id: '501',
          status: 'PENDING',
          source_status: 'redelivery',
          latest_stop_status: 'redelivery',
          invoice_date: '2026-03-23',
          load_number: 'CARGA-99',
          customer_name: 'Cliente Teste',
          city: 'Campinas',
          trip_note_id: 41,
          trip_id: 88,
          rota_id: 88,
          trip_date: '2026-03-25',
          motorista_id: 7,
          motorista_name: 'Arlindo',
          has_receipt: false,
          receipt_id: null,
          receipt_created_at: null,
          age_days: 2,
          can_upload: true,
          route_history: [
            {
              trip_id: 88,
              trip_note_id: 41,
              trip_date: '2026-03-25',
              motorista_id: 7,
              motorista_name: 'Arlindo',
              note_status: 'redelivery',
              created_at: '2026-03-25T18:30:00.000Z',
              updated_at: '2026-03-25T18:35:00.000Z',
            },
            {
              trip_id: 77,
              trip_note_id: 39,
              trip_date: '2026-03-24',
              motorista_id: 5,
              motorista_name: 'Jonas',
              note_status: 'assigned',
              created_at: '2026-03-24T09:00:00.000Z',
              updated_at: '2026-03-24T09:05:00.000Z',
            },
          ],
        },
      ],
      total: 1,
      limit: 200,
      cutoff_date: '2026-03-23',
      summary: {
        redelivery: 1,
        unassigned: 0,
        returned: 0,
        retained: 0,
        pending: 1,
        total: 1,
      },
    } as any);
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('exibe o historico de saidas da NF em reentrega sem esconder a saida atual', async () => {
    render(<OperationalPendencies />);

    expect(await screen.findByText('NF 1725001')).toBeInTheDocument();
    expect(screen.getByText('Historico de saidas (2)')).toBeInTheDocument();
    expect(screen.getByText('Saida atual')).toBeInTheDocument();
    expect(screen.getByText('Motorista: Arlindo · Trip: 88')).toBeInTheDocument();
    expect(screen.getByText('Motorista: Jonas · Trip: 77')).toBeInTheDocument();
    expect(screen.getByText('Corrigir status')).toBeInTheDocument();
    expect(screen.getByText('Marcar canhoto retido')).toBeInTheDocument();
  });

  it('exibe apenas uma linha quando a API retorna a mesma NF retida mais de uma vez', async () => {
    mockedListReceiptBacklog.mockResolvedValueOnce({
      rows: [
        {
          queue_type: 'retained', nf_id: '01817267', invoice_number: '01817267', status: 'PENDING',
          source_status: 'retained', latest_stop_status: 'retained', has_receipt: false, can_upload: true,
        },
        {
          queue_type: 'retained', nf_id: '1817267', invoice_number: '1817267', status: 'PENDING',
          source_status: 'retained', latest_stop_status: 'retained', has_receipt: false, can_upload: true,
        },
      ],
      total: 2,
      limit: 200,
      cutoff_date: '2026-03-23',
      summary: { redelivery: 0, unassigned: 0, returned: 0, retained: 2, pending: 0, total: 2 },
    } as any);

    render(<OperationalPendencies />);

    expect(await screen.findByText('NF 01817267')).toBeInTheDocument();
    expect(screen.queryByText('NF 1817267')).not.toBeInTheDocument();
    expect(screen.getByText('1 NF(s) exibidas')).toBeInTheDocument();
  });

  it('centraliza as ocorrencias abertas e sinaliza as vencidas', async () => {
    mockedAxiosGet.mockResolvedValueOnce({
      data: [{
        id: 91,
        invoice_number: '1819001',
        customer_name: 'Mercado Central',
        city: 'Campinas',
        reason: 'produto_avariado',
        status: 'pending',
        created_at: '2026-03-20T10:00:00.000Z',
        age_business_days: 4,
      }],
    });

    render(<OperationalPendencies />);

    expect(await screen.findByText('NF 1819001')).toBeInTheDocument();
    expect(screen.getByText('Produto avariado')).toBeInTheDocument();
    expect(screen.getByText('4 dia(s) em aberto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir tratativa/i })).toBeInTheDocument();
  });
});
