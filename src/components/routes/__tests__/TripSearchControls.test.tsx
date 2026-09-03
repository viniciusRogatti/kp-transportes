import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TripSearchControls from '../TripSearchControls';

const createProps = (): ComponentProps<typeof TripSearchControls> => ({
  startDate: new Date(2026, 8, 1),
  endDate: new Date(2026, 8, 3),
  tripId: '',
  plate: '',
  driverName: '',
  isPrinting: false,
  isLoading: false,
  hasDisplayedTrips: false,
  onStartDateChange: jest.fn(),
  onEndDateChange: jest.fn(),
  onTripIdChange: jest.fn(),
  onPlateChange: jest.fn(),
  onDriverNameChange: jest.fn(),
  onPrint: jest.fn(),
  onClear: jest.fn(),
  onSearch: jest.fn(),
});

describe('TripSearchControls', () => {
  it('preserva as acoes da consulta de rotas', () => {
    const props = createProps();
    render(<TripSearchControls {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Imprimir lista de salmão' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Buscar período' }));

    expect(props.onPrint).toHaveBeenCalledTimes(1);
    expect(props.onClear).toHaveBeenCalledTimes(1);
    expect(props.onSearch).toHaveBeenCalledTimes(1);
  });

  it('normaliza ID e placa antes de atualizar os filtros', () => {
    const props = createProps();
    render(<TripSearchControls {...props} />);

    fireEvent.change(screen.getByLabelText('ID da rota'), { target: { value: 'RT-12A3' } });
    fireEvent.change(screen.getByLabelText('Placa'), { target: { value: 'abc1d23' } });
    fireEvent.change(screen.getByLabelText('Nome do motorista'), { target: { value: 'João' } });

    expect(props.onTripIdChange).toHaveBeenCalledWith('123');
    expect(props.onPlateChange).toHaveBeenCalledWith('ABC1D23');
    expect(props.onDriverNameChange).toHaveBeenCalledWith('João');
  });

  it('informa a atualização sem substituir resultados existentes', () => {
    render(<TripSearchControls {...createProps()} isLoading hasDisplayedTrips />);
    expect(screen.getByText('Atualizando rotas...')).toBeInTheDocument();
  });
});
