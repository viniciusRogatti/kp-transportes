import React from 'react';
import { render } from '@testing-library/react';
import useDialogFocus from '../useDialogFocus';

function Dialog({ active }: { active: boolean }) {
  const ref = useDialogFocus(active ? 'dialog' : '');
  return active ? <div ref={ref}><button>Fechar</button></div> : null;
}

it('mantém o bloqueio até o último diálogo fechar, mesmo fora da ordem de abertura', () => {
  const { rerender, unmount } = render(<><Dialog active /><Dialog active={false} /></>);
  rerender(<><Dialog active /><Dialog active /></>);
  rerender(<><Dialog active={false} /><Dialog active /></>);
  const overflowWithDialogOpen = document.body.style.overflow;
  unmount();
  const overflowAfterUnmount = document.body.style.overflow;
  document.body.style.overflow = '';
  expect(overflowWithDialogOpen).toBe('hidden');
  expect(overflowAfterUnmount).toBe('');
});

it('restaura o estilo original após desmontar diálogos em StrictMode', () => {
  document.body.style.overflow = 'auto';
  const { unmount } = render(<React.StrictMode><Dialog active /><Dialog active /></React.StrictMode>);
  expect(document.body.style.overflow).toBe('hidden');
  unmount();
  expect(document.body.style.overflow).toBe('auto');
  document.body.style.overflow = '';
});
