import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import DeliveryMonitoring from '../DeliveryMonitoring';
import { showConfirm } from '../../utils/dialog';

let mockLocationSearch = '';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    isAxiosError: jest.fn(),
  },
}));
jest.mock('react-router', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ search: mockLocationSearch }),
}));
jest.mock('socket.io-client', () => ({
  io: () => ({
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    disconnect: jest.fn(),
  }),
}));
jest.mock('../../components/Header', () => () => <div>Header</div>);
jest.mock('../../components/maps/GoogleDeliveriesMap', () => () => <div data-testid="google-map" />);
jest.mock('../../components/maps/MapMarkerPin', () => ({
  MapMarkerPin: () => <div data-testid="marker-pin" />,
}));
jest.mock('../../utils/alertReadState', () => ({
  getReadAlertIds: () => [],
  subscribeToAlertReadChanges: () => () => undefined,
}));
jest.mock('../../utils/dialog', () => ({
  showConfirm: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedShowConfirm = showConfirm as jest.MockedFunction<typeof showConfirm>;

type MonitoringStatus = 'on_the_way' | 'returned' | 'redelivery' | 'retained';

const buildOverview = (status: MonitoringStatus, date = '2026-03-23') => ({
  date,
  generated_at: '2026-03-23T12:00:00.000Z',
  summary: {
    total: 1,
    unassigned: 0,
    assigned: 0,
    on_the_way: status === 'on_the_way' ? 1 : 0,
    on_site: 0,
    completed: status === 'on_the_way' ? 0 : 1,
    geolocated: 0,
    missing_geolocation: 1,
  },
  deliveries: [
    {
      invoice_number: '123456',
      company: {
        code: 'mar_e_rio',
        name: 'MAR E RIO',
      },
      customer_name: 'Cliente Teste',
      city: 'Campinas',
      state: 'SP',
      neighborhood: 'Centro',
      address: 'Rua A',
      address_number: '100',
      zip_code: '13000-000',
      danfe_status: status,
      stage: status === 'on_the_way' ? 'on_the_way' : 'completed',
      stop_status: status,
      driver_id: 7,
      driver_name: 'Motorista Teste',
      driver_color: '#2563eb',
      trip_id: 11,
      sequence: 1,
      geolocation: {
        latitude: null,
        longitude: null,
        status: 'missing',
        source: null,
        precision_level: 'none',
        last_geocoded_at: null,
      },
    },
  ],
  drivers: [
    {
      trip_id: 11,
      company: {
        code: 'mar_e_rio',
        name: 'MAR E RIO',
      },
      driver_id: 7,
      driver_name: 'Motorista Teste',
      run_number: 1,
      total_deliveries: 1,
      completed_deliveries: status === 'on_the_way' ? 0 : 1,
      progress_pct: status === 'on_the_way' ? 0 : 100,
      stage: status === 'on_the_way' ? 'on_the_way' : 'completed',
      color: '#2563eb',
      current_status: status,
      current_invoice_number: '123456',
      tracking_active: status === 'on_the_way',
      route_completed: status !== 'on_the_way',
      highlighted_stops: [],
      alerts: [],
      stops: [
        {
          note_id: 99,
          invoice_number: '123456',
          sequence: 1,
          status,
        },
      ],
    },
  ],
  alert_summary: {
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
  },
  alerts: [],
});

const buildDiagnostics = (date = '2026-03-23') => ({
  date,
  summary: {
    total: 1,
    problematic: 0,
    duplicated_prefix: 0,
    missing_city_or_state: 0,
    missing_street: 0,
    missing_number: 0,
    missing_zip_code: 0,
  },
});

describe('DeliveryMonitoring', () => {
  beforeEach(() => {
    mockLocationSearch = '';
    let currentStatus: MonitoringStatus = 'on_the_way';

    mockedAxios.get.mockImplementation((url, config) => {
      const requestedDate = String((config as { params?: { date?: string } } | undefined)?.params?.date || '2026-03-23');
      if (String(url).includes('/address-diagnostics')) {
        return Promise.resolve({ data: buildDiagnostics(requestedDate) } as never);
      }
      return Promise.resolve({ data: buildOverview(currentStatus, requestedDate) } as never);
    });

    mockedAxios.post.mockImplementation(async (_url, payload) => {
      currentStatus = String((payload as { status?: string })?.status || 'returned') as MonitoringStatus;
      return { data: { accepted: true } } as never;
    });
    mockedAxios.patch.mockResolvedValue({ data: { status: 'RESOLVED' } } as never);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    mockedShowConfirm.mockResolvedValue(true);
    localStorage.setItem('token', 'token-teste');
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('permite marcar a parada selecionada como devolucao direto no monitoramento', async () => {
    render(<DeliveryMonitoring />);

    const stopButton = await screen.findByRole('button', {
      name: 'Parada 1: NF 123456 • motorista a caminho',
    });

    fireEvent.click(stopButton);
    fireEvent.click(await screen.findByRole('button', {
      name: 'Marcar devolucao da NF 123456',
    }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/driver-app/trip-stops/99/status'),
        expect.objectContaining({
          status: 'returned',
          driver_id: 7,
          driver_name: 'Motorista Teste',
          source: 'delivery_monitoring_manual_update',
          metadata: expect.objectContaining({
            origin: 'delivery_monitoring',
            trip_id: 11,
            invoice_number: '123456',
            sequence: 1,
          }),
        }),
      );
    });

    expect(mockedShowConfirm).toHaveBeenCalledWith(
      'Confirmar devolucao para NF 123456?',
      expect.objectContaining({ title: 'Alterar status da entrega' }),
    );
    expect(await screen.findByText('NF 123456 atualizada com sucesso para devolucao.')).toBeInTheDocument();
  });

  it('permite marcar a parada selecionada como canhoto retido direto no monitoramento', async () => {
    render(<DeliveryMonitoring />);

    const stopButton = await screen.findByRole('button', {
      name: 'Parada 1: NF 123456 • motorista a caminho',
    });

    fireEvent.click(stopButton);
    fireEvent.click(await screen.findByRole('button', {
      name: 'Marcar canhoto retido da NF 123456',
    }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/driver-app/trip-stops/99/status'),
        expect.objectContaining({
          status: 'retained',
          driver_id: 7,
          driver_name: 'Motorista Teste',
          source: 'delivery_monitoring_manual_update',
          metadata: expect.objectContaining({
            origin: 'delivery_monitoring',
            trip_id: 11,
            invoice_number: '123456',
            sequence: 1,
          }),
        }),
      );
    });

    expect(mockedShowConfirm).toHaveBeenCalledWith(
      'Confirmar canhoto retido para NF 123456?',
      expect.objectContaining({ title: 'Alterar status da entrega' }),
    );
    expect(await screen.findByText('NF 123456 atualizada com sucesso para canhoto retido.')).toBeInTheDocument();
  });

  it('permite corrigir canhoto retido para reentrega direto no monitoramento', async () => {
    let currentStatus: MonitoringStatus = 'retained';
    mockedAxios.get.mockImplementation((url, config) => {
      const requestedDate = String((config as { params?: { date?: string } } | undefined)?.params?.date || '2026-03-23');
      if (String(url).includes('/address-diagnostics')) {
        return Promise.resolve({ data: buildDiagnostics(requestedDate) } as never);
      }
      return Promise.resolve({ data: buildOverview(currentStatus, requestedDate) } as never);
    });
    mockedAxios.post.mockImplementation(async (_url, payload) => {
      currentStatus = String((payload as { status?: string })?.status || 'redelivery') as MonitoringStatus;
      return { data: { accepted: true } } as never;
    });

    render(<DeliveryMonitoring />);

    fireEvent.click(await screen.findByRole('button', {
      name: 'Parada 1: NF 123456 • canhoto retido',
    }));
    fireEvent.click(await screen.findByRole('button', {
      name: 'Marcar reentrega da NF 123456',
    }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/driver-app/trip-stops/99/status'),
        expect.objectContaining({
          status: 'redelivery',
          source: 'delivery_monitoring_manual_update',
        }),
      );
    });

    expect(mockedShowConfirm).toHaveBeenCalledWith(
      'Confirmar reentrega para NF 123456?',
      expect.objectContaining({ title: 'Alterar status da entrega' }),
    );
    expect(await screen.findByText('NF 123456 atualizada com sucesso para reentrega.')).toBeInTheDocument();
  });

  it('preserva no celular a data da viagem recebida pelo alerta', async () => {
    mockLocationSearch = '?date=2026-07-15&nf=123456';
    (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(<DeliveryMonitoring />);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/delivery-monitoring'),
        { params: { date: '2026-07-15' } },
      );
    });
  });

  it('nao interpreta uma data brasileira da URL como data da API', async () => {
    mockLocationSearch = '?date=06/08/2026&nf=123456';

    render(<DeliveryMonitoring />);

    await waitFor(() => {
      const monitoringCalls = mockedAxios.get.mock.calls.filter(([url]) => (
        String(url).endsWith('/api/delivery-monitoring')
      ));
      expect(monitoringCalls.length).toBeGreaterThan(0);
      expect(monitoringCalls).not.toContainEqual([
        expect.anything(),
        { params: { date: '2026-08-06' } },
      ]);
    });
  });

  it('permite resolver um alerta diretamente no painel flutuante', async () => {
    mockedAxios.get.mockImplementation((url, config) => {
      const requestedDate = String((config as { params?: { date?: string } } | undefined)?.params?.date || '2026-03-23');
      if (String(url).includes('/address-diagnostics')) {
        return Promise.resolve({ data: buildDiagnostics(requestedDate) } as never);
      }
      const overview = buildOverview('on_the_way', requestedDate);
      overview.alert_summary.total = 1;
      overview.alert_summary.critical = 1;
      overview.alerts = [{
        id: 55,
        code: 'NEXT_DELIVERY_NOT_STARTED',
        title: 'Entrega finalizada sem proxima saida',
        message: 'Motorista Teste nao iniciou a proxima parada.',
        severity: 'CRITICAL',
        status: 'OPEN',
        created_at: '2026-03-23T12:00:00.000Z',
        driver_id: 7,
        trip_id: 11,
        trip_note_id: 99,
        nf_number: '123456',
        metadata: null,
      }];
      return Promise.resolve({ data: overview } as never);
    });

    render(<DeliveryMonitoring />);

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir alertas' }));
    fireEvent.click(await screen.findByRole('button', {
      name: 'Marcar alerta Entrega finalizada sem proxima saida como resolvido',
    }));

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining('/api/alerts/55/resolve'));
      expect(screen.queryByText('Motorista Teste nao iniciou a proxima parada.')).not.toBeInTheDocument();
    });
  });
});
