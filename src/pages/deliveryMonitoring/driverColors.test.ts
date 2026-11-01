import { applyMonitoringDriverColors, DRIVER_COLORS } from './driverColors';

const driver = (id: number, trip = id, order?: number) => ({ driver_id: id, trip_id: trip, color: '#old', color_order: order });
const delivery = (id: number | null, trip: number | null = id) => ({ driver_id: id, trip_id: trip, driver_color: '#old' });

it('applies all 30 slots to legacy API drivers, their runs and deliveries without mutating the response', () => {
  const drivers = Array.from({ length: 31 }, (_, i) => driver(i + 1));
  const overview = { drivers: [...drivers, driver(1, 99)].reverse(), deliveries: [delivery(1), delivery(11), delivery(30), delivery(null)] };
  const result = applyMonitoringDriverColors(overview);
  expect(new Set(DRIVER_COLORS).size).toBe(30);
  drivers.forEach((entry, i) => expect(result.drivers.find(row => row.trip_id === entry.trip_id)?.color).toBe(DRIVER_COLORS[i % 30]));
  expect(result.drivers.find(row => row.trip_id === 99)?.color).toBe(DRIVER_COLORS[0]);
  expect(result.deliveries.map(row => row.driver_color)).toEqual([DRIVER_COLORS[0], DRIVER_COLORS[10], DRIVER_COLORS[29], '#old']);
  expect(overview.drivers.every(row => row.color === '#old')).toBe(true);
  expect(applyMonitoringDriverColors({ ...overview, drivers: [...overview.drivers].reverse() }).deliveries).toEqual(result.deliveries);
});

it('prefers the API assignment order over trip ID and reserves those slots for mixed versions', () => {
  const result = applyMonitoringDriverColors({
    drivers: [driver(1, 1, 2), driver(2, 100, 0), driver(1, 101, 2), driver(3, 2)],
    deliveries: [delivery(1), delivery(2), delivery(3)],
  });
  expect(result.deliveries.map(row => row.driver_color)).toEqual([DRIVER_COLORS[2], DRIVER_COLORS[0], DRIVER_COLORS[1]]);
  expect(result.drivers[2].color).toBe(DRIVER_COLORS[2]);
});
