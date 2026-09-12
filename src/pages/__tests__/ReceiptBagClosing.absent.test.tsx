import { fireEvent, render, screen } from '@testing-library/react';
import { AbsentReceiptsPanel } from '../ReceiptBagClosing';
import { ReceiptBagPendingItem } from '../../services/receiptBagClosingService';

const absent = { item_id: 1, bag_id: 10, trip_id: 100, company_id: 1,
  invoice_number: '123', customer_name: 'Cliente teste', city: 'Campinas', status: 'absent',
  has_whatsapp_photo: true, operation_date: '2026-08-01', driver: { id: 1, name: 'Diogo' },
  company: { id: 1, name: 'Mar e Rio' },
} as ReceiptBagPendingItem;

it('exibe ausentes antigos sem pesquisa e abre a conferência sem confirmar presença', () => {
  const onOpen = jest.fn();
  render(<AbsentReceiptsPanel items={[absent, { ...absent, item_id: 2, invoice_number: '456', status: 'pending' }]} disabled={false} onOpen={onOpen} />);
  expect(screen.getByText('Foto registrada · documento ausente')).toBeInTheDocument();
  expect(screen.getByText(/Malote associado: Diogo/)).toBeInTheDocument();
  expect(screen.queryByText(/NF 456/)).not.toBeInTheDocument();
  expect(onOpen).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Abrir conferência da NF 123' }));
  expect(onOpen).toHaveBeenCalledWith(absent);
});

it('busca por motorista e deixa de exibir documentos recuperados', () => {
  const { rerender } = render(<AbsentReceiptsPanel items={[{ ...absent, has_whatsapp_photo: false }]} disabled={false} onOpen={jest.fn()} />);
  expect(screen.getByText('Documento ausente · foto não identificada')).toBeInTheDocument();
  const search = screen.getByPlaceholderText('Buscar ausente por NF, cliente ou motorista...');
  fireEvent.change(search, { target: { value: 'outro motorista' } });
  expect(screen.queryByRole('button', { name: /Abrir conferência/ })).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: 'DIOGO' } });
  expect(screen.getByRole('button', { name: /Abrir conferência/ })).toBeInTheDocument();
  rerender(<AbsentReceiptsPanel items={[{ ...absent, status: 'recovered' }]} disabled={false} onOpen={jest.fn()} />);
  expect(screen.queryByRole('button', { name: /Abrir conferência/ })).not.toBeInTheDocument();
});

it('inclui extras ausentes no malote sugerido sem alterar o status de origem', () => {
  render(<AbsentReceiptsPanel items={[{ ...absent, status: 'pending', absence_reported_in_suggested_bag: true }]} disabled={false} onOpen={jest.fn()} />);
  expect(screen.getByText(/Não encontrado em um malote sugerido/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Abrir conferência/ })).toBeInTheDocument();
});
