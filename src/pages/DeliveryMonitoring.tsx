import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Check,
  LocateFixed,
  MapPin,
  Navigation,
  Package,
  type LucideIcon,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import GoogleDeliveriesMap, { GoogleCompanyMarker, GoogleMapBoundsPayload } from '../components/maps/GoogleDeliveriesMap';
import Header from '../components/Header';
import { API_URL, COMPANY_LOCATION } from '../data';
import { Container } from '../style/invoices';
import {
  DeliveryStage,
  STAGE_LABELS,
  STAGE_ORDER,
  STAGE_PRIORITY,
  STAGE_STYLE,
} from './deliveryMonitoring/mapStyles';
import {
  toGoogleDeliveryMapItems,
  toGoogleDriverLocations,
  toGoogleDeliveryRoutes,
} from './deliveryMonitoring/googleMapAdapter';

type DeliveryRow = {
  invoice_number: string;
  customer_name: string;
  city: string;
  state: string;
  neighborhood: string;
  address: string;
  address_number: string;
  zip_code: string;
  danfe_status: string;
  stage: DeliveryStage;
  stop_status: string | null;
  driver_id: number | null;
  driver_name: string | null;
  driver_color: string;
  trip_id: number | null;
  sequence: number | null;
  geolocation: {
    latitude: number | null;
    longitude: number | null;
    status: string;
    source: string | null;
    precision_level: string;
    last_geocoded_at: string | null;
  };
};

type DriverSummary = {
  trip_id: number;
  driver_id: number | null;
  driver_name: string;
  run_number: number;
  total_deliveries: number;
  completed_deliveries: number;
  progress_pct: number;
  stage: DeliveryStage | 'idle';
  color: string;
  current_status?: string;
  current_invoice_number?: string | null;
  last_status_changed_at?: string | null;
  last_operational_event_at?: string | null;
  last_delivered_at?: string | null;
  last_delivery_invoice_number?: string | null;
  tracking_active?: boolean;
  route_completed?: boolean;
  next_stop_required_by?: string | null;
  receipt_post_required_by?: string | null;
  live_location?: {
    latitude: number | null;
    longitude: number | null;
    accuracy_meters?: number | null;
    updated_at?: string | null;
  } | null;
  last_location_at?: string | null;
  last_location_age_minutes?: number | null;
  stale_location?: boolean;
  attention_level?: 'INFO' | 'WARNING' | 'CRITICAL' | null;
  open_alerts_count?: number;
  alerts?: MonitoringAlert[];
  highlighted_stops: Array<{
    invoice_number: string;
    sequence: number | null;
    stage: DeliveryStage;
    latitude: number;
    longitude: number;
  }>;
};

type MonitoringSummary = {
  total: number;
  unassigned: number;
  assigned: number;
  on_the_way: number;
  on_site: number;
  completed: number;
  geolocated: number;
  missing_geolocation: number;
};

type MonitoringAlert = {
  id: number;
  code: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'RESOLVED';
  created_at: string | null;
  driver_id: number | null;
  trip_id: number | null;
  trip_note_id: number | null;
  nf_number: string | null;
  metadata?: Record<string, unknown> | null;
};

type MonitoringResponse = {
  date: string;
  invoice_reference_date?: string;
  used_fallback_date?: boolean;
  generated_at: string;
  summary: MonitoringSummary;
  deliveries: DeliveryRow[];
  drivers: DriverSummary[];
  alert_summary?: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  alerts?: MonitoringAlert[];
};

type AddressDiagnosticsResponse = {
  date: string;
  summary: {
    total: number;
    problematic: number;
    duplicated_prefix: number;
    missing_city_or_state: number;
    missing_street: number;
    missing_number: number;
    missing_zip_code: number;
  };
};

const resolveGoogleMapsApiKey = () => {
  const env = process.env as Record<string, string | undefined>;
  return env.REACT_APP_GOOGLE_MAPS_API_KEY || env.VITE_GOOGLE_MAPS_API_KEY || '';
};

const COMPANY_MARKER_ADDRESS = 'Av. Ricardo Bassoli Cezare, 3666 - Jardim Itatinga';

const stagePriority = (stage: DeliveryStage) => {
  return STAGE_PRIORITY[stage] ?? 99;
};

const alertSeverityPriority = (severity?: string | null) => {
  if (severity === 'CRITICAL') return 0;
  if (severity === 'WARNING') return 1;
  if (severity === 'INFO') return 2;
  return 3;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const formatRelativeMinutes = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return 'agora';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
};

const STAGE_ICONS: Record<DeliveryStage, LucideIcon> = {
  unassigned: Package,
  assigned: Package,
  on_the_way: Navigation,
  on_site: MapPin,
  completed: Check,
};

const areSameGeolocation = (left: DeliveryRow['geolocation'], right: DeliveryRow['geolocation']) => {
  return left.latitude === right.latitude
    && left.longitude === right.longitude
    && left.status === right.status
    && left.source === right.source
    && left.precision_level === right.precision_level
    && left.last_geocoded_at === right.last_geocoded_at;
};

const areSameDeliveryRow = (left: DeliveryRow, right: DeliveryRow) => {
  return left.invoice_number === right.invoice_number
    && left.customer_name === right.customer_name
    && left.city === right.city
    && left.state === right.state
    && left.neighborhood === right.neighborhood
    && left.address === right.address
    && left.address_number === right.address_number
    && left.zip_code === right.zip_code
    && left.danfe_status === right.danfe_status
    && left.stage === right.stage
    && left.stop_status === right.stop_status
    && left.driver_id === right.driver_id
    && left.driver_name === right.driver_name
    && left.driver_color === right.driver_color
    && left.trip_id === right.trip_id
    && left.sequence === right.sequence
    && areSameGeolocation(left.geolocation, right.geolocation);
};

const areSameHighlightedStops = (
  left: DriverSummary['highlighted_stops'],
  right: DriverSummary['highlighted_stops'],
) => {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftStop = left[index];
    const rightStop = right[index];
    if (
      leftStop.invoice_number !== rightStop.invoice_number
      || leftStop.sequence !== rightStop.sequence
      || leftStop.stage !== rightStop.stage
      || leftStop.latitude !== rightStop.latitude
      || leftStop.longitude !== rightStop.longitude
    ) {
      return false;
    }
  }
  return true;
};

const areSameAlerts = (left: MonitoringAlert[] = [], right: MonitoringAlert[] = []) => {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const current = left[index];
    const next = right[index];
    if (
      current.id !== next.id
      || current.code !== next.code
      || current.severity !== next.severity
      || current.status !== next.status
      || current.title !== next.title
      || current.message !== next.message
      || current.created_at !== next.created_at
      || current.driver_id !== next.driver_id
      || current.trip_id !== next.trip_id
      || current.trip_note_id !== next.trip_note_id
      || current.nf_number !== next.nf_number
    ) {
      return false;
    }
  }
  return true;
};

const areSameDriverSummary = (left: DriverSummary, right: DriverSummary) => {
  return left.trip_id === right.trip_id
    && left.driver_id === right.driver_id
    && left.driver_name === right.driver_name
    && left.run_number === right.run_number
    && left.total_deliveries === right.total_deliveries
    && left.completed_deliveries === right.completed_deliveries
    && left.progress_pct === right.progress_pct
    && left.stage === right.stage
    && left.color === right.color
    && left.current_status === right.current_status
    && left.current_invoice_number === right.current_invoice_number
    && left.last_status_changed_at === right.last_status_changed_at
    && left.last_operational_event_at === right.last_operational_event_at
    && left.last_delivered_at === right.last_delivered_at
    && left.last_delivery_invoice_number === right.last_delivery_invoice_number
    && left.tracking_active === right.tracking_active
    && left.route_completed === right.route_completed
    && left.next_stop_required_by === right.next_stop_required_by
    && left.receipt_post_required_by === right.receipt_post_required_by
    && left.last_location_at === right.last_location_at
    && left.last_location_age_minutes === right.last_location_age_minutes
    && left.stale_location === right.stale_location
    && left.attention_level === right.attention_level
    && left.open_alerts_count === right.open_alerts_count
    && left.live_location?.latitude === right.live_location?.latitude
    && left.live_location?.longitude === right.live_location?.longitude
    && left.live_location?.accuracy_meters === right.live_location?.accuracy_meters
    && left.live_location?.updated_at === right.live_location?.updated_at
    && areSameAlerts(left.alerts, right.alerts)
    && areSameHighlightedStops(left.highlighted_stops, right.highlighted_stops);
};

const stabilizeRowsById = (nextRows: DeliveryRow[], prevRows: DeliveryRow[]) => {
  if (!prevRows.length) return nextRows;
  const prevById = new Map(prevRows.map((row) => [row.invoice_number, row]));
  return nextRows.map((nextRow) => {
    const prevRow = prevById.get(nextRow.invoice_number);
    if (!prevRow) return nextRow;
    return areSameDeliveryRow(prevRow, nextRow) ? prevRow : nextRow;
  });
};

const stabilizeDriversById = (nextDrivers: DriverSummary[], prevDrivers: DriverSummary[]) => {
  if (!prevDrivers.length) return nextDrivers;
  const prevById = new Map(prevDrivers.map((driver) => [`${driver.trip_id}:${driver.driver_id || 0}`, driver]));
  return nextDrivers.map((nextDriver) => {
    const key = `${nextDriver.trip_id}:${nextDriver.driver_id || 0}`;
    const prevDriver = prevById.get(key);
    if (!prevDriver) return nextDriver;
    return areSameDriverSummary(prevDriver, nextDriver) ? prevDriver : nextDriver;
  });
};

function DeliveryMonitoring() {
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedDeliveryInvoice, setSelectedDeliveryInvoice] = useState<string | null>(null);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [overview, setOverview] = useState<MonitoringResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<AddressDiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [mapViewport, setMapViewport] = useState<GoogleMapBoundsPayload | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const googleMapsApiKey = useMemo(() => resolveGoogleMapsApiKey(), []);
  const mapInitialCenter = useMemo(
    () => ({ lat: COMPANY_LOCATION.lat, lng: COMPANY_LOCATION.lng }),
    [],
  );
  const companyMarker = useMemo<GoogleCompanyMarker>(
    () => ({
      id: 'kp-company',
      lat: COMPANY_LOCATION.lat,
      lng: COMPANY_LOCATION.lng,
      label: 'Empresa',
      address: COMPANY_MARKER_ADDRESS,
    }),
    [],
  );
  const mapDatasetKey = overview?.date || date;

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: overviewData }, { data: diagnosticsData }] = await Promise.all([
        axios.get<MonitoringResponse>(`${API_URL}/api/delivery-monitoring`, {
          params: { date },
        }),
        axios.get<AddressDiagnosticsResponse>(`${API_URL}/api/delivery-monitoring/address-diagnostics`, {
          params: { date },
        }),
      ]);

      setOverview((current) => {
        const previousDeliveries = current?.deliveries || [];
        const previousDrivers = current?.drivers || [];
        return {
          ...overviewData,
          deliveries: stabilizeRowsById(overviewData.deliveries || [], previousDeliveries),
          drivers: stabilizeDriversById(overviewData.drivers || [], previousDrivers),
        };
      });
      setDiagnostics(diagnosticsData);
    } catch (error) {
      console.error('Falha ao carregar monitoramento de entregas.', error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      fetchOverview();
      refreshTimerRef.current = null;
    }, 450);
  }, [fetchOverview]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchOverview();
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchOverview]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    const socket: Socket = io(API_URL, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('delivery_monitoring_status', () => {
      scheduleRefresh();
    });
    socket.on('delivery_monitoring_geolocation', () => {
      scheduleRefresh();
    });
    socket.on('delivery_monitoring_alert', () => {
      scheduleRefresh();
    });
    socket.on('driver_location', () => {
      scheduleRefresh();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [scheduleRefresh]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const deliveries = useMemo(() => overview?.deliveries || [], [overview]);
  const drivers = useMemo(() => {
    return (overview?.drivers || [])
      .slice()
      .sort((left, right) => {
        const severityDiff = alertSeverityPriority(left.attention_level) - alertSeverityPriority(right.attention_level);
        if (severityDiff !== 0) return severityDiff;
        if (Boolean(left.stale_location) !== Boolean(right.stale_location)) {
          return left.stale_location ? -1 : 1;
        }
        if (Boolean(left.tracking_active) !== Boolean(right.tracking_active)) {
          return left.tracking_active ? -1 : 1;
        }
        return String(left.driver_name || '').localeCompare(String(right.driver_name || ''));
      });
  }, [overview]);
  const alerts = useMemo(() => overview?.alerts || [], [overview]);
  const summary = overview?.summary;
  const alertSummary = overview?.alert_summary;

  const selectedDelivery = useMemo(() => {
    if (!selectedDeliveryInvoice) return null;
    return deliveries.find((row) => row.invoice_number === selectedDeliveryInvoice) || null;
  }, [deliveries, selectedDeliveryInvoice]);

  useEffect(() => {
    if (!selectedDeliveryInvoice) return;
    if (selectedDelivery) return;
    setSelectedDeliveryInvoice(null);
  }, [selectedDeliveryInvoice, selectedDelivery]);

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((row) => {
      if (statusFilter !== 'all' && row.stage !== statusFilter) return false;
      return true;
    });
  }, [deliveries, statusFilter]);

  const mapDeliveries = useMemo(
    () => toGoogleDeliveryMapItems(filteredDeliveries),
    [filteredDeliveries],
  );
  const mapDriverLocations = useMemo(
    () => toGoogleDriverLocations(drivers),
    [drivers],
  );

  const selectedDriverRoutes = useMemo(
    () => toGoogleDeliveryRoutes(drivers, selectedDriverId, showRoutes),
    [drivers, selectedDriverId, showRoutes],
  );

  const listRows = useMemo(() => {
    return filteredDeliveries
      .slice()
      .sort((left, right) => {
        const stageDiff = stagePriority(left.stage) - stagePriority(right.stage);
        if (stageDiff !== 0) return stageDiff;
        return String(left.invoice_number).localeCompare(String(right.invoice_number));
      })
      .slice(0, 120);
  }, [filteredDeliveries]);

  return (
    <div className="min-h-screen">
      <Header />
      <Container>
        <section className="w-full rounded-lg border border-border bg-card p-4 shadow-elevated">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-text">Monitoramento de Entregas</h2>
            <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">
              Atualizado em {overview?.generated_at ? new Date(overview.generated_at).toLocaleTimeString('pt-BR') : '--:--'}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Data
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text"
              >
                <option value="all">Todos</option>
                {STAGE_ORDER.map((stage) => (
                  <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={fetchOverview}
              className="h-10 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text"
            >
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => setShowRoutes((current) => !current)}
              className="h-10 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text"
            >
              {showRoutes ? 'Ocultar rotas' : 'Mostrar rotas'}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('assigned')}
              className="h-10 rounded-md border border-amber-500/45 bg-amber-500/10 px-4 text-sm font-semibold text-amber-700"
            >
              Ver atribuídas
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="h-10 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text"
            >
              Ver todas
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">Total: {summary?.total || 0}</span>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">Sem motorista: {summary?.unassigned || 0}</span>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">Atribuidas: {summary?.assigned || 0}</span>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">A caminho: {summary?.on_the_way || 0}</span>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">No local: {summary?.on_site || 0}</span>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">Finalizadas: {summary?.completed || 0}</span>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">Geolocalizadas: {summary?.geolocated || 0}</span>
            <span className="rounded-full border border-rose-500/45 bg-rose-500/10 px-3 py-1 text-rose-700">Alertas: {alertSummary?.total || 0}</span>
            <span className="rounded-full border border-rose-500/45 bg-rose-500/10 px-3 py-1 text-rose-700">Criticos: {alertSummary?.critical || 0}</span>
            <span className="rounded-full border border-amber-500/45 bg-amber-500/10 px-3 py-1 text-amber-700">Avisos: {alertSummary?.warning || 0}</span>
          </div>

          {diagnostics ? (
            <div className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
              Enderecos com problemas: {diagnostics.summary.problematic}/{diagnostics.summary.total}
              {' | '}Duplicidade prefixo: {diagnostics.summary.duplicated_prefix}
              {' | '}Sem cidade/UF: {diagnostics.summary.missing_city_or_state}
              {' | '}Sem rua: {diagnostics.summary.missing_street}
            </div>
          ) : null}
        </section>

        <section className="mt-3 w-full rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text">Progresso por motorista</h3>
            <button
              type="button"
              onClick={() => setSelectedDriverId(null)}
              className="text-xs text-muted underline underline-offset-2"
            >
              Limpar destaque
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {drivers.map((driver) => {
              const numericDriverId = Number(driver.driver_id || 0);
              const canHighlight = numericDriverId > 0;
              const isActive = Number(selectedDriverId) === numericDriverId;
              return (
                <button
                  key={`${driver.trip_id}-${driver.driver_id}`}
                  type="button"
                  onClick={() => {
                    if (!canHighlight) return;
                    setSelectedDriverId(isActive ? null : numericDriverId);
                  }}
                  disabled={!canHighlight}
                  className={`min-w-[320px] rounded-md border px-3 py-2 text-left transition ${isActive
                    ? 'border-sky-500 bg-sky-500/10'
                    : driver.attention_level === 'CRITICAL'
                      ? 'border-rose-500/70 bg-rose-900/10'
                      : driver.attention_level === 'WARNING'
                        ? 'border-amber-500/60 bg-amber-500/10'
                        : driver.stale_location
                          ? 'border-slate-400 bg-slate-100/70'
                          : 'border-border bg-surface'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm text-text">{driver.driver_name}</strong>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">{`Rota #${driver.trip_id}`}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{`${driver.completed_deliveries}/${driver.total_deliveries} finalizadas`}</p>
                  <div
                    className="mt-2 h-2 w-full overflow-hidden rounded-full border bg-slate-100"
                    style={{ borderColor: driver.color || '#94a3b8' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${driver.progress_pct}%`,
                        backgroundColor: driver.color,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    Status da rota: {driver.stage === 'completed' ? 'Finalizada' : driver.stage === 'on_the_way' ? 'Em andamento' : driver.stage === 'on_site' ? 'No local' : 'Atribuida'}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-md border border-border bg-card px-2 py-1.5">
                      <p className="text-muted">Status atual</p>
                      <p className="font-semibold text-text">
                        {driver.current_status === 'arrived'
                          ? 'No local'
                          : driver.current_status === 'on_the_way'
                            ? 'A caminho'
                            : driver.current_status === 'completed'
                              ? 'Finalizada'
                              : driver.current_status === 'idle'
                                ? 'Aguardando proxima acao'
                                : driver.current_status || 'Atribuida'}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-card px-2 py-1.5">
                      <p className="text-muted">NF ativa</p>
                      <p className="font-semibold text-text">{driver.current_invoice_number || driver.last_delivery_invoice_number || '-'}</p>
                    </div>
                    <div className="rounded-md border border-border bg-card px-2 py-1.5">
                      <p className="text-muted">Ultima localizacao</p>
                      <p className={`font-semibold ${driver.stale_location ? 'text-rose-700' : 'text-text'}`}>
                        {driver.last_location_at ? `${formatRelativeMinutes(driver.last_location_at)} atras` : 'Sem ponto'}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-card px-2 py-1.5">
                      <p className="text-muted">Alertas abertos</p>
                      <p className={`font-semibold ${driver.open_alerts_count ? 'text-rose-700' : 'text-text'}`}>
                        {driver.open_alerts_count || 0}
                      </p>
                    </div>
                  </div>
                  {driver.live_location?.latitude != null && driver.live_location?.longitude != null ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted">
                      <LocateFixed className="h-3.5 w-3.5" />
                      {`${Number(driver.live_location.latitude).toFixed(5)}, ${Number(driver.live_location.longitude).toFixed(5)}`}
                    </p>
                  ) : null}
                  {driver.alerts?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {driver.alerts.slice(0, 2).map((alert) => (
                        <span
                          key={`driver-alert-${driver.trip_id}-${alert.id}`}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${alert.severity === 'CRITICAL'
                            ? 'border-rose-500/60 bg-rose-500/10 text-rose-700'
                            : 'border-amber-500/60 bg-amber-500/10 text-amber-700'
                            }`}
                        >
                          {alert.title}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            })}
            {!drivers.length ? (
              <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
                Nenhuma rota para a data selecionada.
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-3 w-full rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text">Alertas Operacionais</h3>
            <span className="text-xs text-muted">{`${alerts.length} alertas abertos no acompanhamento atual`}</span>
          </div>

          {!alerts.length ? (
            <div className="rounded-md border border-border bg-surface px-3 py-3 text-sm text-muted">
              Nenhum alerta operacional aberto para as rotas filtradas.
            </div>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {alerts.map((alert) => (
                <button
                  key={`monitoring-alert-${alert.id}`}
                  type="button"
                  onClick={() => {
                    if (alert.driver_id) setSelectedDriverId(alert.driver_id);
                    if (alert.nf_number) setSelectedDeliveryInvoice(alert.nf_number);
                  }}
                  className={`rounded-md border p-3 text-left ${alert.severity === 'CRITICAL'
                    ? 'border-rose-500/70 bg-rose-900/10'
                    : 'border-amber-500/60 bg-amber-500/10'
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-text">
                        <AlertTriangle className="h-4 w-4" />
                        {alert.title}
                      </p>
                      <p className="mt-1 text-xs text-muted">{alert.message}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${alert.severity === 'CRITICAL'
                      ? 'border-rose-500/60 bg-rose-500/10 text-rose-700'
                      : 'border-amber-500/60 bg-amber-500/10 text-amber-700'
                      }`}>
                      {alert.severity}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted">
                    <span>{`Criado: ${formatDateTime(alert.created_at)}`}</span>
                    <span>{`Driver: ${alert.driver_id || '-'}`}</span>
                    <span>{`Rota: ${alert.trip_id || '-'}`}</span>
                    <span>{`NF: ${alert.nf_number || '-'}`}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-3 w-full rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
            <span>Visualizacao operacional no Google Maps (POIs e nomes de lugares).</span>
            <span>{`Pontos no mapa: ${mapDeliveries.length} entregas • ${mapDriverLocations.length} motoristas • 1 empresa`}</span>
          </div>

          <div className="relative h-[calc(100vh-360px)] min-h-[380px] overflow-hidden rounded-md border border-border">
            <GoogleDeliveriesMap
              apiKey={googleMapsApiKey}
              center={mapInitialCenter}
              initialZoom={10}
              datasetKey={mapDatasetKey}
              deliveries={mapDeliveries}
              driverLocations={mapDriverLocations}
              companyMarker={companyMarker}
              routes={selectedDriverRoutes}
              selectedDriverId={selectedDriverId}
              selectedDeliveryId={selectedDeliveryInvoice}
              onMarkerClick={setSelectedDeliveryInvoice}
              onMapBoundsChange={setMapViewport}
            />

            {selectedDelivery ? (
              <>
                <button
                  type="button"
                  className="absolute inset-0 z-[30] bg-slate-900/15 md:hidden"
                  onClick={() => setSelectedDeliveryInvoice(null)}
                  aria-label="Fechar painel da entrega"
                />
                <aside className="absolute bottom-3 right-3 top-3 z-[40] w-[min(360px,calc(100%-1.5rem))] overflow-auto rounded-md border border-border bg-card p-3 shadow-2xl max-md:top-auto max-md:h-[58%]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Detalhes da entrega</p>
                      <h4 className="text-base font-semibold text-text">{`NF ${selectedDelivery.invoice_number}`}</h4>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text"
                      onClick={() => setSelectedDeliveryInvoice(null)}
                      aria-label="Fechar painel da entrega"
                    >
                      x
                    </button>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div className="rounded-md border border-border bg-surface px-2 py-2">
                      <p className="font-semibold text-text">{selectedDelivery.customer_name || 'Cliente sem nome'}</p>
                      <p className="mt-1 text-muted">{`${selectedDelivery.address || '-'}, ${selectedDelivery.address_number || 's/n'}`}</p>
                      <p className="text-muted">{`${selectedDelivery.neighborhood || '-'} • ${selectedDelivery.city || '-'}${selectedDelivery.state ? `/${selectedDelivery.state}` : ''}`}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border border-border bg-surface px-2 py-2">
                        <p className="text-muted">Status</p>
                        <p className="font-semibold text-text">{STAGE_LABELS[selectedDelivery.stage]}</p>
                      </div>
                      <div className="rounded-md border border-border bg-surface px-2 py-2">
                        <p className="text-muted">Motorista</p>
                        <p className="font-semibold text-text">{selectedDelivery.driver_name || 'Nao atribuido'}</p>
                      </div>
                      <div className="rounded-md border border-border bg-surface px-2 py-2">
                        <p className="text-muted">Rota</p>
                        <p className="font-semibold text-text">{selectedDelivery.trip_id || '-'}</p>
                      </div>
                      <div className="rounded-md border border-border bg-surface px-2 py-2">
                        <p className="text-muted">Sequencia</p>
                        <p className="font-semibold text-text">{selectedDelivery.sequence || '-'}</p>
                      </div>
                    </div>
                    <div className="rounded-md border border-border bg-surface px-2 py-2">
                      <p className="text-muted">Geocoding</p>
                      <p className="font-semibold text-text">
                        {`${selectedDelivery.geolocation.status}${selectedDelivery.geolocation.source ? ` • ${selectedDelivery.geolocation.source}` : ''}`}
                      </p>
                    </div>
                  </div>
                </aside>
              </>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {STAGE_ORDER.map((stage) => {
              const Icon = STAGE_ICONS[stage];
              return (
                <span
                  key={`legend-map-${stage}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                >
                  <span className="inline-flex items-center justify-center">
                    <Icon
                      size={20}
                      strokeWidth={1.2}
                      color="#000000"
                      fill={STAGE_STYLE[stage].border}
                    />
                  </span>
                  {STAGE_LABELS[stage]}
                </span>
              );
            })}
          </div>

          <p className="mt-1 text-xs text-muted">
            Todos os ícones usam preenchimento colorido e contorno preto fino; nas entregas atribuídas o preenchimento segue a cor do motorista.
          </p>

          <div className="mt-2 text-xs text-muted">
            Zoom atual: {mapViewport?.zoom || '--'}
          </div>

          {loading ? (
            <p className="mt-2 text-xs text-muted">Atualizando monitoramento...</p>
          ) : null}
        </section>

        <section className="mt-3 w-full rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text">Lista de entregas</h3>
            <span className="text-xs text-muted">
              {`Mostrando ${Math.min(listRows.length, 120)} de ${filteredDeliveries.length} entregas filtradas`}
            </span>
          </div>
          <div className="max-h-[320px] overflow-auto rounded-md border border-border">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 z-[1] bg-surface">
                <tr className="border-b border-border">
                  <th className="px-2 py-2">NF</th>
                  <th className="px-2 py-2">Cliente</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Motorista</th>
                  <th className="px-2 py-2">Cidade</th>
                </tr>
              </thead>
              <tbody>
                {listRows.map((row) => (
                  <tr key={`list-${row.invoice_number}`} className="border-b border-border/60 hover:bg-surface-2">
                    <td className="px-2 py-2 font-semibold">{row.invoice_number}</td>
                    <td className="px-2 py-2">{row.customer_name || '-'}</td>
                    <td className="px-2 py-2">
                      <span
                        className="inline-flex rounded-full border px-2 py-0.5"
                        style={{
                          borderColor: '#cbd5e1',
                          backgroundColor: `${STAGE_STYLE[row.stage].fill}22`,
                        }}
                      >
                        {STAGE_LABELS[row.stage]}
                      </span>
                    </td>
                    <td className="px-2 py-2">{row.driver_name || '-'}</td>
                    <td className="px-2 py-2">{`${row.city || '-'}${row.state ? `/${row.state}` : ''}`}</td>
                  </tr>
                ))}
                {!listRows.length ? (
                  <tr>
                    <td className="px-2 py-3 text-muted" colSpan={5}>Nenhuma entrega para os filtros selecionados.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </Container>
    </div>
  );
}

export default DeliveryMonitoring;
