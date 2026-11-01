import { fireEvent, render, screen } from '@testing-library/react';
import { DriverProgressStrip } from './DriverProgressStrip';

const driver = { driver_id: 7, driver_name: 'Carlos Henrique', color: '#EA580C', color_order: 0, total_deliveries: 2, completed_deliveries: 1 };
test('shows a segmented circle and accessible identity, without visible delivery counts', () => {
  const onSelect = jest.fn();
  render(<DriverProgressStrip drivers={[driver]} selectedDriverId={7} onSelect={onSelect} />);
  const button = screen.getByRole('button', { name: 'Centralizar Carlos Henrique · 50% finalizado · 1 de 2 NFs' });
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(button).toHaveTextContent('CH50%Carlos Henrique');
  expect(button).not.toHaveTextContent('1 de 2');
  expect(button.querySelector('circle[pathLength="2"]')).toBeInTheDocument();
  fireEvent.click(button); expect(onSelect).toHaveBeenCalledWith(7);
});
test('combines multiple runs of one driver and never rounds an unfinished route to 100%', () => {
  render(<DriverProgressStrip drivers={[{ ...driver, total_deliveries: 100, completed_deliveries: 100 }, { ...driver, total_deliveries: 100, completed_deliveries: 99 }]}
    selectedDriverId={null} onSelect={jest.fn()} />);
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.getByRole('button')).toHaveAccessibleName(/99% finalizado · 199 de 200/);
  expect(screen.queryByText('100%')).not.toBeInTheDocument();
});
test('keeps the scan ordering and uses green only when the whole route is finalized', () => {
  render(<DriverProgressStrip drivers={[{ ...driver, driver_id: 8, driver_name: 'André', color_order: 1 }, { ...driver, completed_deliveries: 2 }]}
    selectedDriverId={null} onSelect={jest.fn()} />);
  expect(screen.getAllByRole('button')[0]).toHaveAccessibleName(/Carlos Henrique · 100%/);
  expect(screen.getAllByRole('button')[0].querySelector('circle[stroke="#16a34a"]')).toBeInTheDocument();
});

test('keeps the driver color and name after completion and company filtering', () => {
  const { rerender } = render(<DriverProgressStrip drivers={[{ ...driver, completed_deliveries: 2, color_order: 17 }]} selectedDriverId={null} onSelect={jest.fn()} />);
  expect(screen.getByText('Carlos Henrique')).toBeInTheDocument();
  expect(screen.getByRole('button').querySelector('.monitoring-driver-color')).toBeInTheDocument();
  expect(screen.queryByText('18')).not.toBeInTheDocument();
  expect(screen.getByRole('button').style.getPropertyValue('--driver-color')).toBe(driver.color);
  rerender(<DriverProgressStrip drivers={[{ ...driver, completed_deliveries: 2, color_order: 17 }, { ...driver, driver_id: 99, color_order: 2 }]} selectedDriverId={null} onSelect={jest.fn()} />);
  expect(screen.getByRole('button', { name: /100% finalizado/ })).toHaveTextContent('Carlos Henrique');
});
