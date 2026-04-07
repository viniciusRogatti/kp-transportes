import { DeliveryStage } from './mapStyles';

export type MonitoringDeliveryForMap = {
  invoice_number: string;
  customer_name: string;
  city: string;
  neighborhood: string;
  stage: DeliveryStage;
  danfe_status?: string | null;
  stop_status?: string | null;
  trip_id?: number | null;
  sequence?: number | null;
  driver_id: number | null;
  driver_name: string | null;
  driver_color: string;
  geolocation: {
    latitude: number | null;
    longitude: number | null;
    status?: string;
    last_geocoded_at?: string | null;
  };
};

export type MonitoringDriverForMap = {
  trip_id: number;
  driver_id: number | null;
  driver_name?: string;
  color: string;
  stage?: DeliveryStage | 'idle';
  current_status?: string;
  attention_level?: 'INFO' | 'WARNING' | 'CRITICAL' | null;
  live_location?: {
    latitude: number | null;
    longitude: number | null;
    updated_at?: string | null;
  } | null;
  highlighted_stops: Array<{
    latitude: number;
    longitude: number;
    sequence: number | null;
  }>;
};

export type GoogleDeliveryMapItem = {
  id: string;
  lat: number;
  lng: number;
  status: DeliveryStage;
  stopStatus: string | null;
  danfeStatus: string | null;
  driverId: number | null;
  driverColor: string | null;
  label: string;
  customerName: string;
  city: string;
  neighborhood: string;
  driverName: string | null;
  lastUpdatedAt: string | null;
};

export type GoogleDeliveryRoute = {
  id: string;
  color: string;
  segments: Array<{
    id: string;
    points: Array<{ lat: number; lng: number }>;
    completed: boolean;
  }>;
};

export type GoogleDriverLocation = {
  id: string;
  lat: number;
  lng: number;
  driverId: number | null;
  driverName: string;
  color: string;
  status: string;
  attentionLevel: 'INFO' | 'WARNING' | 'CRITICAL' | null;
  updatedAt: string | null;
};

const normalizeNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const isValidCoordinatePair = (latitude: unknown, longitude: unknown) => {
  const normalizedLatitude = normalizeNumber(latitude);
  const normalizedLongitude = normalizeNumber(longitude);
  if (normalizedLatitude === null || normalizedLongitude === null) return false;
  return !(normalizedLatitude === 0 && normalizedLongitude === 0);
};

const COMPLETED_ROUTE_STATUSES = new Set(['delivered', 'completed']);
const normalizeStatus = (value: unknown) => String(value || '').trim().toLowerCase();
const ROUTE_SEGMENT_SAMPLES = 10;

type RoutePoint = {
  lat: number;
  lng: number;
  completed: boolean;
};

const interpolateCatmullRom = (
  previous: RoutePoint,
  start: RoutePoint,
  end: RoutePoint,
  next: RoutePoint,
  t: number,
) => {
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    lat: 0.5 * (
      (2 * start.lat)
      + (-previous.lat + end.lat) * t
      + ((2 * previous.lat) - (5 * start.lat) + (4 * end.lat) - next.lat) * t2
      + (-previous.lat + (3 * start.lat) - (3 * end.lat) + next.lat) * t3
    ),
    lng: 0.5 * (
      (2 * start.lng)
      + (-previous.lng + end.lng) * t
      + ((2 * previous.lng) - (5 * start.lng) + (4 * end.lng) - next.lng) * t2
      + (-previous.lng + (3 * start.lng) - (3 * end.lng) + next.lng) * t3
    ),
  };
};

const buildSmoothedSegmentPoints = (routePoints: RoutePoint[], index: number) => {
  const previous = routePoints[Math.max(0, index - 1)];
  const start = routePoints[index];
  const end = routePoints[index + 1];
  const next = routePoints[Math.min(routePoints.length - 1, index + 2)];

  const points = Array.from({ length: ROUTE_SEGMENT_SAMPLES + 1 }, (_, sampleIndex) => (
    interpolateCatmullRom(previous, start, end, next, sampleIndex / ROUTE_SEGMENT_SAMPLES)
  ));

  points[0] = { lat: start.lat, lng: start.lng };
  points[points.length - 1] = { lat: end.lat, lng: end.lng };

  return points;
};

export const hasDeliveryCoordinates = (row: MonitoringDeliveryForMap) => {
  const latitude = normalizeNumber(row.geolocation.latitude);
  const longitude = normalizeNumber(row.geolocation.longitude);
  if (latitude === null || longitude === null) return false;
  return !(latitude === 0 && longitude === 0);
};

export const toGoogleDeliveryMapItems = (rows: MonitoringDeliveryForMap[]): GoogleDeliveryMapItem[] => {
  return rows
    .filter((row) => hasDeliveryCoordinates(row))
    .map((row) => ({
      id: row.invoice_number,
      lat: Number(row.geolocation.latitude),
      lng: Number(row.geolocation.longitude),
      status: row.stage,
      stopStatus: row.stop_status || null,
      danfeStatus: row.danfe_status || null,
      driverId: row.driver_id,
      driverColor: row.driver_id ? row.driver_color : null,
      label: `NF ${row.invoice_number}`,
      customerName: row.customer_name || 'Cliente sem nome',
      city: row.city || '-',
      neighborhood: row.neighborhood || '-',
      driverName: row.driver_name,
      lastUpdatedAt: row.geolocation.last_geocoded_at || null,
    }));
};

export const toGoogleDeliveryRoutes = (
  rows: MonitoringDeliveryForMap[],
  selectedDriverId: number | null,
  showRoutes: boolean,
  companyLocation: { lat: number; lng: number },
): GoogleDeliveryRoute[] => {
  if (!selectedDriverId || !showRoutes) return [];

  const rowsByTrip = new Map<number, MonitoringDeliveryForMap[]>();

  rows
    .filter((row) => Number(row.driver_id || 0) === Number(selectedDriverId) && hasDeliveryCoordinates(row))
    .forEach((row) => {
      const tripId = Number(row.trip_id || 0);
      if (tripId <= 0) return;
      if (!rowsByTrip.has(tripId)) {
        rowsByTrip.set(tripId, []);
      }
      rowsByTrip.get(tripId)?.push(row);
    });

  return Array.from(rowsByTrip.entries())
    .map(([tripId, tripRows]) => {
      const orderedStops = tripRows
        .slice()
        .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))
        .map((row) => ({
          lat: Number(row.geolocation.latitude),
          lng: Number(row.geolocation.longitude),
          completed: COMPLETED_ROUTE_STATUSES.has(normalizeStatus(row.stop_status))
            || COMPLETED_ROUTE_STATUSES.has(normalizeStatus(row.danfe_status))
            || row.stage === 'completed',
        }));

      const routePoints = [
        { lat: companyLocation.lat, lng: companyLocation.lng, completed: true },
        ...orderedStops,
        { lat: companyLocation.lat, lng: companyLocation.lng, completed: false },
      ];

      const segments = routePoints.slice(0, -1).map((point, index) => ({
        id: `route-${tripId}-segment-${index}`,
        points: buildSmoothedSegmentPoints(routePoints, index),
        completed: routePoints[index + 1].completed,
      }));

      return {
        id: `route-${tripId}`,
        color: tripRows[0]?.driver_color || '#0f172a',
        segments,
      };
    })
    .filter((route) => route.segments.length > 0);
};

export const toGoogleDriverLocations = (drivers: MonitoringDriverForMap[]): GoogleDriverLocation[] => {
  return drivers
    .filter((driver) => hasDeliveryCoordinates({
      invoice_number: `driver-${driver.trip_id}`,
      customer_name: '',
      city: '',
      neighborhood: '',
      stage: 'assigned',
      driver_id: driver.driver_id,
      driver_name: driver.driver_name || null,
      driver_color: driver.color,
      geolocation: {
        latitude: driver.live_location?.latitude ?? null,
        longitude: driver.live_location?.longitude ?? null,
      },
    }))
    .map((driver) => ({
      id: `driver-${driver.trip_id}-${driver.driver_id || 0}`,
      lat: Number(driver.live_location?.latitude),
      lng: Number(driver.live_location?.longitude),
      driverId: driver.driver_id,
      driverName: String(driver.driver_name || 'Motorista'),
      color: driver.color || '#0f172a',
      status: String(driver.current_status || driver.stage || 'idle'),
      attentionLevel: driver.attention_level || null,
      updatedAt: driver.live_location?.updated_at || null,
    }));
};
