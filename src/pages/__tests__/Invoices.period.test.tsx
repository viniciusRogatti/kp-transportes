import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import Invoices from '../Invoices';

jest.mock('axios');
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/CardDanfes', () => ({ danfes }: any) => <div>{danfes.map((note: any) => <span key={note.invoice_number}>{`Resultado ${note.invoice_number}`}</span>)}</div>);
jest.mock('../../components/TodayProductList', () => () => null);
jest.mock('@react-pdf/renderer', () => ({ pdf: jest.fn() }));
jest.mock('../../components/ScrollToTopButton', () => () => null);
jest.mock('../../components/invoices/RouteOverview', () => () => null);
jest.mock('../../utils/verifyToken', () => async () => true);
jest.mock('../../hooks/useRouteCatalog', () => () => ({ data: { routes: [], version: 0 } }));
jest.mock('../../hooks/useInvoiceSearchContext', () => {
  const context = { invoiceContextByNf: {}, driverLoadingByInvoice: {}, driverErrorByInvoice: {}, loadInvoiceContext: jest.fn(), refreshInvoiceContext: jest.fn(), seedInvoiceContext: jest.fn() };
  return () => context;
});
jest.mock('react-router', () => ({ useNavigate: () => jest.fn() }));
jest.mock('react-router-dom', () => {
  const params = new URLSearchParams();
  return { useSearchParams: () => [params] };
});
jest.mock('../../components/InvoiceSearchPanel', () => (props: any) => <div>
  <button onClick={() => { props.onStartDateChange(new Date(2026, 8, 9)); props.onEndDateChange(new Date(2026, 8, 10)); }}>Definir período</button>
  <button disabled={props.isSearchingPeriod} onClick={props.onSearchPeriod}>Buscar período</button>
  {props.periodSearchError && <p role="alert">{props.periodSearchError}</p>}
</div>);
const post = axios.post as jest.Mock;
const note = (number: string, city: string) => ({ company_id: 1, invoice_number: number, status: 'pending', gross_weight: 10,
  invoice_date: '2026-09-09', Customer: { city, name_or_legal_entity: 'Cliente' }, DanfeProducts: [] });
const page = (number: number, hasMore: boolean, rows: unknown[]) => ({ data: {
  page: number, hasMore, total: 2, pageSize: 1, rows, contexts: {}, routeSummary: [],
  filterOptions: { cities: ['Limeira', 'Araras'], drivers: ['Jonas', 'Diogo'], loads: ['10'] },
} });
const search = () => { render(<Invoices />); fireEvent.click(screen.getByText('Definir período')); fireEvent.click(screen.getByRole('button', { name: 'Buscar período' })); };
beforeEach(() => { jest.clearAllMocks(); localStorage.setItem('token', 'test'); });

test('mantém a paginação e pesquisa uma cidade fora da página carregada no backend', async () => {
  post.mockResolvedValueOnce(page(1, true, [note('111', 'Limeira')])).mockResolvedValueOnce(page(1, false, [note('222', 'Araras')]));
  search();
  await screen.findByText('Resultado 111');
  expect(post).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Resultado 222')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Abrir lista de produtos' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Filtrar cidades' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Araras' }));
  await screen.findByText('Resultado 222');
  expect(post.mock.calls[1][1].page).toBe(1);
  expect(post.mock.calls[1][1].filters.city).toEqual(['Araras']);
  expect(post.mock.calls[1][1].includeOptions).toBe(false);
  expect(screen.queryByText('Resultado 111')).not.toBeInTheDocument();
});

test('falha na próxima página preserva os dados e permite tentar novamente sem carregar tudo', async () => {
  post.mockResolvedValueOnce(page(1, true, [note('111', 'Limeira')])).mockRejectedValueOnce(new Error('network'));
  search();
  await screen.findByText('Resultado 111');
  fireEvent.click(screen.getByRole('button', { name: /Carregar mais notas/ }));
  await screen.findByRole('alert');
  expect(screen.getByText('Resultado 111')).toBeInTheDocument();
  post.mockResolvedValueOnce(page(2, false, [note('222', 'Araras')]));
  fireEvent.click(screen.getByRole('button', { name: /Carregar mais notas/ }));
  await screen.findByText('Resultado 222');
  expect(post.mock.calls[2][1].page).toBe(2);
  expect(screen.getByText('Resultado 111')).toBeInTheDocument();
});

test('cancela a busca anterior e ignora a resposta antiga após trocar o filtro', async () => {
  let finishOld: (value: unknown) => void = () => {};
  post.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
    .mockResolvedValueOnce(page(1, false, [note('222', 'Araras')]));
  search();
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Produto' }), { target: { value: '123' } });
  await screen.findByText('Resultado 222');
  expect(post.mock.calls[0][2].signal.aborted).toBe(true);
  expect(post.mock.calls[1][1].filters.product).toBe('123');
  await act(async () => { finishOld(page(1, true, [note('111', 'Limeira')])); });
  expect(screen.queryByText('Resultado 111')).not.toBeInTheDocument();
});
