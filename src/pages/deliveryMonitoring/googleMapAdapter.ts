import { DeliveryStage } from './mapStyles';

export type MonitoringDeliveryForMap = {
  invoice_number: string;
  customer_name: string;
  city: string;
  neighborhood: string;
  stage: DeliveryStage;
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
  color: string;
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

const normalizeNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
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
      points: driver.highlighted_stops
        .filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude))
        .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))
        .map((stop) => ({ lat: stop.latitude, lng: stop.longitude })),
    }))
    .filter((route) => route.points.length >= 2);
};
