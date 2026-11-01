import { act, render, screen } from '@testing-library/react';
import GoogleDeliveriesMap from './GoogleDeliveriesMap';
import { driverFirstName, layoutDriverLabels } from '../../pages/deliveryMonitoring/driverLabelLayout';
import type { GoogleDeliveryMapItem, GoogleDriverLocation } from '../../pages/deliveryMonitoring/googleMapAdapter';
const mockOverlays: { position: object; getPixelPositionOffset: (w: number, h: number) => object }[] = [];
const mockLoader = jest.fn();
let mockLoadMap = false;
let mockZoomChanged: () => void;
const mockControls = { push: jest.fn(), getArray: () => [], removeAt: jest.fn() };
const mockNativeMap = { fitBounds: jest.fn(), setCenter: jest.fn(), setZoom: jest.fn(), getZoom: jest.fn(() => 10), getBounds: () => null, controls: [mockControls] };
jest.mock('@react-google-maps/api', () => ({
  useJsApiLoader: (options: unknown) => mockLoader(options),
  GoogleMap: ({ children, onLoad, onZoomChanged }: any) => {
    mockZoomChanged = onZoomChanged;
    const { useEffect } = jest.requireActual('react');
    useEffect(() => { if (mockLoadMap) onLoad(mockNativeMap); }, []);
    return <div data-testid="loaded-map">{children}</div>;
  },
  OverlayView: { OVERLAY_MOUSE_TARGET: 'mouse' },
  OverlayViewF: (props: any) => { mockOverlays.push(props); return <div>{props.children}</div>; },
  CircleF: ({ radius, center }: any) => <div data-testid="accuracy" data-radius={radius} data-center={JSON.stringify(center)} />,
}));
const driver: GoogleDriverLocation = { id: 'driver-7', driverId: 7, driverName: 'Jonathan teste', lat: -22.9, lng: -47.1, color: '#2563eb', status: 'on_the_way', attentionLevel: null, updatedAt: null, accuracyMeters: 65 };
beforeEach(() => {
  mockLoadMap = false; mockOverlays.length = 0; mockNativeMap.fitBounds.mockClear(); mockNativeMap.setCenter.mockClear(); mockNativeMap.setZoom.mockClear(); mockLoader.mockReturnValue({ isLoaded: true });
  mockNativeMap.getZoom.mockReturnValue(10);
  Object.defineProperty(window, 'google', { configurable: true, value: { maps: { ControlPosition: { TOP_RIGHT: 0 }, LatLngBounds: class {
    points: {lat: number; lng: number}[] = [];
    extend(point: {lat: number; lng: number}) { this.points.push(point); }
  } } } });
});
test('shrinks the overview markers and updates sizes and names immediately on zoom without removing drivers', () => {
  mockLoadMap = true;
  mockNativeMap.getZoom.mockReturnValue(8);
  const other = { ...driver, id: 'other', driverId: 8, driverName: 'Outro motorista' };
  const delivery: GoogleDeliveryMapItem = { id: 'nf-1', lat: -22.9, lng: -47.1, status: 'assigned', stopStatus: null, danfeStatus: null, driverId: 7, driverColor: driver.color, label: 'NF teste', customerName: 'Teste', city: '', neighborhood: '', address: '', addressNumber: '', state: '', zipCode: '', driverName: driver.driverName, lastUpdatedAt: null };
  render(<GoogleDeliveriesMap apiKey="test" center={{lat:0,lng:0}} deliveries={[delivery]} driverLocations={[driver, other]} selectedDriverId={7} selectedDeliveryId={null} onMarkerClick={jest.fn()} />);
  const truck = screen.getByRole('button', { name: 'Ver localização de Jonathan teste' });
  const pin = screen.getByRole('button', { name: 'Selecionar entrega NF teste' });
  expect(truck).toHaveStyle({ width: '16px', height: '16px', transform: 'scale(1)' });
  expect(truck).toHaveTextContent('Jonathan');
  expect(truck.querySelector('.lucide-truck')).toBeInTheDocument();
  expect(pin).toHaveStyle({ width: '11px', height: '15px' });
  expect(screen.getByText('Jonathan')).toBeInTheDocument();
  expect(screen.getByText('Jonathan')).toHaveStyle({ fontSize: '10px' });
  expect(screen.queryByText('Jonathan teste')).not.toBeInTheDocument();
  expect(screen.getByText('Outro')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ver localização de Outro motorista' })).toBeInTheDocument();
  mockNativeMap.getZoom.mockReturnValue(16);
  act(() => mockZoomChanged());
  expect(truck).toHaveStyle({ width: '24px', height: '24px' });
  expect(truck).toHaveTextContent('Jonathan');
  expect(truck.querySelector('.lucide-truck')).toBeInTheDocument();
  expect(pin).toHaveStyle({ width: '20px', height: '27px' });
  expect(screen.getByText('Outro')).toBeInTheDocument();
  expect(screen.getByText('Jonathan')).toHaveStyle({ fontSize: '12px' });
  mockNativeMap.getZoom.mockReturnValue(9);
  act(() => mockZoomChanged());
  expect(truck).toHaveStyle({ width: '17px', height: '17px' });
  expect(screen.getByText('Outro')).toBeInTheDocument();
});
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

test('centers a selected truck while fitting both drivers, and does not move the map on every refresh', () => {
  mockLoadMap = true;
  const other = { ...driver, id: 'driver-8', driverId: 8, driverName: 'Outro motorista', lat: -22.8, lng: -47.3 };
  const props = { apiKey: 'test-key', center: { lat: 0, lng: 0 }, deliveries: [], driverLocations: [driver, other], selectedDriverId: null, selectedDeliveryId: null, onMarkerClick: jest.fn() };
  const { rerender } = render(<GoogleDeliveriesMap {...props} />);
  rerender(<GoogleDeliveriesMap {...props} selectedDriverId={7} focusRequestId={1} />);
  const bounds = mockNativeMap.fitBounds.mock.calls.slice(-1)[0][0];
  expect((bounds.points[0].lat + bounds.points[1].lat) / 2).toBeCloseTo(driver.lat);
  expect((bounds.points[0].lng + bounds.points[1].lng) / 2).toBeCloseTo(driver.lng);
  expect(bounds.points[0].lat).toBeLessThanOrEqual(other.lat); expect(bounds.points[1].lat).toBeGreaterThanOrEqual(other.lat);
  expect(screen.getByRole('button', { name: 'Ver localização de Outro motorista' })).toBeInTheDocument();
  const count = mockNativeMap.fitBounds.mock.calls.length;
  rerender(<GoogleDeliveriesMap {...props} selectedDriverId={7} focusRequestId={1} driverLocations={[{ ...driver, lat: -22.91 }, other]} />);
  expect(mockNativeMap.fitBounds).toHaveBeenCalledTimes(count);
  rerender(<GoogleDeliveriesMap {...props} selectedDriverId={7} focusRequestId={2} />);
  expect(mockNativeMap.fitBounds).toHaveBeenCalledTimes(count + 1);
});

test('does not focus a delivery address when the selected driver has no GPS position', () => {
  mockLoadMap = true;
  const { rerender } = render(<GoogleDeliveriesMap apiKey="test" center={{lat:0,lng:0}} deliveries={[]} driverLocations={[driver]} selectedDriverId={null} selectedDeliveryId={null} onMarkerClick={jest.fn()} />);
  const count = mockNativeMap.fitBounds.mock.calls.length;
  rerender(<GoogleDeliveriesMap apiKey="test" center={{lat:0,lng:0}} deliveries={[]} driverLocations={[driver]} selectedDriverId={8} selectedDeliveryId={null} onMarkerClick={jest.fn()} />);
  expect(mockNativeMap.fitBounds).toHaveBeenCalledTimes(count);
});

test('encaminha a chave ao Google e distingue carregamento, falha e configuração ausente', () => {
  const props = { apiKey: 'synthetic-key', center: { lat: 0, lng: 0 }, deliveries: [], driverLocations: [], selectedDriverId: null, selectedDeliveryId: null, onMarkerClick: jest.fn(), datasetKey: 'test' };
  mockLoader.mockReturnValue({ isLoaded: false });
  const { rerender } = render(<GoogleDeliveriesMap {...props} />);
  expect(screen.getByText('Carregando mapa Google...')).toBeInTheDocument();
  expect(screen.queryByTestId('loaded-map')).not.toBeInTheDocument();
  expect(mockLoader).toHaveBeenCalledWith(expect.objectContaining({ googleMapsApiKey: 'synthetic-key' }));
  mockLoader.mockReturnValue({ isLoaded: false, loadError: new Error('Google indisponível') });
  rerender(<GoogleDeliveriesMap {...props} />);
  expect(screen.getByText('Falha ao carregar Google Maps API.')).toBeInTheDocument();
  expect(screen.queryByTestId('loaded-map')).not.toBeInTheDocument();
  mockLoader.mockReturnValue({ isLoaded: true });
  rerender(<GoogleDeliveriesMap {...props} />);
  expect(screen.getByTestId('loaded-map')).toBeInTheDocument();
  rerender(<GoogleDeliveriesMap {...props} apiKey="" />);
  expect(screen.getByText(/Configure.*REACT_APP_GOOGLE_MAPS_API_KEY/)).toBeInTheDocument();
  expect(screen.queryByTestId('loaded-map')).not.toBeInTheDocument();
});

test('approaches the selected received position only on request and preserves the fleet', () => {
  mockLoadMap = true;
  const other = { ...driver, id: 'driver-8', driverId: 8, driverName: 'Outro motorista' };
  const props = { apiKey: 'test', center: { lat: 0, lng: 0 }, deliveries: [], driverLocations: [driver, other], selectedDriverId: 7, selectedDeliveryId: null, onMarkerClick: jest.fn(), driverZoomRequestId: 0 };
  const { rerender } = render(<GoogleDeliveriesMap {...props} />);
  rerender(<GoogleDeliveriesMap {...props} driverZoomRequestId={1} />);
  expect(mockNativeMap.setCenter).toHaveBeenLastCalledWith({ lat: driver.lat, lng: driver.lng });
  expect(mockNativeMap.setZoom).toHaveBeenLastCalledWith(14);
  expect(screen.getAllByRole('button', { name: /Ver localização de/ })).toHaveLength(2);
  const calls = mockNativeMap.setCenter.mock.calls.length;
  rerender(<GoogleDeliveriesMap {...props} driverZoomRequestId={1} driverLocations={[{ ...driver, lat: -22.91 }, other]} />);
  expect(mockNativeMap.setCenter).toHaveBeenCalledTimes(calls);
  rerender(<GoogleDeliveriesMap {...props} selectedDriverId={99} driverZoomRequestId={2} />);
  expect(mockNativeMap.setCenter).toHaveBeenCalledTimes(calls);
});

test('keeps every first name legible for colocated vehicles without changing GPS anchors', () => {
  const drivers = Array.from({ length: 24 }, (_, index) => ({ ...driver, id: `driver-${index}`, driverId: index + 1, driverName: index % 2 ? '  João   Carlos  ' : 'Fernando Dias' }));
  const positions = drivers.map(item => ({ lat: item.lat, lng: item.lng }));
  for (const zoom of [4, 8, 10, 13, 16, 20]) {
    const labels = Array.from(layoutDriverLabels(drivers, zoom).values());
    expect(labels).toHaveLength(24);
    labels.forEach((a, index) => labels.slice(index + 1).forEach(b => {
      const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlap).toBe(false);
    }));
    expect(drivers.map(item => ({ lat: item.lat, lng: item.lng }))).toEqual(positions);
  }
  expect(driverFirstName('  João   Carlos  ')).toBe('João');
  expect(driverFirstName('   ')).toBe('Motorista');
});
