import { fireEvent, render, screen } from '@testing-library/react';
import OperationalRadar from '../OperationalRadar';

test('prioriza atrasos, filtra a fila e abre a NF da categoria selecionada', () => {
  const open = jest.fn();
  render(<OperationalRadar categories={[
    { key: 'retained', label: 'Retidos', description: 'Canhotos', count: 1 },
    { key: 'unassigned', label: 'Sem rota', description: 'Notas', count: 1 },
  ]} entries={[
    { id: '1', category: 'retained', invoice: '100', customer: 'Cliente novo', city: 'Araras', detail: 'Motorista A', age: 0 },
    { id: '2', category: 'unassigned', invoice: '200', customer: 'Cliente antigo', city: 'Limeira', detail: 'Sem motorista', age: 8 },
  ]} incomplete={false} failed={false} onRefresh={jest.fn().mockResolvedValue(undefined)} onOpen={open} />);
  const rows = screen.getAllByRole('button', { name: /dias NF/ });
  expect(rows[0]).toHaveTextContent('NF 200');
  fireEvent.click(screen.getByRole('button', { name: 'Só vencidas' }));
  expect(screen.queryByText('NF 100')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /dias NF 200/ }));
  expect(open).toHaveBeenCalledWith('unassigned', '200');
  fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
  fireEvent.click(screen.getByRole('button', { name: /1 Retidos/ }));
  expect(screen.queryByText('NF 200')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Buscar no radar'), { target: { value: 'não existe' } });
  expect(screen.getByText('Nenhuma pendência nos filtros atuais.')).toBeInTheDocument();
});
