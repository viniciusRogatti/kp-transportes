import { act, fireEvent, render, screen } from '@testing-library/react';
import GlobalAlertHost from '../GlobalAlertHost';
import { showConfirm, showPrompt } from '../../../utils/dialog';

describe('GlobalAlertHost', () => {
  it('substitui window.alert por um aviso estilizado', async () => {
    render(<GlobalAlertHost />);

    act(() => window.alert('Mensagem operacional'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Mensagem operacional')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resolve confirmação sem usar o diálogo nativo do navegador', async () => {
    render(<GlobalAlertHost />);
    let confirmation: Promise<boolean> = Promise.resolve(false);

    act(() => {
      confirmation = showConfirm('Excluir este registro?', {
        title: 'Excluir registro',
        confirmLabel: 'Excluir',
        tone: 'danger',
      });
    });

    expect(await screen.findByText('Excluir registro')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await expect(confirmation).resolves.toBe(true);
  });

  it('coleta texto em um prompt estilizado', async () => {
    render(<GlobalAlertHost />);
    let response: Promise<string | null> = Promise.resolve(null);

    act(() => {
      response = showPrompt('Informe a justificativa.', {
        label: 'Justificativa',
        confirmLabel: 'Salvar',
        required: true,
      });
    });

    const input = await screen.findByLabelText('Justificativa');
    fireEvent.change(input, { target: { value: 'Aprovado pela operação' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await expect(response).resolves.toBe('Aprovado pela operação');
  });
});
