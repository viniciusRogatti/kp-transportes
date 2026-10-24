import { fireEvent, render, screen } from '@testing-library/react';
import { Truck, Check } from 'lucide-react';
import { MapMarkerPin } from './MapMarkerPin';
import { getDriverMarkerStyle, getDeliveryMarkerStyleByStatus } from '../../pages/deliveryMonitoring/googleMarkerVisuals';

test('renders the vehicle as a circle with a readable name and keyboard access', () => {
  const onKeyDown = jest.fn();
  render(<MapMarkerPin icon={Truck} shape="vehicle" size={34} iconSize={18} interactive title="Ver localização de Jonathan" label="Jonathan" tone={getDriverMarkerStyle({ color: '#f97316', attentionLevel: null })} onKeyDown={onKeyDown} />);
  const marker = screen.getByRole('button', { name: 'Ver localização de Jonathan' });
  expect(marker.querySelector('svg circle')).toBeInTheDocument();
  expect(marker).toHaveStyle({ width: '34px', height: '34px', opacity: 1 });
  expect(screen.getByText('Jonathan')).toHaveStyle({ color: '#ffffff', backgroundColor: '#0f172a' });
  fireEvent.keyDown(marker, { key: 'Enter' });
  expect(onKeyDown).toHaveBeenCalled();
});

test('restores contrast when inspecting a completed delivery without hiding it initially', () => {
  const tone = getDeliveryMarkerStyleByStatus({ status: 'completed', stopStatus: 'delivered', danfeStatus: 'delivered', driverId: 7, driverColor: '#f97316' });
  const { rerender } = render(<MapMarkerPin icon={Check} tone={tone} size={18} iconSize={11} interactive title="Entrega concluída" />);
  const marker = screen.getByRole('button', { name: 'Entrega concluída' });
  expect(marker).toHaveStyle({ opacity: 0.32 });
  expect(marker.querySelector('svg path')).toBeInTheDocument();
  rerender(<MapMarkerPin icon={Check} tone={tone} size={18} iconSize={11} interactive title="Entrega concluída" selected dimmed />);
  expect(marker).toHaveStyle({ opacity: 1 });
});
