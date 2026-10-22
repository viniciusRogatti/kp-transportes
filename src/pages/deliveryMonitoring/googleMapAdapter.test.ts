import { toGoogleDeliveryMapItems } from './googleMapAdapter';
const row = { invoice_number: '123', customer_name: 'Cliente', city: '', neighborhood: '', stage: 'assigned' as const, driver_id: null, driver_name: null, driver_color: '', geolocation: { latitude: -22.9, longitude: -47.1 } };
test('keeps equal invoice numbers from different companies as distinct markers', () => {
  expect(toGoogleDeliveryMapItems([{ ...row, company_id: 1 }, { ...row, company_id: 2 }]).map(item => item.id)).toEqual(['1:123', '2:123']);
});
test('does not manufacture markers for invalid or absent coordinates', () => {
  expect(toGoogleDeliveryMapItems([{ ...row, geolocation: { latitude: null, longitude: null } }, { ...row, geolocation: { latitude: 100, longitude: 0 } }])).toEqual([]);
});

test('uses the new operational coordinates and carries the audit metadata without mixing identical NFs', () => {
  const change = { locationId: '1001', label: 'Doca corrigida', kind: 'sole' as const, changedAt: '2026-10-22T12:00:00Z', driverId: 7, driverName: 'Jonathan Teste' };
  const markers = toGoogleDeliveryMapItems([{ ...row, company_id: 1, location_change: change, geolocation: { latitude: -22.91, longitude: -47.11 } }, { ...row, company_id: 2 }]);
  expect(markers[0]).toMatchObject({ id: '1:123', lat: -22.91, lng: -47.11, locationChange: change });
  expect(markers[1].locationChange).toBeNull();
});
