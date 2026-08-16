import { act, render, screen, waitFor } from '@testing-library/react';
import AlertsPage from '../Alerts';
import { listAlertHistory } from '../../services/alertsService';
import verifyToken from '../../utils/verifyToken';

let mockLastReceivedAt: string | null = null;
let mockLastAlertUpdateAt: string | null = null;

jest.mock('../../components/Header', () => () => <div>Header</div>);
jest.mock('react-router', () => ({
  useNavigate: () => jest.fn(),
}));
jest.mock('../../utils/verifyToken');
jest.mock('../../services/alertsService', () => ({
  listAlertHistory: jest.fn(),
  resolveAlertHistoryRow: jest.fn(),
}));
jest.mock('../../providers/RealtimeNotificationsProvider', () => ({
  useRealtimeNotifications: () => ({
    lastReceivedAt: mockLastReceivedAt,
    lastAlertUpdateAt: mockLastAlertUpdateAt,
  }),
}));

const mockedListAlertHistory = listAlertHistory as jest.MockedFunction<typeof listAlertHistory>;
const mockedVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

const historyResponse = {
  rows: [{
    id: 'ALERT:12',
    record_id: 12,
    source: 'ALERT' as const,
    category: 'ALERTA_TECNICO' as const,
    code: 'NF_NOT_FOUND_UPLOAD_ATTEMPT',
    title: 'NF não encontrada',
    message: 'A foto enviada não permitiu localizar a NF 123456.',
    severity: 'WARNING' as const,
    status: 'OPEN' as const,
    entity: { kind: 'invoice', id: '123456', label: 'NF 123456' },
    metadata: {},
    action_url: null,
    resolution_mode: 'manual' as const,
    can_resolve: true,
    read: null,
    resolved_at: null,
    resolved_reason: null,
    resolved_by_user: null,
    created_at: '2026-08-16T12:00:00.000Z',
    updated_at: '2026-08-16T12:00:00.000Z',
  }],
  total: 1,
  available: 1,
  limit: 500,
  summary: {
    total: 1,
    open: 1,
    resolved: 0,
    info: 0,
    warning: 1,
    critical: 0,
  },
};

describe('AlertsPage', () => {
  beforeEach(() => {
    mockLastReceivedAt = null;
    mockLastAlertUpdateAt = null;
    localStorage.setItem('token', 'token-teste');
    mockedVerifyToken.mockResolvedValue(true as never);
    mockedListAlertHistory.mockResolvedValue(historyResponse);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('não recarrega o histórico por notificações globais sem relação com os alertas', async () => {
    const { rerender } = render(<AlertsPage />);

    expect(await screen.findByText(/A foto enviada não permitiu/)).toBeInTheDocument();
    expect(mockedListAlertHistory).toHaveBeenCalledTimes(1);

    mockLastReceivedAt = '2026-08-16T12:01:00.000Z';
    rerender(<AlertsPage />);

    expect(mockedListAlertHistory).toHaveBeenCalledTimes(1);
  });

  it('mantém os cards visíveis e agrupa atualizações em tempo real', async () => {
    const { rerender } = render(<AlertsPage />);

    expect(await screen.findByText(/A foto enviada não permitiu/)).toBeInTheDocument();
    jest.useFakeTimers();

    mockLastAlertUpdateAt = '2026-08-16T12:01:00.000Z';
    rerender(<AlertsPage />);
    mockLastAlertUpdateAt = '2026-08-16T12:01:01.000Z';
    rerender(<AlertsPage />);

    expect(screen.getByText(/A foto enviada não permitiu/)).toBeInTheDocument();
    expect(screen.queryByText('Carregando alertas...')).not.toBeInTheDocument();
    expect(mockedListAlertHistory).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => expect(mockedListAlertHistory).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/A foto enviada não permitiu/)).toBeInTheDocument();
  });
});
