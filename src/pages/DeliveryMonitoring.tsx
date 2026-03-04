import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { io, Socket } from 'socket.io-client';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import Header from '../components/Header';
import { API_URL, COMPANY_LOCATION } from '../data';
import { Container } from '../style/invoices';
import 'leaflet/dist/leaflet.css';

type DeliveryStage = 'unassigned' | 'assigned' | 'on_the_way' | 'on_site' | 'completed';

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

type MonitoringResponse = {
  date: string;
  invoice_reference_date?: string;
  used_fallback_date?: boolean;
  generated_at: string;
  summary: MonitoringSummary;
  deliveries: DeliveryRow[];
  drivers: DriverSummary[];
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

type MarkerCluster = {
  kind: 'cluster';
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  dominantStage: DeliveryStage;
  stageCounts: Record<DeliveryStage, number>;
  previewRows: Array<{
    invoice_number: string;
    customer_name: string;
    stage: DeliveryStage;
    driver_name: string | null;
  }>;
};

type MarkerPoint = {
  kind: 'point';
  row: DeliveryRow;
};

type MarkerRenderable = MarkerCluster | MarkerPoint;
type MapViewMode = 'cluster' | 'points';

const STAGE_LABELS: Record<DeliveryStage, string> = {
  unassigned: 'Sem motorista',
  assigned: 'Atribuida',
  on_the_way: 'A caminho',
  on_site: 'No local',
  completed: 'Finalizada',
};

const STAGE_ORDER: DeliveryStage[] = ['unassigned', 'assigned', 'on_the_way', 'on_site', 'completed'];

const STAGE_STYLE: Record<DeliveryStage, { fill: string; weight: number; opacity: number }> = {
  unassigned: { fill: '#94a3b8', weight: 2, opacity: 0.95 },
  assigned: { fill: '#ffffff', weight: 3, opacity: 0.95 },
  on_the_way: { fill: '#fde047', weight: 3, opacity: 0.98 },
  on_site: { fill: '#22c55e', weight: 4, opacity: 0.98 },
  completed: { fill: '#9ca3af', weight: 2, opacity: 0.45 },
};

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvents({
    zoomend(event) {
      onZoomChange(event.target.getZoom());
    },
  });
  return null;
}

function FitBoundsToDeliveries({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 14,
    });
  }, [map, points]);

  return null;
}

const resolveStageFromCounts = (rows: DeliveryRow[]): DeliveryStage => {
  const counter = {
    unassigned: 0,
    assigned: 0,
    on_the_way: 0,
    on_site: 0,
    completed: 0,
  };

  rows.forEach((row) => {
    counter[row.stage] += 1;
  });

  return STAGE_ORDER.reduce((best, stage) => (
    counter[stage] > counter[best] ? stage : best
  ), 'unassigned' as DeliveryStage);
};

const stagePriority = (stage: DeliveryStage) => {
  if (stage === 'on_site') return 0;
  if (stage === 'on_the_way') return 1;
  if (stage === 'assigned') return 2;
  if (stage === 'unassigned') return 3;
  return 4;
};

const buildClusteredMarkers = (rows: DeliveryRow[], zoom: number, viewMode: MapViewMode): MarkerRenderable[] => {
  if (viewMode === 'points' || zoom >= 13 || rows.length <= 120) {
    return rows.map((row) => ({ kind: 'point', row }));
  }

  const cellSize = zoom <= 7 ? 0.35 : zoom <= 9 ? 0.18 : zoom <= 11 ? 0.08 : 0.035;
  const buckets = new Map<string, { latSum: number; lngSum: number; rows: DeliveryRow[] }>();

  rows.forEach((row) => {
    const latitude = Number(row.geolocation.latitude);
    const longitude = Number(row.geolocation.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const latBucket = Math.floor(latitude / cellSize);
    const lngBucket = Math.floor(longitude / cellSize);
    const key = `${latBucket}:${lngBucket}`;
    const current = buckets.get(key);
    if (!current) {
      buckets.set(key, {
        latSum: latitude,
        lngSum: longitude,
        rows: [row],
      });
      return;
    }
    current.latSum += latitude;
    current.lngSum += longitude;
    current.rows.push(row);
  });

  return Array.from(buckets.entries()).map(([key, bucket]) => {
    if (bucket.rows.length === 1) {
      return {
        kind: 'point',
        row: bucket.rows[0],
      } as MarkerPoint;
    }

    return {
      kind: 'cluster',
      id: key,
      latitude: bucket.latSum / bucket.rows.length,
      longitude: bucket.lngSum / bucket.rows.length,
      count: bucket.rows.length,
      dominantStage: resolveStageFromCounts(bucket.rows),
      stageCounts: bucket.rows.reduce<Record<DeliveryStage, number>>((accumulator, row) => {
        accumulator[row.stage] += 1;
        return accumulator;
      }, {
        unassigned: 0,
        assigned: 0,
        on_the_way: 0,
        on_site: 0,
        completed: 0,
      }),
      previewRows: bucket.rows
        .slice()
        .sort((left, right) => stagePriority(left.stage) - stagePriority(right.stage))
        .slice(0, 8)
        .map((row) => ({
          invoice_number: row.invoice_number,
          customer_name: row.customer_name,
          stage: row.stage,
          driver_name: row.driver_name,
        })),
    } as MarkerCluster;
  });
};

const hasCoordinates = (row: DeliveryRow) => {
  const latitude = row.geolocation.latitude;
  const longitude = row.geolocation.longitude;
  if (latitude === null || longitude === null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return !(latitude === 0 && longitude === 0);
};

function DeliveryMonitoring() {
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>('cluster');
  const [overview, setOverview] = useState<MonitoringResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<AddressDiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(10);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      setOverview(overviewData);
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
  const drivers = useMemo(() => overview?.drivers || [], [overview]);
  const summary = overview?.summary;

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((row) => {
      if (statusFilter !== 'all' && row.stage !== statusFilter) return false;
      return true;
    });
  }, [deliveries, statusFilter]);

  const mapDeliveries = useMemo(
    () => filteredDeliveries.filter((row) => hasCoordinates(row)),
    [filteredDeliveries],
  );

  const renderables = useMemo(
    () => buildClusteredMarkers(mapDeliveries, zoom, mapViewMode),
    [mapDeliveries, zoom, mapViewMode],
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

  const boundsPoints = useMemo<Array<[number, number]>>(
    () => mapDeliveries.map((row) => [Number(row.geolocation.latitude), Number(row.geolocation.longitude)]),
    [mapDeliveries],
  );

  const selectedDriverRoutes = useMemo(() => {
    if (!selectedDriverId || !showRoutes) return [];
    return drivers
      .filter((driver) => Number(driver.driver_id) === Number(selectedDriverId))
      .map((driver) => ({
        ...driver,
        points: driver.highlighted_stops
          .filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude))
          .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))
          .map((stop) => [stop.latitude, stop.longitude] as [number, number]),
      }))
      .filter((driver) => driver.points.length >= 2);
  }, [drivers, selectedDriverId, showRoutes]);

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
            <div className="inline-flex h-10 overflow-hidden rounded-md border border-border bg-surface">
              <button
                type="button"
                onClick={() => setMapViewMode('cluster')}
                className={`px-3 text-sm font-semibold ${mapViewMode === 'cluster' ? 'bg-sky-500/20 text-sky-700' : 'text-text'}`}
              >
                Agrupado
              </button>
              <button
                type="button"
                onClick={() => setMapViewMode('points')}
                className={`border-l border-border px-3 text-sm font-semibold ${mapViewMode === 'points' ? 'bg-sky-500/20 text-sky-700' : 'text-text'}`}
              >
                Pontos
              </button>
            </div>
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
          </div>

          <div className="mt-3 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800">
            Geocoding automático ativo: entregas sem coordenadas entram em fila no backend e o mapa atualiza sozinho.
          </div>

          {overview?.used_fallback_date ? (
            <div className="mt-2 rounded-md border border-amber-500/45 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
              Exibindo notas da data {overview.invoice_reference_date} para acompanhar a operação de {overview.date}.
            </div>
          ) : null}

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
                  className={`min-w-[280px] rounded-md border px-3 py-2 text-left transition ${isActive ? 'border-sky-500 bg-sky-500/10' : 'border-border bg-surface'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm text-text">{driver.driver_name}</strong>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">{`Rota #${driver.trip_id}`}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{`${driver.completed_deliveries}/${driver.total_deliveries} finalizadas`}</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
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
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            {STAGE_ORDER.map((stage) => (
              <span key={stage} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full border"
                  style={{
                    backgroundColor: STAGE_STYLE[stage].fill,
                    borderColor: '#0f172a',
                    opacity: STAGE_STYLE[stage].opacity,
                  }}
                />
                {STAGE_LABELS[stage]}
              </span>
            ))}
          </div>

          <div className="h-[calc(100vh-360px)] min-h-[380px] overflow-hidden rounded-md border border-border">
            <MapContainer
              center={[COMPANY_LOCATION.lat, COMPANY_LOCATION.lng]}
              zoom={10}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ZoomTracker onZoomChange={setZoom} />
              <FitBoundsToDeliveries points={boundsPoints} />

              {selectedDriverRoutes.map((route) => (
                <Polyline
                  key={`route-${route.trip_id}`}
                  positions={route.points}
                  pathOptions={{
                    color: route.color,
                    weight: 4,
                    opacity: 0.85,
                  }}
                />
              ))}

              {renderables.map((item) => {
                if (item.kind === 'cluster') {
                  const stageStyle = STAGE_STYLE[item.dominantStage];
                  return (
                    <CircleMarker
                      key={item.id}
                      center={[item.latitude, item.longitude]}
                      radius={Math.min(24, 9 + item.count * 0.6)}
                      pathOptions={{
                        color: '#0f172a',
                        weight: 2,
                        fillColor: stageStyle.fill,
                        fillOpacity: 0.78,
                      }}
                    >
                      <Popup>
                        <div className="space-y-2">
                          <div className="text-sm font-semibold">{`${item.count} entregas neste agrupamento`}</div>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {STAGE_ORDER.map((stage) => (
                              <span key={stage} className="rounded border border-border bg-surface px-1.5 py-1">
                                {`${STAGE_LABELS[stage]}: ${item.stageCounts[stage] || 0}`}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-muted">Principais entregas:</div>
                          <ul className="max-h-36 space-y-1 overflow-auto pr-1 text-xs">
                            {item.previewRows.map((row) => (
                              <li key={`cluster-${item.id}-${row.invoice_number}`} className="rounded border border-border bg-surface px-2 py-1">
                                <p className="font-semibold">{`NF ${row.invoice_number}`}</p>
                                <p className="text-slate-600">{row.customer_name || 'Cliente sem nome'}</p>
                                <p>{`${STAGE_LABELS[row.stage]}${row.driver_name ? ` • ${row.driver_name}` : ''}`}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                }

                const row = item.row;
                const stageStyle = STAGE_STYLE[row.stage];
                const isDimmed = selectedDriverId !== null && Number(row.driver_id) !== Number(selectedDriverId);
                const markerOpacity = isDimmed ? 0.18 : stageStyle.opacity;

                return (
                  <CircleMarker
                    key={row.invoice_number}
                    center={[Number(row.geolocation.latitude), Number(row.geolocation.longitude)]}
                    radius={row.stage === 'on_site' ? 9 : row.stage === 'completed' ? 6 : 7}
                    pathOptions={{
                      color: row.driver_id ? row.driver_color : '#334155',
                      weight: stageStyle.weight,
                      fillColor: stageStyle.fill,
                      fillOpacity: markerOpacity,
                      opacity: isDimmed ? 0.3 : 1,
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -7]} opacity={0.95}>
                      <div className="text-xs">
                        <div className="font-semibold">{`NF ${row.invoice_number}`}</div>
                        <div>{row.customer_name || 'Cliente sem nome'}</div>
                      </div>
                    </Tooltip>
                    <Popup>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{`NF ${row.invoice_number}`}</p>
                        <p className="text-xs text-slate-600">{row.customer_name || 'Cliente sem nome'}</p>
                        <p className="text-xs">{`${row.address || '-'}, ${row.address_number || 's/n'} - ${row.city || '-'}/${row.state || '-'}`}</p>
                        <p className="text-xs">{`Status: ${STAGE_LABELS[row.stage]}`}</p>
                        <p className="text-xs">{`Motorista: ${row.driver_name || 'Nao atribuido'}`}</p>
                        <p className="text-xs">{`Geocoding: ${row.geolocation.status}`}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
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
