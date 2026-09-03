import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import InvoiceSearchPanel from '../InvoiceSearchPanel';

const createProps = (): ComponentProps<typeof InvoiceSearchPanel> => ({
  searchNf: '12345',
  onSearchNfChange: jest.fn(),
  onSearchNf: jest.fn(),
  isSearchingInvoice: false,
  startDate: null,
  endDate: null,
  onStartDateChange: jest.fn(),
  onEndDateChange: jest.fn(),
  onSearchPeriod: jest.fn(),
  isSearchingPeriod: false,
  invoiceSearchFeedback: null,
  periodSearchError: null,
  onNavigate: jest.fn(),
});

describe('InvoiceSearchPanel', () => {
  it('encaminha a pesquisa de NF pelo botao e pela tecla Enter', () => {
    const props = createProps();
    render(<InvoiceSearchPanel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Buscar NF' }));
    fireEvent.keyDown(screen.getByLabelText('Número da NF'), { key: 'Enter' });

    expect(props.onSearchNf).toHaveBeenCalledTimes(2);
  });

  it('mantem a pesquisa por periodo indisponivel ate receber as duas datas', () => {
    const props = createProps();
    render(<InvoiceSearchPanel {...props} />);

    expect(screen.getByRole('button', { name: 'Buscar período' })).toBeDisabled();
  });

  it('exibe erro do periodo e permite abrir a acao do retorno da NF', () => {
    const props = createProps();
    props.periodSearchError = 'Falha ao carregar período.';
    props.invoiceSearchFeedback = {
      tone: 'warning' as const,
      message: 'NF localizada em um lote.',
      actionUrl: '/returns-occurrences?nf=12345',
      actionLabel: 'Abrir lote',
    };
    render(<InvoiceSearchPanel {...props} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar período.');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir lote' }));
    expect(props.onNavigate).toHaveBeenCalledWith('/returns-occurrences?nf=12345');
  });
});
