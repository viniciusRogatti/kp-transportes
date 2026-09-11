import { fireEvent, render, screen } from '@testing-library/react';
import RouteOverview from '../RouteOverview';
import useRouteCatalog from '../../../hooks/useRouteCatalog';

test('move Araras para Pirassununga e permite remover a rota vazia antes de salvar', () => {
  localStorage.setItem('user_permission', 'admin');
  const originalShowModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  const save = jest.fn().mockResolvedValue({});
  try {
    render(<RouteOverview danfes={[]} availableCities={[]} onSelectRoute={jest.fn()} catalog={{
      data: { version: 4, routes: [
        { id: 'araras', name: 'Rota Araras', cities: ['Araras'] },
        { id: 'pirassununga', name: 'Rota Pirassununga', cities: ['Pirassununga'] },
      ] }, save, isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useRouteCatalog>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver cidades / gerenciar rotas' }));
    fireEvent.change(screen.getByLabelText('Mover Araras para outra rota'), { target: { value: 'pirassununga' } });
    expect(screen.getByText('Esta rota não tem cidades.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir rota vazia' }));
    expect(screen.getByLabelText('Nome da rota')).toHaveValue('Rota Pirassununga');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rotas' }));
    expect(save).toHaveBeenCalledWith([
      { id: 'pirassununga', name: 'Rota Pirassununga', cities: ['Pirassununga', 'Araras'] },
    ], 4, [{ city: 'Araras', from: 'araras', to: 'pirassununga' }]);
  } finally {
    HTMLDialogElement.prototype.showModal = originalShowModal;
    localStorage.removeItem('user_permission');
  }
});
