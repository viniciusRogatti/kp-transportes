import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ReturnBatchSearchPanel from '../ReturnBatchSearchPanel';

const createProps = (): ComponentProps<typeof ReturnBatchSearchPanel> => ({
  returnDataLastUpdate: null,
  canCreateBatch: true,
  batchCode: 'RET-123',
  lookbackDays: '7',
  startDate: '2026-09-01',
  endDate: '2026-09-03',
  onOpenRegistry: jest.fn(),
  onCreateBatch: jest.fn(),
  onBatchCodeChange: jest.fn(),
  onSearchByCode: jest.fn(),
  onLookbackChange: jest.fn(),
  onRefresh: jest.fn(),
  onStartDateChange: jest.fn(),
  onEndDateChange: jest.fn(),
  onOpenDatePicker: jest.fn(),
  onSearchByPeriod: jest.fn(),
});

describe('ReturnBatchSearchPanel', () => {
  it('preserva as acoes de consulta e criacao de lotes', () => {
    const props = createProps();
    render(<ReturnBatchSearchPanel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Base de devoluções/i }));
    fireEvent.click(screen.getByRole('button', { name: /Nova devolucao/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Buscar lote' }));
    fireEvent.keyDown(screen.getByLabelText('ID do lote de devolucao'), { key: 'Enter' });

    expect(props.onOpenRegistry).toHaveBeenCalledTimes(1);
    expect(props.onCreateBatch).toHaveBeenCalledTimes(1);
    expect(props.onSearchByCode).toHaveBeenCalledTimes(2);
  });

  it('encaminha periodo rapido e intervalo informado', () => {
    const props = createProps();
    render(<ReturnBatchSearchPanel {...props} />);

    fireEvent.change(screen.getByLabelText('Periodo de devolucoes'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Data inicial dos lotes de devolucao'), {
      target: { value: '2026-08-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar período' }));

    expect(props.onLookbackChange).toHaveBeenCalledWith('30');
    expect(props.onStartDateChange).toHaveBeenCalledWith('2026-08-01');
    expect(props.onSearchByPeriod).toHaveBeenCalledTimes(1);
  });

  it('oculta a criacao quando o perfil nao possui permissao', () => {
    const props = createProps();
    props.canCreateBatch = false;
    render(<ReturnBatchSearchPanel {...props} />);

    expect(screen.queryByRole('button', { name: /Nova devolucao/i })).not.toBeInTheDocument();
  });
});
