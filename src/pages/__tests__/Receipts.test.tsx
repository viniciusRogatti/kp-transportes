import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import Receipts from '../Receipts';
import {
  listDriversForReceiptFilters,
  listPendingReceipts,
  listWhatsappReceiptActivity,
  updateReceiptManualReview,
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
  listPendingReceipts: jest.fn(),
  listWhatsappReceiptActivity: jest.fn(),
  updateReceiptManualReview: jest.fn(),
  uploadReceipt: jest.fn(),
}));

const mockedVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockedListDriversForReceiptFilters = listDriversForReceiptFilters as jest.MockedFunction<typeof listDriversForReceiptFilters>;
const mockedListPendingReceipts = listPendingReceipts as jest.MockedFunction<typeof listPendingReceipts>;
const mockedListWhatsappReceiptActivity = listWhatsappReceiptActivity as jest.MockedFunction<typeof listWhatsappReceiptActivity>;
const mockedUpdateReceiptManualReview = updateReceiptManualReview as jest.MockedFunction<typeof updateReceiptManualReview>;

describe('Receipts', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'token-teste');
    mockedVerifyToken.mockResolvedValue(true as never);
    mockedListDriversForReceiptFilters.mockResolvedValue([]);
    mockedListPendingReceipts.mockResolvedValue({
      rows: [],
      total: 0,
      limit: 120,
    });
    mockedListWhatsappReceiptActivity.mockImplementation(async (filters: any = {}) => {
      if (filters.status === 'review') {
        return {
          rows: [{
            id: 'alert-1',
            event_id: null,
            alert_id: 1,
            kind: 'review',
            processing_status: 'REVIEW',
            invoice_number: '1722444',
            title: 'Canhoto exige revisao',
            message: 'Aguardando tratativa.',
            occurred_at: '2026-03-26T10:00:00.000Z',
            receipt: {
              id: 88,
              nf_id: '1722444',
              needs_manual_review: true,
            },
            danfe: {
              invoice_number: '1722444',
              status: 'assigned',
              customer_name: 'Cliente Teste',
              city: 'Sao Paulo',
            },
          }],
          total: 1,
          limit: 160,
          summary: {
            total: 1,
            success: 0,
            review: 1,
            error: 0,
          },
        };
      }

      return {
        rows: [{
          id: 'alert-1',
          event_id: null,
          alert_id: 1,
          kind: 'review',
          processing_status: 'REVIEW',
          invoice_number: '1722444',
          title: 'Canhoto exige revisao',
          message: 'Aguardando tratativa.',
          occurred_at: '2026-03-26T10:00:00.000Z',
          receipt: {
            id: 88,
            nf_id: '1722444',
            needs_manual_review: true,
          },
          danfe: {
            invoice_number: '1722444',
            status: 'assigned',
            customer_name: 'Cliente Teste',
            city: 'Sao Paulo',
          },
        }],
        total: 1,
        limit: 250,
        summary: {
          total: 1,
          success: 0,
          review: 1,
          error: 0,
        },
      };
    });
    mockedUpdateReceiptManualReview.mockResolvedValue({
      id: 88,
      nf_id: '1722444',
      trip_id: null,
      motorista_id: null,
      r2_key: 'receipt-key',
      mime_type: 'image/jpeg',
      size_bytes: 123,
      width: 1200,
      height: 900,
      status: 'POSTED',
      needs_manual_review: false,
      created_at: '2026-03-26T10:00:00.000Z',
    } as any);
    window.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('permite baixar a revisao manual quando o item possui canhoto vinculado', async () => {
    render(<Receipts />);

    const button = await screen.findByRole('button', { name: 'Marcar como validado' });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockedUpdateReceiptManualReview).toHaveBeenCalledWith(88, false);
    });

    expect(window.confirm).toHaveBeenCalledWith(
      'Marcar o canhoto da NF 1722444 como validado e remover da revisão manual?',
    );
  });
});
