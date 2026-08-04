import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConferencePanel } from '../ReceiptBagClosing';
import { ReceiptBag, ReceiptBagItem } from '../../services/receiptBagClosingService';

const item = {
  id: 10,
  invoice_number: '123456',
  customer_name: 'Cliente teste',
  city: 'São Paulo',
  status: 'pending',
  has_receipt_photo: true,
  origin_bag_id: 1,
  route_order: 1,
} as ReceiptBagItem;

const bag = {
  id: 1,
  trip_id: 99,
  status: 'in_progress',
  operation_date: '2026-08-04',
  run_number: 1,
  driver: { name: 'Motorista' },
  car: { license_plate: 'ABC1D23' },
  items: [item],
  counts: { expected: 1, confirmed: 0, pending: 1, absent: 0, returned: 0 },
} as ReceiptBag;

describe('ConferencePanel por teclado', () => {
  it('seleciona no primeiro Enter, confirma no segundo e devolve o foco à busca limpa', async () => {
    const onSelect = jest.fn();
    const onMutate = jest.fn().mockResolvedValue(true);

    function Harness() {
      const [search, setSearch] = useState('345');
      return (
        <ConferencePanel
          bag={bag}
          items={[item]}
          selectedItem={null}
          itemFilter="all"
          itemSearch={search}
          extraInvoice=""
          error=""
          feedback=""
          mutating={false}
          onClose={jest.fn()}
          onSelect={onSelect}
          onFilter={jest.fn()}
          onSearch={setSearch}
          onExtraChange={jest.fn()}
          onExtra={jest.fn()}
          onMutate={onMutate}
          onMarkRemaining={jest.fn()}
          onFinish={jest.fn()}
        />
      );
    }

    render(<Harness />);
    const search = screen.getByRole('textbox', { name: 'Localizar NF, cliente ou cidade...' });

    await userEvent.type(search, '{enter}');
    expect(onSelect).toHaveBeenCalledWith(item.id);
    expect(onMutate).not.toHaveBeenCalled();

    await userEvent.type(search, '{enter}');
    await waitFor(() => expect(onMutate).toHaveBeenCalledWith(item, 'confirm'));
    await waitFor(() => expect(search).toHaveValue(''));
    expect(search).toHaveFocus();
  });
});
