import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { pdf } from '@react-pdf/renderer';
import TodayInvoices from '../TodayInvoices';
import { readTodayInvoiceView } from '../../utils/todayInvoiceView';
import verifyToken from '../../utils/verifyToken';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }));
jest.mock('../../utils/verifyToken', () => ({ __esModule: true, default: jest.fn().mockResolvedValue(true) }));
jest.mock('../../components/Header', () => () => <nav aria-label="Menu">Menu</nav>);
jest.mock('../../components/TodayProductList', () => () => null);
jest.mock('../../components/invoices/RouteOverview', () => () => <div>Prévia</div>);
jest.mock('../../hooks/useRouteCatalog', () => ({ __esModule: true, default: () => ({ data: { routes: [] } }) }));
jest.mock('../../hooks/useInvoiceSearchContext', () => {
  const context = { invoiceContextByNf: {}, driverLoadingByInvoice: {}, driverErrorByInvoice: {}, loadInvoiceContext: jest.fn().mockResolvedValue(undefined), refreshInvoiceContext: jest.fn().mockResolvedValue(undefined) };
  return { __esModule: true, default: () => context };
});
jest.mock('@react-pdf/renderer', () => ({ pdf: jest.fn() }));

const note = (companyId: number, companyCode: string) => ({
  company_id: companyId, company: { code: companyCode }, invoice_number: '123', barcode: `key-${companyId}`,
  status: 'pending', load_number: 'CARGA-1', invoice_date: '2026-10-02', total_quantity: 4, gross_weight: '15.125',
  Customer: { name_or_legal_entity: `Cliente ${companyId}`, city: 'Campinas', phone: '', address: 'Rua de teste' },
  DanfeProducts: [
    { quantity: '2.500', type: 'KG', Product: { code: '100', description: 'Filé de tilápia', type: 'KG' } },
    { quantity: 2, type: 'CX', Product: { code: '200', description: 'Camarão', type: 'CX' } },
  ],
});
const notes = [note(1, 'mar_e_rio'), note(2, 'pronto')];
const get = axios.get as jest.Mock;
const renderPage = () => render(<MemoryRouter><TodayInvoices /></MemoryRouter>);
const waitForNotes = () => screen.findAllByTestId('danfe-card-123');

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('token', 'synthetic');
  localStorage.setItem('user_login', 'test-operator');
  localStorage.setItem('company_id', '1');
  localStorage.setItem('user_permission', 'admin');
  window.scrollTo = jest.fn();
  (verifyToken as jest.Mock).mockResolvedValue(true);
  get.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('/danfes') ? notes : [] }));
});

test('carregamento não afirma que não existem notas', async () => {
  renderPage();
  expect(screen.getByText('Carregando notas e viagens')).toBeInTheDocument();
  expect(screen.queryByText('Nenhuma nota nesta operação')).not.toBeInTheDocument();
  expect(await waitForNotes()).toHaveLength(2);
});

test('limpa apenas o campo escolhido e identifica emissão e quantidade no card', async () => {
  renderPage(); await waitForNotes();
  fireEvent.change(screen.getByLabelText('Produto'), { target: { value: 'file' } });
  fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'Cliente' } });
  fireEvent.click(screen.getByRole('button', { name: 'Limpar produto' }));
  expect(screen.getByLabelText('Produto')).toHaveValue('');
  expect(screen.getByLabelText('Produto')).toHaveFocus();
  expect(screen.getByLabelText('Cliente')).toHaveValue('Cliente');
  await waitFor(() => expect(screen.getAllByTestId('danfe-card-123')).toHaveLength(2));
  const card = within(screen.getAllByTestId('danfe-card-123')[0]);
  expect(card.getByText('Emissão')).toBeInTheDocument();
  expect(card.getAllByText('Quantidade').length).toBeGreaterThan(0);
  expect(card.getByText('Peso bruto')).toBeInTheDocument();
  const metadata = within(card.getByRole('group', { name: 'Empresa, motorista e carga' }));
  expect(metadata.getByText('MAR E RIO')).toBeInTheDocument();
  expect(metadata.getByRole('img', { name: 'Sem motorista' })).toBeInTheDocument();
  expect(metadata.queryByText('Sem motorista')).not.toBeInTheDocument();
  expect(metadata.getByText('Carga CARGA-1')).toBeInTheDocument();
  const product = card.getAllByRole('listitem').find(item => within(item).queryByText('Cód. 100'));
  expect(product).toHaveClass('conference-product-description');
  expect(product).toHaveTextContent('Filé de tilápia');
  expect(card.getByText('2,5 KG')).toHaveClass('conference-product-quantity');
  expect(card.queryByText('2 itens na NF')).not.toBeInTheDocument();
});

test('busca de produto mantém uma lista, unidades e ações; detalhes não alteram os filtros', async () => {
  renderPage(); await waitForNotes();
  fireEvent.change(screen.getByLabelText('Produto'), { target: { value: 'file' } });
  expect(await screen.findByText(/2 itens correspondentes em 2 notas/)).toBeInTheDocument();
  const cards = screen.getAllByTestId('danfe-card-123');
  expect(within(cards[0]).getByText('2,5 KG')).toBeInTheDocument();
  expect(within(cards[0]).queryByText('Camarão')).not.toBeInTheDocument();
  fireEvent.click(within(cards[0]).getByRole('button', { name: 'Mostrar detalhes da NF 123' }));
  expect(cards[0]).not.toBeVisible();
  expect(cards[1]).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Voltar para frente do card da NF 123' }));
  expect(cards[0]).toBeVisible();
  expect(screen.getByLabelText('Produto')).toHaveValue('file');
  fireEvent.click(screen.getByRole('button', { name: 'Limpar todos os filtros' }));
  await waitFor(() => expect(within(cards[0]).getByText('Camarão')).toBeInTheDocument());
});

test('erro é diferente de vazio e a tentativa seguinte conserva a busca', async () => {
  get.mockRejectedValueOnce(new Error('offline'));
  renderPage();
  await screen.findByText('Não foi possível carregar a operação');
  expect(screen.queryByText('Nenhuma nota nesta operação')).not.toBeInTheDocument();
  expect(screen.queryByText(/0 notas/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'Cliente 1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await waitForNotes()).toHaveLength(1);
  expect(screen.getByLabelText('Cliente')).toHaveValue('Cliente 1');
});

test('não trata uma resposta inválida como uma operação sem notas', async () => {
  get.mockResolvedValueOnce({ data: { error: 'invalid' } });
  renderPage();
  await screen.findByText('Não foi possível carregar a operação');
  expect(screen.queryByText('Nenhuma nota nesta operação')).not.toBeInTheDocument();
});

test('falha das viagens mantém as notas e sinaliza contexto incompleto', async () => {
  get.mockImplementation((url: string) => url.endsWith('/danfes') ? Promise.resolve({ data: notes }) : Promise.reject(new Error('offline')));
  renderPage(); await waitForNotes();
  expect(screen.getByRole('alert')).toHaveTextContent('viagens estão indisponíveis');
  expect(screen.queryByRole('button', { name: /Atribuir NF/ })).not.toBeInTheDocument();
});

test('filtros retornam após sair da página, separados por usuário', async () => {
  const { unmount } = renderPage(); await waitForNotes();
  fireEvent.change(screen.getByLabelText('Produto'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('Empresa atendida'), { target: { value: 'pronto' } });
  fireEvent.click(screen.getByRole('button', { name: 'Mais filtros' }));
  unmount();
  expect(readTodayInvoiceView()).toMatchObject({ filters: { product: '100' }, company: 'pronto', moreFilters: true });
  const { unmount: unmountAgain } = renderPage(); await waitForNotes();
  expect(screen.getByLabelText('Produto')).toHaveValue('100');
  expect(screen.getByLabelText('Empresa atendida')).toHaveValue('pronto');
  unmountAgain();
  localStorage.setItem('user_login', 'other-user');
  expect(readTodayInvoiceView().filters.product).toBe('');
});

test('PDF respeita as notas filtradas mas inclui todos os produtos; bloqueia reenvio', async () => {
  let complete!: (blob: Blob) => void;
  const toBlob = jest.fn(() => new Promise<Blob>((resolve) => { complete = resolve; }));
  (pdf as jest.Mock).mockReturnValue({ toBlob });
  const preview = { opener: window, location: { href: '' }, closed: false, close: jest.fn() };
  jest.spyOn(window, 'open').mockReturnValue(preview as any);
  URL.createObjectURL = jest.fn(() => 'blob:test'); URL.revokeObjectURL = jest.fn();
  renderPage(); await waitForNotes();
  fireEvent.change(screen.getByLabelText('Produto'), { target: { value: 'file' } });
  fireEvent.change(screen.getByLabelText('Empresa atendida'), { target: { value: 'pronto' } });
  const print = screen.getByRole('button', { name: 'Lista de produtos · PDF' });
  fireEvent.click(print); fireEvent.click(print);
  expect(toBlob).toHaveBeenCalledTimes(1);
  const products = (pdf as jest.Mock).mock.calls[0][0].props.products;
  expect(products.map((product: any) => product.Product.code)).toEqual(expect.arrayContaining(['100', '200']));
  expect(products).toHaveLength(2);
  await act(async () => { complete(new Blob(['synthetic'])); });
  expect(preview.location.href).toBe('blob:test');
  expect(screen.getByLabelText('Produto')).toHaveValue('file');
});

test('informa bloqueio de pop-up sem apagar notas ou filtros', async () => {
  jest.spyOn(window, 'open').mockReturnValue(null);
  renderPage(); await waitForNotes();
  fireEvent.click(screen.getByRole('button', { name: 'Lista de produtos · PDF' }));
  expect(screen.getByRole('alert')).toHaveTextContent('bloqueou a abertura');
  expect(screen.getAllByTestId('danfe-card-123')).toHaveLength(2);
});
