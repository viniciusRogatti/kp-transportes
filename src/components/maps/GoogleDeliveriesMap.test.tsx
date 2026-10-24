import { render, screen } from '@testing-library/react';
import GoogleDeliveriesMap from './GoogleDeliveriesMap';
import type { GoogleDriverLocation } from '../../pages/deliveryMonitoring/googleMapAdapter';
const mockOverlays: { position: object; getPixelPositionOffset: (w: number, h: number) => object }[] = [];
jest.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: true }),
  GoogleMap: ({ children }: any) => <div>{children}</div>,
  OverlayView: { OVERLAY_MOUSE_TARGET: 'mouse' },
  OverlayViewF: (props: any) => { mockOverlays.push(props); return <div>{props.children}</div>; },
  CircleF: ({ radius, center }: any) => <div data-testid="accuracy" data-radius={radius} data-center={JSON.stringify(center)} />,
}));
const driver: GoogleDriverLocation = { id: 'driver-7', driverId: 7, driverName: 'Jonathan teste', lat: -22.9, lng: -47.1, color: '#2563eb', status: 'on_the_way', attentionLevel: null, updatedAt: null, accuracyMeters: 65 };
beforeEach(() => { mockOverlays.length = 0; });
test('centers the circular truck on the real GPS point and shows reported uncertainty when selected', () => {
  render(<GoogleDeliveriesMap apiKey="test-key" center={{ lat: 0, lng: 0 }} deliveries={[]} driverLocations={[driver]} selectedDriverId={7} selectedDeliveryId={null} onMarkerClick={jest.fn()} datasetKey="test" />);
  expect(mockOverlays[0].position).toEqual({ lat: driver.lat, lng: driver.lng });
  expect(mockOverlays[0].getPixelPositionOffset(34, 34)).toEqual({ x: -17, y: -17 });
  expect(screen.getByTestId('accuracy')).toHaveAttribute('data-radius', '65');
  expect(screen.getByTestId('accuracy')).toHaveAttribute('data-center', JSON.stringify({ lat: driver.lat, lng: driver.lng }));
});
test('does not invent a precision circle when the device provides no accuracy', () => {
  render(<GoogleDeliveriesMap apiKey="test-key" center={{ lat: 0, lng: 0 }} deliveries={[]} driverLocations={[{ ...driver, accuracyMeters: null }]} selectedDriverId={7} selectedDeliveryId={null} onMarkerClick={jest.fn()} datasetKey="test" />);
  expect(screen.queryByTestId('accuracy')).not.toBeInTheDocument();
});
