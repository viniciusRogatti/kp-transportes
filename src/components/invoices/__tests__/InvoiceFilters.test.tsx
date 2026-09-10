import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import InvoiceFilters from '../InvoiceFilters';
import { createEmptyInvoiceListFilters } from '../../../utils/danfeFilters';
function Harness() {
  const [filters, setFilters] = useState(createEmptyInvoiceListFilters);
  return <><InvoiceFilters filters={filters} setFilters={setFilters} cities={['Limeira', 'Araras']} drivers={['Jonas', 'Diogo', 'Renato']} loads={['1', '2']} routes={[]} /><output data-testid="value">{JSON.stringify(filters)}</output></>;
}
test('permite marcar três motoristas e duas cidades sem apagar o produto', () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Produto'), { target: { value: '123' } });
  ['Jonas', 'Diogo', 'Renato', 'Limeira', 'Araras'].forEach((label) => fireEvent.click(screen.getByLabelText(label)));
  expect(JSON.parse(screen.getByTestId('value').textContent || '{}')).toMatchObject({ product: '123', driver: ['Jonas', 'Diogo', 'Renato'], city: ['Limeira', 'Araras'] });
  fireEvent.click(screen.getByLabelText('Diogo'));
  expect(JSON.parse(screen.getByTestId('value').textContent || '{}').driver).toEqual(['Jonas', 'Renato']);
});
