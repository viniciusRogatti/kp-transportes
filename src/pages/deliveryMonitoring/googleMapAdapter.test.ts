import { toGoogleDeliveryMapItems } from './googleMapAdapter';
const row = { invoice_number: '123', customer_name: 'Cliente', city: '', neighborhood: '', stage: 'assigned' as const, driver_id: null, driver_name: null, driver_color: '', geolocation: { latitude: -22.9, longitude: -47.1 } };
test('keeps equal invoice numbers from different companies as distinct markers', () => {
  expect(toGoogleDeliveryMapItems([{ ...row, company_id: 1 }, { ...row, company_id: 2 }]).map(item => item.id)).toEqual(['1:123', '2:123']);
});
test('does not manufacture markers for invalid or absent coordinates', () => {
  expect(toGoogleDeliveryMapItems([{ ...row, geolocation: { latitude: null, longitude: null } }, { ...row, geolocation: { latitude: 100, longitude: 0 } }])).toEqual([]);
});
