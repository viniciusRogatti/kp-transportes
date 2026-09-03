import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import OccurrenceListControls from '../OccurrenceListControls';

const createProps = (): ComponentProps<typeof OccurrenceListControls> => ({
  canManageStatus: true,
  hasSavedDraft: true,
  isControlTowerUser: false,
  statusFilter: 'pending_transportadora',
  invoiceFilter: '',
  startDate: '2026-09-01',
  endDate: '2026-09-03',
  onCreate: jest.fn(),
  onDiscardDraft: jest.fn(),
  onStatusFilterChange: jest.fn(),
  onInvoiceFilterChange: jest.fn(),
  onStartDateChange: jest.fn(),
  onEndDateChange: jest.fn(),
});

describe('OccurrenceListControls', () => {
  it('preserva as acoes do rascunho e da criacao', () => {
    const props = createProps();
    render(<OccurrenceListControls {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Criar ocorrencia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(props.onCreate).toHaveBeenCalledTimes(2);
    expect(props.onDiscardDraft).toHaveBeenCalledTimes(1);
  });

  it('encaminha os filtros editaveis da transportadora', () => {
    const props = createProps();
    render(<OccurrenceListControls {...props} />);

    fireEvent.change(screen.getByLabelText('Status das ocorrencias'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Filtro por NF'), { target: { value: '12345' } });
    fireEvent.change(screen.getByLabelText('Data final das ocorrencias'), { target: { value: '2026-09-04' } });

    expect(props.onStatusFilterChange).toHaveBeenCalledWith('all');
    expect(props.onInvoiceFilterChange).toHaveBeenCalledWith('12345');
    expect(props.onEndDateChange).toHaveBeenCalledWith('2026-09-04');
  });

  it('fixa o status para a torre de controle', () => {
    const props = createProps();
    props.isControlTowerUser = true;
    render(<OccurrenceListControls {...props} />);

    const status = screen.getByLabelText('Status das ocorrencias');
    expect(status).toBeDisabled();
    expect(status).toHaveValue('awaiting_control_tower');
  });
});
