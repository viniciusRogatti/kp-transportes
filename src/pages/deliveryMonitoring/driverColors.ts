// Keep these fixed slots aligned with backend/src/utils/monitoringDriverColors.js.
export const DRIVER_COLORS = [
  '#2563EB', '#EA580C', '#16A34A', '#9333EA', '#DB2777', '#0891B2', '#DC2626', '#CA8A04', '#334155', '#92400E',
  '#BB88CC', '#FF00CC', '#666622', '#DD8888', '#88AA00', '#992299', '#66BB99', '#66AAFF', '#00BB00', '#883366',
  '#006644', '#FF77DD', '#445599', '#BB77FF', '#4411FF', '#EE00FF', '#EE8855', '#BBAA55', '#AA3344', '#226600',
] as const;

type Driver = { driver_id: number | null; trip_id: number; color: string; color_order?: number | null; color_slot?: number | null };
type Delivery = { driver_id: number | null; trip_id: number | null; driver_color: string };
const validOrder = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

// Normalize the whole response before company/status/selection filters. Older APIs
// have no assignment timestamp/order: their earliest trip ID is a stable fallback,
// not proof of the actual scanning order. The new API's order takes precedence.
export function applyMonitoringDriverColors<T extends { drivers: Driver[]; deliveries: Delivery[] }>(overview: T): T {
  const entries = new Map<number, { driverId: number; tripId: number; order?: number }>();
  const add = (driverId: number | null, tripId: number | null, order?: number | null) => {
    if (!driverId) return;
    const previous = entries.get(driverId);
    entries.set(driverId, {
      driverId,
      tripId: Math.min(previous?.tripId ?? Infinity, tripId && tripId > 0 ? tripId : Infinity),
      order: validOrder(order) ? Math.min(previous?.order ?? Infinity, order) : previous?.order,
    });
  };
  overview.drivers.forEach(driver => add(driver.driver_id, driver.trip_id, driver.color_order));
  overview.deliveries.forEach(delivery => add(delivery.driver_id, delivery.trip_id));
  const ordered = Array.from(entries.values()).sort((a, b) =>
    (a.order ?? Infinity) - (b.order ?? Infinity) || a.tripId - b.tripId || a.driverId - b.driverId);
  const used = new Set(ordered.flatMap(entry => entry.order === undefined ? [] : [entry.order]));
  const colors = new Map<number, { color: string; color_order: number; color_slot: number }>();
  let nextOrder = 0;
  ordered.forEach(entry => {
    while (used.has(nextOrder)) nextOrder += 1;
    const order = entry.order ?? nextOrder;
    used.add(order);
    colors.set(entry.driverId, { color: DRIVER_COLORS[order % DRIVER_COLORS.length], color_order: order, color_slot: order % DRIVER_COLORS.length });
  });
  return {
    ...overview,
    drivers: overview.drivers.map(driver => ({ ...driver, ...colors.get(driver.driver_id!) })),
    deliveries: overview.deliveries.map(delivery => ({ ...delivery,
      driver_color: colors.get(delivery.driver_id!)?.color ?? delivery.driver_color,
    })),
  };
}
