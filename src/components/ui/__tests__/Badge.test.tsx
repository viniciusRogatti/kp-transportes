import { render, screen } from '@testing-library/react';
import Badge from '../Badge';

describe('Badge', () => {
  it('usa classes semanticas solidas para os tons operacionais', () => {
    render(
      <div>
        <Badge tone="success">Sucesso</Badge>
        <Badge tone="danger">Erro</Badge>
        <Badge tone="info">Info</Badge>
      </div>,
    );

    expect(screen.getByText('Sucesso')).toHaveClass('semantic-solid-success');
    expect(screen.getByText('Erro')).toHaveClass('semantic-solid-danger');
    expect(screen.getByText('Info')).toHaveClass('semantic-solid-info');
  });
});
