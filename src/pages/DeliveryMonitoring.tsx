import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { io, Socket } from 'socket.io-client';
import GoogleDeliveriesMap, { GoogleCompanyMarker, GoogleMapBoundsPayload } from '../components/maps/GoogleDeliveriesMap';
import { MapMarkerPin } from '../components/maps/MapMarkerPin';
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
import {
  DELIVERY_STAGE_ICONS,
  getLegendMarkerVisual,
} from './deliveryMonitoring/googleMarkerVisuals';
import {
  getReadAlertIds,
  subscribeToAlertReadChanges,
} from '../utils/alertReadState';
import { getSemanticToneClassName, normalizeOperationalStatus, SemanticTone } from '../utils/statusStyles';
import {
  canManuallyUpdateStopStatus,
  getManualStopStatusLabel,
  MANUAL_STOP_STATUS_ACTIONS,
  ManualStopStatus,
} from './deliveryMonitoring/stopStatusActions';

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
  stops?: Array<{
    note_id: number;
    invoice_number: string;
    sequence: number | null;
    status: string;
  }>;
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

type DriverStopVisual = 'pending' | 'assigned' | 'on_the_way' | 'on_site' | 'completed' | 'retained' | 'returned' | 'redelivery';
type SelectedDriverStop = {
  tripId: number;
  sequence: number;
};

type StopStatusUpdateState = {
  tripId: number;
  sequence: number;
  nextStatus: ManualStopStatus;
};

type StopStatusFeedback = {
  tripId: number;
  sequence: number;
  tone: SemanticTone;
  message: string;
};

const resolveGoogleMapsApiKey = () => {
  const env = process.env as Record<string, string | undefined>;
  return env.REACT_APP_GOOGLE_MAPS_API_KEY || env.VITE_GOOGLE_MAPS_API_KEY || '';
};

const COMPANY_MARKER_ADDRESS = 'Av. Ricardo Bassoli Cezare, 3666 - Jardim Itatinga';
const MOBILE_MONITORING_BREAKPOINT = 768;

const getTodayMonitoringDate = () => format(new Date(), 'yyyy-MM-dd');

const stagePriority = (stage: DeliveryStage) => {
  return STAGE_PRIORITY[stage] ?? 99;
};

const RETURNED_STOP_STATUSES = new Set(['returned', 'cancelled']);
const REDELIVERY_STOP_STATUSES = new Set(['redelivery']);
const RETAINED_STOP_STATUSES = new Set(['retained']);
const COMPLETED_STOP_STATUSES = new Set(['delivered', 'completed']);


const resolveDriverStopVisual = (row: DeliveryRow): DriverStopVisual => {
  const stopStatus = normalizeOperationalStatus(row.stop_status);
  const danfeStatus = normalizeOperationalStatus(row.danfe_status);

  if (RETURNED_STOP_STATUSES.has(stopStatus) || RETURNED_STOP_STATUSES.has(danfeStatus)) {
    return 'returned';
  }

  if (REDELIVERY_STOP_STATUSES.has(stopStatus) || REDELIVERY_STOP_STATUSES.has(danfeStatus)) {
    return 'redelivery';
  }

  if (RETAINED_STOP_STATUSES.has(stopStatus) || RETAINED_STOP_STATUSES.has(danfeStatus)) {
    return 'retained';
  }

  if (
    COMPLETED_STOP_STATUSES.has(stopStatus)
    || COMPLETED_STOP_STATUSES.has(danfeStatus)
    || row.stage === 'completed'
  ) {
    return 'completed';
  }

  if (stopStatus === 'arrived' || row.stage === 'on_site') {
    return 'on_site';
  }

  if (stopStatus === 'on_the_way' || row.stage === 'on_the_way') {
    return 'on_the_way';
  }

  if (stopStatus === 'assigned' || danfeStatus === 'assigned' || row.stage === 'assigned') {
    return 'assigned';
  }

  return 'pending';
};

const resolveDriverStopVisualFromStatus = (status?: string | null): DriverStopVisual => {
  const normalized = normalizeOperationalStatus(status);

  if (RETURNED_STOP_STATUSES.has(normalized)) {
    return 'returned';
  }

  if (REDELIVERY_STOP_STATUSES.has(normalized)) {
    return 'redelivery';
  }

  if (RETAINED_STOP_STATUSES.has(normalized)) {
    return 'retained';
  }

  if (COMPLETED_STOP_STATUSES.has(normalized)) {
    return 'completed';
  }

  if (normalized === 'arrived') {
    return 'on_site';
  }

  if (normalized === 'on_the_way') {
    return 'on_the_way';
  }

  if (normalized === 'assigned') {
    return 'assigned';
  }

  return 'pending';
};

const getDriverStopLabel = (visual: DriverStopVisual) => {
  if (visual === 'completed') return 'entrega concluida';
  if (visual === 'assigned') return 'entrega atribuida';
  if (visual === 'retained') return 'canhoto retido';
  if (visual === 'on_the_way') return 'motorista a caminho';
  if (visual === 'on_site') return 'motorista no local';
  if (visual === 'returned') return 'entrega devolvida';
  if (visual === 'redelivery') return 'reentrega';
  return 'entrega pendente';
};

const getDriverStopTone = (visual: DriverStopVisual): SemanticTone => {
  if (visual === 'completed') return 'success';
  if (visual === 'retained') return 'warning';
  if (visual === 'redelivery') return 'info';
  if (visual === 'on_the_way' || visual === 'on_site') return 'info';
  if (visual === 'returned') return 'danger';
  if (visual === 'assigned') return 'neutral';
  return 'warning';
};

const getDriverStopBadgeClassName = (visual: DriverStopVisual, isSelected = false) => {
  const selectedState = isSelected ? 'ring-2 ring-slate-900/10 ring-offset-1' : '';
  return `${getSemanticToneClassName(getDriverStopTone(visual))} ${selectedState}`.trim();
};

const getDriverStopSegmentClassName = (visual: DriverStopVisual, isSelected = false) => {
  const baseClassNameByVisual: Record<DriverStopVisual, string> = {
    pending: 'border-amber-600 bg-amber-500 text-white',
    assigned: 'border-border bg-surface text-text',
    on_the_way: 'border-sky-700 bg-sky-600 text-white',
    on_site: 'border-cyan-700 bg-cyan-600 text-white',
    completed: 'border-emerald-700 bg-emerald-600 text-white',
    retained: 'border-amber-700 bg-amber-500 text-white',
    returned: 'border-red-700 bg-red-600 text-white',
    redelivery: 'border-blue-700 bg-blue-600 text-white',
  };
  const selectedState = isSelected
    ? 'z-[1] ring-2 ring-white/80 ring-offset-1 ring-offset-card shadow-[0_0_0_1px_rgba(15,23,42,0.22)]'
    : '';
  return `${baseClassNameByVisual[visual]} ${selectedState}`.trim();
};

const getDriverRowClassName = (
  driver: DriverSummary,
  isActive: boolean,
) => {
  if (isActive) {
    return getSemanticToneClassName('info', 'panel');
  }

  if (driver.attention_level === 'CRITICAL') {
    return getSemanticToneClassName('danger', 'panel');
  }

  if (driver.attention_level === 'WARNING') {
    return getSemanticToneClassName('warning', 'panel');
  }

  if (driver.stale_location) {
    return getSemanticToneClassName('neutral', 'panel');
  }

  return 'border-border bg-surface';
};

const alertSeverityPriority = (severity?: string | null) => {
  if (severity === 'CRITICAL') return 0;
  if (severity === 'WARNING') return 1;
  if (severity === 'INFO') return 2;
  return 3;
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

const getStopStatusUpdateErrorMessage = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return 'Nao foi possivel atualizar o status desta parada.';
  }

  const responseData = error.response?.data as { message?: string; error?: string } | undefined;
  return responseData?.message
    || responseData?.error
    || 'Nao foi possivel atualizar o status desta parada.';
};

function DeliveryMonitoring() {
  const navigate = useNavigate();
  const [date, setDate] = useState<string>(getTodayMonitoringDate());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedDeliveryInvoice, setSelectedDeliveryInvoice] = useState<string | null>(null);
  const [selectedDriverStop, setSelectedDriverStop] = useState<SelectedDriverStop | null>(null);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [overview, setOverview] = useState<MonitoringResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<AddressDiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [stopStatusUpdate, setStopStatusUpdate] = useState<StopStatusUpdateState | null>(null);
  const [stopStatusFeedback, setStopStatusFeedback] = useState<StopStatusFeedback | null>(null);
  const [mapViewport, setMapViewport] = useState<GoogleMapBoundsPayload | null>(null);
  const [readAlertIds, setReadAlertIds] = useState<Set<number>>(() => new Set(getReadAlertIds()));
  const [isMobileView, setIsMobileView] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_MONITORING_BREAKPOINT;
  });
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todayDate = getTodayMonitoringDate();
  const effectiveDate = isMobileView ? todayDate : date;

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
  const mapDatasetKey = overview?.date || effectiveDate;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_MONITORING_BREAKPOINT - 1}px)`);
    const updateViewport = (matches: boolean) => {
      setIsMobileView(matches);
    };

    updateViewport(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      updateViewport(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isMobileView) return;

    setDate((currentDate) => (currentDate === todayDate ? currentDate : todayDate));
    setSelectedDeliveryInvoice(null);
  }, [isMobileView, todayDate]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const overviewRequest = axios.get<MonitoringResponse>(`${API_URL}/api/delivery-monitoring`, {
        params: { date: effectiveDate },
      });
      const diagnosticsRequest = isMobileView
        ? Promise.resolve(null)
        : axios.get<AddressDiagnosticsResponse>(`${API_URL}/api/delivery-monitoring/address-diagnostics`, {
          params: { date: effectiveDate },
        });

      const [overviewResponse, diagnosticsResponse] = await Promise.all([overviewRequest, diagnosticsRequest]);
      const overviewData = overviewResponse.data;

      setOverview((current) => {
        const previousDeliveries = current?.deliveries || [];
        const previousDrivers = current?.drivers || [];
        return {
          ...overviewData,
          deliveries: stabilizeRowsById(overviewData.deliveries || [], previousDeliveries),
          drivers: stabilizeDriversById(overviewData.drivers || [], previousDrivers),
        };
      });
      setDiagnostics(diagnosticsResponse?.data || null);
    } catch (error) {
      console.error('Falha ao carregar monitoramento de entregas.', error);
    } finally {
      setLoading(false);
    }
  }, [effectiveDate, isMobileView]);

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

  useEffect(() => {
    return subscribeToAlertReadChanges(() => {
      setReadAlertIds(new Set(getReadAlertIds()));
    });
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
  const unreadAlertsCount = useMemo(
    () => alerts.reduce((count, alert) => {
      if (alert.status === 'RESOLVED') return count;
      return readAlertIds.has(alert.id) ? count : count + 1;
    }, 0),
    [alerts, readAlertIds],
  );
  const totalOpenAlerts = alertSummary?.total ?? alerts.length;
  const mobileSummaryCards = useMemo(
    () => [
      { label: 'Motoristas', value: drivers.length },
      { label: 'Entregas', value: summary?.total || 0 },
      { label: 'Em rota', value: (summary?.on_the_way || 0) + (summary?.on_site || 0) },
      { label: 'Concluídas', value: summary?.completed || 0 },
    ],
    [drivers.length, summary],
  );

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

  const mapDeliveries = useMemo(() => {
    const driverScopedDeliveries = selectedDriverId
      ? filteredDeliveries.filter((row) => Number(row.driver_id || 0) === Number(selectedDriverId))
      : filteredDeliveries;

    return toGoogleDeliveryMapItems(driverScopedDeliveries);
  }, [filteredDeliveries, selectedDriverId]);
  const mapDriverLocations = useMemo(() => {
    const driverScopedLocations = selectedDriverId
      ? drivers.filter((driver) => Number(driver.driver_id || 0) === Number(selectedDriverId))
      : drivers;

    return toGoogleDriverLocations(driverScopedLocations);
  }, [drivers, selectedDriverId]);

  const selectedDriverRoutes = useMemo(
    () => toGoogleDeliveryRoutes(deliveries, selectedDriverId, showRoutes, mapInitialCenter),
    [deliveries, mapInitialCenter, selectedDriverId, showRoutes],
  );

  const listRows = useMemo(() => {
    const driverScopedRows = selectedDriverId
      ? filteredDeliveries.filter((row) => Number(row.driver_id || 0) === Number(selectedDriverId))
      : filteredDeliveries;

    const sortedRows = driverScopedRows
      .slice()
      .sort((left, right) => {
        const stageDiff = stagePriority(left.stage) - stagePriority(right.stage);
        if (stageDiff !== 0) return stageDiff;
        return String(left.invoice_number).localeCompare(String(right.invoice_number));
      });

    return selectedDriverId ? sortedRows : sortedRows.slice(0, 120);
  }, [filteredDeliveries, selectedDriverId]);

  const driverStopsByTrip = useMemo(() => {
    const nextMap = new Map<number, Map<number, DriverStopVisual>>();

    deliveries.forEach((row) => {
      const tripId = Number(row.trip_id || 0);
      const sequence = Number(row.sequence || 0);
      if (tripId <= 0 || sequence <= 0) return;

      if (!nextMap.has(tripId)) {
        nextMap.set(tripId, new Map<number, DriverStopVisual>());
      }

      nextMap.get(tripId)?.set(sequence, resolveDriverStopVisual(row));
    });

    return nextMap;
  }, [deliveries]);

  const deliveriesByTripAndSequence = useMemo(() => {
    const nextMap = new Map<number, Map<number, DeliveryRow>>();

    deliveries.forEach((row) => {
      const tripId = Number(row.trip_id || 0);
      const sequence = Number(row.sequence || 0);
      if (tripId <= 0 || sequence <= 0) return;

      if (!nextMap.has(tripId)) {
        nextMap.set(tripId, new Map<number, DeliveryRow>());
      }

      nextMap.get(tripId)?.set(sequence, row);
    });

    return nextMap;
  }, [deliveries]);

  useEffect(() => {
    if (!selectedDriverStop) return;

    const tripDeliveries = deliveriesByTripAndSequence.get(selectedDriverStop.tripId);
    const stopExists = tripDeliveries?.has(selectedDriverStop.sequence)
      || drivers.some((driver) => (
        driver.trip_id === selectedDriverStop.tripId
        && selectedDriverStop.sequence <= Number(driver.total_deliveries || 0)
      ));

    if (stopExists) return;
    setSelectedDriverStop(null);
  }, [deliveriesByTripAndSequence, drivers, selectedDriverStop]);

  useEffect(() => {
    if (!selectedDriverStop) {
      setStopStatusUpdate(null);
      setStopStatusFeedback(null);
      return;
    }

    setStopStatusUpdate((current) => (current
      && current.tripId === selectedDriverStop.tripId
      && current.sequence === selectedDriverStop.sequence
      ? current
      : null));
    setStopStatusFeedback((current) => (current
      && current.tripId === selectedDriverStop.tripId
      && current.sequence === selectedDriverStop.sequence
      ? current
      : null));
  }, [selectedDriverStop]);

  const handleStopStatusUpdate = useCallback(async ({
    tripId,
    sequence,
    stopId,
    currentStatus,
    nextStatus,
    driverId,
    driverName,
    invoiceNumber,
  }: {
    tripId: number;
    sequence: number;
    stopId: number | null;
    currentStatus: string;
    nextStatus: ManualStopStatus;
    driverId: number | null;
    driverName: string | null;
    invoiceNumber: string | null;
  }) => {
    if (!stopId) {
      setStopStatusFeedback({
        tripId,
        sequence,
        tone: 'danger',
        message: 'Esta parada nao possui identificador operacional para atualizacao.',
      });
      return;
    }

    if (!driverId) {
      setStopStatusFeedback({
        tripId,
        sequence,
        tone: 'warning',
        message: 'A rota precisa de um motorista vinculado para permitir a atualizacao operacional.',
      });
      return;
    }

    if (!canManuallyUpdateStopStatus(currentStatus, nextStatus)) {
      setStopStatusFeedback({
        tripId,
        sequence,
        tone: 'warning',
        message: 'Esta parada ja esta finalizada ou nao aceita essa mudanca manual.',
      });
      return;
    }

    const invoiceLabel = invoiceNumber ? `NF ${invoiceNumber}` : 'esta parada';
    const confirmed = typeof window === 'undefined' || typeof window.confirm !== 'function'
      ? true
      : window.confirm(`Confirmar ${getManualStopStatusLabel(nextStatus)} para ${invoiceLabel}?`);

    if (!confirmed) return;

    setStopStatusUpdate({ tripId, sequence, nextStatus });
    setStopStatusFeedback(null);

    try {
      await axios.post(`${API_URL}/driver-app/trip-stops/${stopId}/status`, {
        status: nextStatus,
        driver_id: driverId,
        driver_name: driverName,
        source: 'delivery_monitoring_manual_update',
        metadata: {
          origin: 'delivery_monitoring',
          trip_id: tripId,
          invoice_number: invoiceNumber,
          sequence,
        },
      });

      await fetchOverview();
      setStopStatusFeedback({
        tripId,
        sequence,
        tone: 'success',
        message: `${invoiceLabel} atualizada com sucesso para ${getManualStopStatusLabel(nextStatus)}.`,
      });
    } catch (error) {
      setStopStatusFeedback({
        tripId,
        sequence,
        tone: 'danger',
        message: getStopStatusUpdateErrorMessage(error),
      });
    } finally {
      setStopStatusUpdate((current) => (
        current
        && current.tripId === tripId
        && current.sequence === sequence
          ? null
          : current
      ));
    }
  }, [fetchOverview]);

  return (
    <div className="min-h-screen">
      <Header />
      <Container>
        <section className="w-full rounded-lg border border-border bg-card p-4 shadow-elevated">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-text">Monitoramento de Entregas</h2>
                {!isMobileView ? (
                  <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">
                    Atualizado em {overview?.generated_at ? new Date(overview.generated_at).toLocaleTimeString('pt-BR') : '--:--'}
                  </span>
                ) : null}
              </div>

              {isMobileView ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="rounded-full border border-border bg-surface-2 px-2 py-1">
                    Hoje
                  </span>
                  <span className="rounded-full border border-border bg-surface-2 px-2 py-1">
                    Atualizado {overview?.generated_at ? new Date(overview.generated_at).toLocaleTimeString('pt-BR') : '--:--'}
                  </span>
                </div>
              ) : null}

              {isMobileView ? (
                <p className="mt-2 text-xs text-muted">
                  Exibindo apenas as rotas do dia atual com foco no progresso de cada motorista.
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => navigate('/alerts')}
              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-2 text-left transition md:gap-3 md:px-3 ${unreadAlertsCount > 0
                ? 'semantic-solid-danger'
                : 'border-border bg-surface text-text'
                }`}
              aria-label={unreadAlertsCount > 0
                ? `Abrir alertas. ${unreadAlertsCount} não lidos`
                : 'Abrir alertas'
              }
              title="Abrir alertas"
            >
              <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-current/40 bg-card">
                <AlertTriangle className="h-5 w-5" />
                {unreadAlertsCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}
                  </span>
                ) : null}
              </span>
              <span className="hidden md:block">
                <span className="block text-sm font-semibold">
                  Alertas
                </span>
                <span className={`block text-xs ${unreadAlertsCount > 0 ? 'opacity-85' : 'text-muted'}`}>
                  {unreadAlertsCount > 0
                    ? `${unreadAlertsCount} não lidos`
                    : 'Sem alertas pendentes'}
                  {totalOpenAlerts > 0 ? ` • ${totalOpenAlerts} abertos` : ''}
                </span>
              </span>
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2 md:mt-3 md:flex-row md:flex-wrap md:items-end">
            {!isMobileView ? (
              <label className="flex flex-col gap-1 text-xs text-muted">
                Data
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text"
                />
              </label>
            ) : null}
            <label className={`flex flex-col gap-1 text-xs text-muted ${isMobileView ? 'w-full' : ''}`}>
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={`h-10 rounded-md border border-border bg-surface px-3 text-sm text-text ${isMobileView ? 'w-full' : ''}`}
              >
                <option value="all">Todos</option>
                {STAGE_ORDER.map((stage) => (
                  <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
                ))}
              </select>
            </label>
            <div className={`flex gap-2 ${isMobileView ? 'w-full' : 'flex-wrap'}`}>
              <button
                type="button"
                onClick={fetchOverview}
                className={`h-10 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text ${isMobileView ? 'flex-1' : ''}`}
              >
                Atualizar
              </button>
              {!isMobileView ? (
                <>
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
                    className="h-10 rounded-md border semantic-solid-info px-4 text-sm font-semibold transition hover:brightness-95"
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
                </>
              ) : null}
            </div>
          </div>

          {isMobileView ? (
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {mobileSummaryCards.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <p className="text-[11px] uppercase tracking-wide text-muted">{item.label}</p>
                  <p className="mt-1 text-base font-semibold text-text">{item.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">Total: {summary?.total || 0}</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">Sem motorista: {summary?.unassigned || 0}</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">Atribuidas: {summary?.assigned || 0}</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">A caminho: {summary?.on_the_way || 0}</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">No local: {summary?.on_site || 0}</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">Finalizadas: {summary?.completed || 0}</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">Geolocalizadas: {summary?.geolocated || 0}</span>
              </div>

              {diagnostics ? (
                <div className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
                  Enderecos com problemas: {diagnostics.summary.problematic}/{diagnostics.summary.total}
                  {' | '}Duplicidade prefixo: {diagnostics.summary.duplicated_prefix}
                  {' | '}Sem cidade/UF: {diagnostics.summary.missing_city_or_state}
                  {' | '}Sem rua: {diagnostics.summary.missing_street}
                </div>
              ) : null}
            </>
          )}

          {loading && isMobileView ? (
            <p className="mt-2 text-xs text-muted">Atualizando monitoramento...</p>
          ) : null}
        </section>
        <section className="mt-3 w-full rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text">Progresso por motorista</h3>
            <button
              type="button"
              onClick={() => {
                setSelectedDriverId(null);
                setSelectedDriverStop(null);
                setSelectedDeliveryInvoice(null);
              }}
              className="text-xs text-muted underline underline-offset-2"
            >
              Limpar destaque
            </button>
          </div>
          <p className="mb-3 text-xs text-muted">
            {isMobileView
              ? 'Toque nas paradas para ver NF e cliente da rota selecionada.'
              : 'Clique no nome do motorista para destacar a rota no mapa. Clique em uma parada para ver NF e cliente.'}
          </p>
          <div className="space-y-1">
            {drivers.map((driver) => {
              const numericDriverId = Number(driver.driver_id || 0);
              const canHighlight = numericDriverId > 0;
              const isActive = Number(selectedDriverId) === numericDriverId;
              const routeStops = driverStopsByTrip.get(driver.trip_id) || new Map<number, DriverStopVisual>();
              const tripDeliveries = deliveriesByTripAndSequence.get(driver.trip_id) || new Map<number, DeliveryRow>();
              const driverStops = Array.isArray(driver.stops)
                ? driver.stops.slice().sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))
                : [];
              const driverStopsBySequence = new Map(
                driverStops.map((stop) => [Number(stop.sequence || 0), stop]),
              );
              const selectedStopSequence = selectedDriverStop?.tripId === driver.trip_id
                ? selectedDriverStop.sequence
                : null;
              const selectedStopMeta = selectedStopSequence
                ? driverStopsBySequence.get(selectedStopSequence) || null
                : null;
              const selectedStopVisual = selectedStopSequence
                ? routeStops.get(selectedStopSequence) || resolveDriverStopVisualFromStatus(selectedStopMeta?.status)
                : null;
              const selectedStopDelivery = selectedStopSequence
                ? tripDeliveries.get(selectedStopSequence) || null
                : null;
              const selectedStopStatus = normalizeOperationalStatus(
                selectedStopMeta?.status || selectedStopDelivery?.stop_status || selectedStopDelivery?.danfe_status,
              ) || 'pending';
              const selectedStopInvoiceNumber = selectedStopDelivery?.invoice_number || selectedStopMeta?.invoice_number || null;
              const selectedStopCustomerName = selectedStopDelivery?.customer_name || null;
              const selectedStopAllowsManualUpdate = MANUAL_STOP_STATUS_ACTIONS.some((action) => (
                canManuallyUpdateStopStatus(selectedStopStatus, action.status)
              ));
              const selectedStopUpdating = Boolean(
                selectedStopSequence
                && stopStatusUpdate?.tripId === driver.trip_id
                && stopStatusUpdate.sequence === selectedStopSequence,
              );
              const selectedStopFeedbackMessage = selectedStopSequence && stopStatusFeedback?.tripId === driver.trip_id && stopStatusFeedback.sequence === selectedStopSequence
                ? stopStatusFeedback
                : null;
              const visualStops = Array.from({ length: Number(driver.total_deliveries || 0) }, (_, index) => {
                const sequence = index + 1;
                const stopMeta = driverStopsBySequence.get(sequence) || null;
                return {
                  sequence,
                  visual: routeStops.get(sequence) || resolveDriverStopVisualFromStatus(stopMeta?.status),
                  invoiceNumber: stopMeta?.invoice_number || null,
                };
              });

              return (
                <div
                  key={`${driver.trip_id}-${driver.driver_id}`}
                  className={`w-full rounded-xl border px-3 py-2 transition md:px-2 md:py-1.5 ${getDriverRowClassName(driver, isActive)} ${canHighlight ? '' : 'opacity-85'}`}
                >
                  <div className="flex flex-col gap-2 md:gap-1.5 lg:flex-row lg:items-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (!canHighlight) return;
                        setSelectedDriverId(isActive ? null : numericDriverId);
                      }}
                      disabled={!canHighlight}
                      className={`flex min-w-0 shrink-0 items-center gap-2 rounded-md px-2 py-1 text-left transition md:py-0.5 lg:min-w-[250px] lg:max-w-[320px] ${canHighlight
                        ? 'hover:bg-surface-2/70'
                        : 'cursor-default'
                        }`}
                      title={canHighlight ? 'Destacar rota do motorista no mapa' : 'Motorista sem rota destacável'}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[4px] border border-slate-900/10"
                        style={{ backgroundColor: driver.color || '#0f172a' }}
                      />
                      <strong className="truncate text-sm text-text">{driver.driver_name}</strong>
                      <span className="ml-auto inline-flex shrink-0 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 shadow-sm">
                        {`${driver.completed_deliveries}/${driver.total_deliveries}`}
                      </span>
                      <span className="inline-flex shrink-0 rounded-md border semantic-solid-info px-1.5 py-0.5 text-[11px] font-semibold md:hidden">
                        {`${Math.round(driver.progress_pct || 0)}%`}
                      </span>
                      {driver.run_number > 1 ? (
                        <span className="inline-flex shrink-0 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted">
                          {`${driver.run_number}a saída`}
                        </span>
                      ) : null}
                    </button>

                    <div className="min-w-0 flex-1 overflow-x-auto pb-1 md:pb-0">
                      <div className="inline-flex min-w-max overflow-hidden rounded-sm border border-border bg-surface">
                        {visualStops.map((stop, index) => {
                          const stopDelivery = tripDeliveries.get(stop.sequence) || null;
                          const stopInvoiceNumber = stopDelivery?.invoice_number || stop.invoiceNumber;
                          const stopTitle = stopInvoiceNumber
                            ? `Parada ${stop.sequence}: NF ${stopInvoiceNumber} • ${getDriverStopLabel(stop.visual)}`
                            : `Parada ${stop.sequence}: ${getDriverStopLabel(stop.visual)}`;

                          return (
                          <button
                            key={`${driver.trip_id}-${stop.sequence}`}
                            type="button"
                            onClick={() => {
                              const isSelectedStop = selectedStopSequence === stop.sequence;

                              if (isSelectedStop) {
                                setSelectedDriverStop(null);
                                if (stopDelivery?.invoice_number && selectedDeliveryInvoice === stopDelivery.invoice_number) {
                                  setSelectedDeliveryInvoice(null);
                                }
                                return;
                              }

                              setSelectedDriverStop({ tripId: driver.trip_id, sequence: stop.sequence });
                              if (canHighlight) {
                                setSelectedDriverId(numericDriverId);
                              }
                              if (stopDelivery?.invoice_number || stop.invoiceNumber) {
                                setSelectedDeliveryInvoice(stopDelivery?.invoice_number || stop.invoiceNumber || null);
                              }
                            }}
                            title={stopTitle}
                            aria-label={stopTitle}
                            className={`relative inline-flex h-7 w-7 shrink-0 items-center justify-center border px-0 text-[11px] font-semibold leading-none tabular-nums transition hover:brightness-105 first:border-l md:h-5 md:w-[22px] md:text-[10px] ${index > 0 ? 'border-l-0' : ''} ${getDriverStopSegmentClassName(stop.visual, selectedStopSequence === stop.sequence)}`}
                            aria-pressed={selectedStopSequence === stop.sequence}
                          >
                            {stop.visual === 'completed' ? (
                              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                            ) : stop.visual === 'retained' ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                            ) : (
                              stop.sequence
                            )}
                          </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {selectedStopSequence ? (
                    <div className="mt-1.5 rounded-md border border-border/80 bg-surface/90 px-2.5 py-2 text-xs md:px-2 md:py-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-md border border-border bg-surface px-2 py-1 font-semibold text-text">
                          {`Parada ${selectedStopSequence}`}
                        </span>
                        <span className={`inline-flex rounded-md border px-2 py-1 font-semibold ${selectedStopVisual ? getDriverStopBadgeClassName(selectedStopVisual) : 'border-border bg-surface text-text'}`}>
                          {selectedStopVisual ? getDriverStopLabel(selectedStopVisual) : 'status indisponivel'}
                        </span>
                        <span className="inline-flex rounded-md border border-border bg-surface px-2 py-1 text-text">
                          {selectedStopInvoiceNumber ? `NF ${selectedStopInvoiceNumber}` : 'NF nao identificada'}
                        </span>
                        <span className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-text">
                          {selectedStopCustomerName || 'Cliente nao identificado'}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                          Acoes da parada
                        </span>
                        {MANUAL_STOP_STATUS_ACTIONS.map((action) => {
                          const actionAllowed = canManuallyUpdateStopStatus(selectedStopStatus, action.status);
                          const actionLoading = selectedStopUpdating && stopStatusUpdate?.nextStatus === action.status;
                          const actionDisabled = !selectedStopMeta?.note_id || !numericDriverId || !actionAllowed || selectedStopUpdating;

                          return (
                            <button
                              key={`${driver.trip_id}-${selectedStopSequence}-${action.status}`}
                              type="button"
                              onClick={() => handleStopStatusUpdate({
                                tripId: driver.trip_id,
                                sequence: selectedStopSequence,
                                stopId: selectedStopMeta?.note_id || null,
                                currentStatus: selectedStopStatus,
                                nextStatus: action.status,
                                driverId: numericDriverId || null,
                                driverName: driver.driver_name || null,
                                invoiceNumber: selectedStopInvoiceNumber,
                              })}
                              disabled={actionDisabled}
                              className={`inline-flex rounded-md border px-2 py-1 font-semibold transition ${getSemanticToneClassName(action.tone)} ${actionDisabled ? 'cursor-not-allowed opacity-60' : 'hover:brightness-95'}`}
                              aria-label={`${action.label} da NF ${selectedStopInvoiceNumber || selectedStopSequence}`}
                            >
                              {actionLoading ? 'Salvando...' : action.label}
                            </button>
                          );
                        })}
                      </div>

                      <p className="mt-2 text-[11px] text-muted">
                        {!selectedStopMeta?.note_id
                          ? 'Esta parada nao possui identificador operacional para atualizacao.'
                          : !numericDriverId
                            ? 'Esta rota precisa de um motorista vinculado para permitir a atualizacao operacional.'
                            : selectedStopAllowsManualUpdate
                              ? 'Selecione uma das acoes para registrar devolucao, reentrega, canhoto retido ou cancelamento direto do monitoramento.'
                              : 'Esta parada ja esta finalizada e nao aceita nova mudanca por esse atalho.'}
                      </p>

                      {selectedStopFeedbackMessage ? (
                        <div className={`mt-2 rounded-md border px-2 py-1.5 ${getSemanticToneClassName(selectedStopFeedbackMessage.tone, 'panel')}`}>
                          {selectedStopFeedbackMessage.message}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!drivers.length ? (
              <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
                {isMobileView ? 'Nenhuma rota disponível para hoje.' : 'Nenhuma rota para a data selecionada.'}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-3 hidden w-full rounded-lg border border-border bg-card p-3 md:block">
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
              onMarkerClick={(deliveryId) => {
                setSelectedDeliveryInvoice(deliveryId);
                const delivery = deliveries.find((row) => row.invoice_number === deliveryId) || null;
                if (delivery?.driver_id) {
                  setSelectedDriverId(Number(delivery.driver_id));
                }
              }}
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
              const Icon = DELIVERY_STAGE_ICONS[stage];
              const markerTone = getLegendMarkerVisual(stage);
              return (
                <span
                  key={`legend-map-${stage}`}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                >
                  <span className="inline-flex items-center justify-center">
                    <MapMarkerPin
                      icon={Icon}
                      tone={markerTone}
                      size={20}
                      iconSize={11}
                      iconStrokeWidth={1.4}
                    />
                  </span>
                  {STAGE_LABELS[stage]}
                </span>
              );
            })}
          </div>

          <p className="mt-1 text-xs text-muted">
            O pin recebe a cor do status. Em entregas atribuídas e em rota, a borda ou o fundo usam a cor do motorista quando isso ajuda a leitura operacional.
          </p>

          <div className="mt-2 text-xs text-muted">
            Zoom atual: {mapViewport?.zoom || '--'}
          </div>

          {loading ? (
            <p className="mt-2 text-xs text-muted">Atualizando monitoramento...</p>
          ) : null}
        </section>

        <section className="mt-3 hidden w-full rounded-lg border border-border bg-card p-3 md:block">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text">Lista de entregas</h3>
            <span className="text-xs text-muted">
              {selectedDriverId
                ? `Mostrando ${listRows.length} entrega(s) do motorista selecionado`
                : `Mostrando ${Math.min(listRows.length, 120)} de ${filteredDeliveries.length} entregas filtradas`}
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
