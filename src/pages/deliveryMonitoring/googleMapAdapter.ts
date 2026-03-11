import { DeliveryStage } from './mapStyles';

export type MonitoringDeliveryForMap = {
  invoice_number: string;
  customer_name: string;
  city: string;
  neighborhood: string;
  stage: DeliveryStage;
  danfe_status?: string | null;
  stop_status?: string | null;
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
  points: Array<{ lat: number; lng: number }>;
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

const areRoutePointsNear = (
  left: { lat: number; lng: number } | null,
  right: { lat: number; lng: number } | null,
) => {
  if (!left || !right) return false;
  return Math.abs(left.lat - right.lat) < 0.00005 && Math.abs(left.lng - right.lng) < 0.00005;
};

const buildDriverRoutePoints = (driver: MonitoringDriverForMap) => {
  const stopPoints = driver.highlighted_stops
    .filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude))
    .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))
    .map((stop) => ({ lat: stop.latitude, lng: stop.longitude }));

  const hasLiveLocation = isValidCoordinatePair(
    driver.live_location?.latitude ?? null,
    driver.live_location?.longitude ?? null,
  );

  if (!hasLiveLocation) return stopPoints;

  const livePoint = {
    lat: Number(driver.live_location?.latitude),
    lng: Number(driver.live_location?.longitude),
  };

  if (areRoutePointsNear(livePoint, stopPoints[0] || null)) {
    return stopPoints;
  }

  // When the operator selects a driver, the route should start from the latest known driver position.
  return [livePoint, ...stopPoints];
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
  drivers: MonitoringDriverForMap[],
  selectedDriverId: number | null,
  showRoutes: boolean,
): GoogleDeliveryRoute[] => {
  if (!selectedDriverId || !showRoutes) return [];

  return drivers
    .filter((driver) => Number(driver.driver_id) === Number(selectedDriverId))
    .map((driver) => ({
      id: `route-${driver.trip_id}`,
      color: driver.color,
      points: buildDriverRoutePoints(driver),
    }))
    .filter((route) => route.points.length >= 2);
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
