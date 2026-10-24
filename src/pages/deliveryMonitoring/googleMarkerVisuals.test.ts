import { getDeliveryMarkerIcon, getDeliveryMarkerPriority, getDeliveryMarkerStyleByStatus, getDriverMarkerStyle } from './googleMarkerVisuals';
import type { GoogleDeliveryMapItem } from './googleMapAdapter';
const delivery = (status: GoogleDeliveryMapItem['status'], stopStatus: string | null = null) => ({ status, stopStatus, danfeStatus: null, driverId: 7, driverColor: '#16a34a' });

test('prioritizes active destinations above pending and resolved deliveries at every zoom', () => {
  const pending = getDeliveryMarkerPriority(delivery('assigned'));
  const complete = getDeliveryMarkerPriority(delivery('completed'));
  for (const status of ['on_the_way', 'on_site'] as const) {
    const active = getDeliveryMarkerPriority(delivery(status));
    expect(active.scale).toBeGreaterThan(pending.scale);
    expect(active.zIndex).toBeGreaterThan(pending.zIndex);
    expect(getDeliveryMarkerStyleByStatus(delivery(status)).opacity).toBe(1);
  }
  expect(pending.scale).toBeGreaterThan(complete.scale);
  expect(pending.zIndex).toBeGreaterThan(complete.zIndex);
  expect(getDeliveryMarkerStyleByStatus(delivery('assigned')).opacity).toBeGreaterThan(getDeliveryMarkerStyleByStatus(delivery('completed')).opacity!);
});

test.each(['returned', 'redelivery', 'cancelled', 'retained', 'delivered_pending_receipt'])('keeps %s discreet without losing its status color', status => {
  const input = delivery(status === 'delivered_pending_receipt' ? 'pending_receipt' : 'completed', status);
  expect(getDeliveryMarkerPriority(input).zIndex).toBeLessThan(getDeliveryMarkerPriority(delivery('assigned')).zIndex);
  expect(getDeliveryMarkerStyleByStatus(input).opacity).toBeLessThan(0.5);
});

test('distinguishes the truck from deliveries and preserves driver color and attention', () => {
  const tone = getDriverMarkerStyle({ color: '#f97316', attentionLevel: null });
  expect(tone).toMatchObject({ opacity: 1, borderColor: '#f97316', iconColor: '#ffffff', labelTextColor: '#ffffff' });
  expect(tone.backgroundColor).not.toBe(getDeliveryMarkerStyleByStatus(delivery('assigned')).backgroundColor);
  expect(getDriverMarkerStyle({ color: '#f97316', attentionLevel: 'CRITICAL' }).haloColor).toBe('#e11d48');
});

test('does not present returns as delivered checkmarks', () => {
  expect(getDeliveryMarkerIcon(delivery('completed', 'redelivery'))).not.toBe(getDeliveryMarkerIcon(delivery('completed', 'delivered')));
  expect(getDeliveryMarkerIcon(delivery('completed', 'returned'))).toBe(getDeliveryMarkerIcon(delivery('completed', 'redelivery')));
});
