import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../../../context/ThemeContext';
import ThemeToggleButton from '../ThemeToggleButton';

beforeEach(() => window.localStorage.clear());

test('farol acompanha o tema, inclusive após cliques rápidos e remontagem de página', () => {
  const view = render(<ThemeProvider><ThemeToggleButton iconOnly /></ThemeProvider>);
  const button = screen.getByRole('switch', { name: 'Ativar tema claro' });
  expect(button).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-checked', 'true');
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(window.localStorage.getItem('kp_theme')).toBe('light');
  fireEvent.click(button);
  fireEvent.click(button);
  view.unmount();
  render(<ThemeProvider><ThemeToggleButton iconOnly /></ThemeProvider>);
  expect(screen.getByRole('switch', { name: 'Ativar tema escuro' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByText('Tema claro ativo, farol aceso')).toBeInTheDocument();
});

test('instâncias de desktop e menu refletem o mesmo tema', () => {
  render(<ThemeProvider><ThemeToggleButton iconOnly /><ThemeToggleButton /></ThemeProvider>);
  fireEvent.click(screen.getAllByRole('switch')[0]);
  screen.getAllByRole('switch').forEach(button => expect(button).toHaveAttribute('aria-checked', 'true'));
  expect(screen.queryByText('Tema', { exact: true })).not.toBeInTheDocument();
});
