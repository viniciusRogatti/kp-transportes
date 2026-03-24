import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import DeliveryMonitoring from '../DeliveryMonitoring';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    isAxiosError: jest.fn(),
  },
}));
jest.mock('react-router', () => ({
  useNavigate: () => jest.fn(),
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

const mockedAxios = axios as jest.Mocked<typeof axios>;

type MonitoringStatus = 'on_the_way' | 'returned' | 'retained';

const buildOverview = (status: MonitoringStatus) => ({
  date: '2026-03-23',
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

const diagnostics = {
  date: '2026-03-23',
  summary: {
    total: 1,
    problematic: 0,
    duplicated_prefix: 0,
    missing_city_or_state: 0,
    missing_street: 0,
    missing_number: 0,
    missing_zip_code: 0,
  },
};

describe('DeliveryMonitoring', () => {
  beforeEach(() => {
    let currentStatus: MonitoringStatus = 'on_the_way';

    mockedAxios.get.mockImplementation((url) => {
      if (String(url).includes('/address-diagnostics')) {
        return Promise.resolve({ data: diagnostics } as never);
      }
      return Promise.resolve({ data: buildOverview(currentStatus) } as never);
    });

    mockedAxios.post.mockImplementation(async (_url, payload) => {
      currentStatus = String((payload as { status?: string })?.status || 'returned') as MonitoringStatus;
      return { data: { accepted: true } } as never;
    });

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

    window.confirm = jest.fn(() => true);
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

    expect(window.confirm).toHaveBeenCalledWith('Confirmar devolucao para NF 123456?');
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

    expect(window.confirm).toHaveBeenCalledWith('Confirmar canhoto retido para NF 123456?');
    expect(await screen.findByText('NF 123456 atualizada com sucesso para canhoto retido.')).toBeInTheDocument();
  });
});
