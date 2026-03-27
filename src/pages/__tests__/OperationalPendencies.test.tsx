import { render, screen } from '@testing-library/react';
import OperationalPendencies from '../OperationalPendencies';
import {
  listDriversForReceiptFilters,
  listReceiptBacklog,
} from '../../services/receiptsService';
import verifyToken from '../../utils/verifyToken';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
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

describe('OperationalPendencies', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'token-teste');
    mockedVerifyToken.mockResolvedValue(true as never);
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
        pending: 1,
        retained: 0,
        returned: 0,
        cancelled: 0,
        unassigned: 0,
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
  });
});
