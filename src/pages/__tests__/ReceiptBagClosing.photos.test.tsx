import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { HashRouter, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import ReceiptBagClosing, { ConferencePanel } from '../ReceiptBagClosing';
import useReceiptPhotoPendencies from '../../hooks/useReceiptPhotoPendencies';
import useReceiptPhotoLeaveGuard from '../../hooks/useReceiptPhotoLeaveGuard';
import { missingPhotosInBag, photoEntryFromBag, uniquePhotoPendencies } from '../../utils/receiptPhotoPendencies';
import * as api from '../../services/receiptBagClosingService';
import type { ReceiptBag, ReceiptBagItem, ReceiptBagListResponse } from '../../services/receiptBagClosingService';
import type { ReceiptStatusUpdate } from '../../providers/RealtimeNotificationsProvider';
import { showConfirm } from '../../utils/dialog';

let mockStatusListener: ((event: ReceiptStatusUpdate) => void) | undefined;
const mockSubscribe = jest.fn((listener: (event: ReceiptStatusUpdate) => void) => {
  mockStatusListener = listener;
  return () => { mockStatusListener = undefined; };
});
jest.mock('../../providers/RealtimeNotificationsProvider', () => ({
  useRealtimeNotifications: () => ({ subscribeToStatusUpdates: mockSubscribe }),
}));
jest.mock('../../components/Header', () => () => null);
jest.mock('../../utils/verifyToken', () => ({ __esModule: true, default: async () => true }));
jest.mock('../../utils/dialog', () => ({ showConfirm: jest.fn(), showAlert: jest.fn() }));
jest.mock('../../services/receiptBagClosingService', () => ({
  ...jest.requireActual('../../services/receiptBagClosingService'),
  listReceiptBagClosings: jest.fn(), getReceiptBagClosing: jest.fn(), updateReceiptBagItem: jest.fn(), finishReceiptBagClosing: jest.fn(),
}));
const list = api.listReceiptBagClosings as jest.MockedFunction<typeof api.listReceiptBagClosings>;
const getBag = api.getReceiptBagClosing as jest.MockedFunction<typeof api.getReceiptBagClosing>;
const update = api.updateReceiptBagItem as jest.MockedFunction<typeof api.updateReceiptBagItem>;
const confirm = showConfirm as jest.MockedFunction<typeof showConfirm>;
const item = { id: 1, company_id: 2, invoice_number: '123', status: 'confirmed', confirmed_bag_id: 10,
  origin_bag_id: 10, customer_name: 'Cliente teste', has_whatsapp_photo: false, operational_status: 'delivered',
} as ReceiptBagItem;
const bag = { id: 10, company_id: 1, trip_id: 100, driver: { id: 2, name: 'Motorista teste' },
  status: 'in_progress', operation_date: '2026-10-28', items: [item],
  counts: { total: 1, expected: 1, confirmed: 1, pending: 0, absent: 0 },
} as ReceiptBag;
const response = (items = [photoEntryFromBag(bag, item)]): ReceiptBagListResponse => ({
  date: '2026-10-29', operational_date: '2026-10-29', operation_start_date: '2026-08-01',
  summary: { bags: 1, expected: 1, confirmed: 1, pending_receipts: items.length, overdue_bags: 1, completed_bags: 0, divergent_bags: 0 },
  rows: [{ bag_id: bag.id, trip_id: bag.trip_id, company_id: 1, status: 'in_progress', operation_date: bag.operation_date,
    counts: bag.counts, driver: bag.driver, run_number: 1, is_overdue: true }],
  pending_items: items, missing_photo_items: items,
} as ReceiptBagListResponse);

beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  mockSubscribe.mockImplementation(listener => { mockStatusListener = listener; return () => { mockStatusListener = undefined; }; });
  localStorage.setItem('token', 'synthetic-token'); localStorage.setItem('company_id', '1'); localStorage.setItem('user_login', 'operacao');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  list.mockResolvedValue(response()); getBag.mockResolvedValue(bag); confirm.mockResolvedValue(true);
});

test('fila aparece sem busca e avisa ao fechar; sobrevive ao recarregamento sem internet', async () => {
  const view = render(<MemoryRouter><ReceiptBagClosing /></MemoryRouter>);
  const panel = await screen.findByRole('region', { name: /Presentes sem foto/ });
  expect(await within(panel).findByText(/NF 123/)).toBeInTheDocument();
  fireEvent.click(within(panel).getByRole('button', { name: /Conferir foto da NF 123/ }));
  expect(await screen.findByRole('region', { name: 'Fotos pendentes nesta rota' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Finalizar rota' })).toBeDisabled();
  confirm.mockResolvedValueOnce(false);
  fireEvent.click(screen.getByRole('button', { name: 'Fechar', exact: true }));
  await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.stringContaining('antes de encaminhar'), expect.objectContaining({ title: 'Fotos pendentes nesta conferência' })));
  expect(screen.getByRole('region', { name: 'Fotos pendentes nesta rota' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Fechar', exact: true }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Fotos pendentes nesta rota' })).not.toBeInTheDocument());
  view.unmount();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  list.mockRejectedValue(new Error('Sem rede'));
  render(<MemoryRouter><ReceiptBagClosing /></MemoryRouter>);
  expect(await screen.findByText(/A lista salva continua visível/)).toBeInTheDocument();
  expect(screen.getByRole('region', { name: /Presentes sem foto/ })).toHaveTextContent('NF 123');
  expect(screen.queryByText(/Nenhum canhoto presente aguardando foto/)).not.toBeInTheDocument();
});

test('resposta perdida na confirmação não vira sucesso e não desaparece após recarregar', async () => {
  list.mockResolvedValue(response([])); getBag.mockResolvedValue({ ...bag, items: [{ ...item, status: 'pending', confirmed_bag_id: null }] });
  update.mockRejectedValue(new Error('Resposta não recebida'));
  const view = render(<MemoryRouter><ReceiptBagClosing /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Retomar' }));
  await screen.findByText('NF 123');
  fireEvent.doubleClick(screen.getByText('NF 123'));
  await waitFor(() => expect(update).toHaveBeenCalled());
  expect(await screen.findByText('Resposta não recebida')).toBeInTheDocument();
  view.unmount(); list.mockRejectedValue(new Error('Sem rede'));
  render(<MemoryRouter><ReceiptBagClosing /></MemoryRouter>);
  expect(await screen.findByText('Presença a verificar: confirmação sem resposta.')).toBeInTheDocument();
});

test('confirmar presença sem foto destaca a NF imediatamente e mantém fechamento bloqueado', async () => {
  let present = false;
  list.mockImplementation(async () => response(present ? [photoEntryFromBag(bag, item)] : []));
  getBag.mockImplementation(async () => present ? bag : { ...bag, items: [{ ...item, status: 'pending', confirmed_bag_id: null }] });
  update.mockImplementation(async () => { present = true; return bag; });
  render(<MemoryRouter><ReceiptBagClosing /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Retomar' }));
  fireEvent.doubleClick(await screen.findByText('NF 123'));
  expect(await screen.findByRole('region', { name: 'Fotos pendentes nesta rota' })).toHaveTextContent('NF 123');
  expect(screen.getByRole('button', { name: 'Finalizar rota' })).toBeDisabled();
  expect(api.finishReceiptBagClosing).not.toHaveBeenCalled();
});

test('consulta incompleta não apaga a fila salva nem mostra zero pendências', async () => {
  const { result, unmount } = renderHook(() => useReceiptPhotoPendencies());
  act(() => result.current.rememberBag(bag)); unmount();
  list.mockResolvedValue({ rows: [], pending_items: [] } as unknown as ReceiptBagListResponse);
  render(<MemoryRouter><ReceiptBagClosing /></MemoryRouter>);
  expect(await screen.findByText('A consulta dos malotes veio incompleta. Tente atualizar novamente.')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: /Presentes sem foto/ })).toHaveTextContent('NF 123');
});

test('consulta antiga não apaga confirmação recente; consulta nova com foto remove o alerta', () => {
  const { result } = renderHook(() => useReceiptPhotoPendencies());
  const oldRevision = result.current.getRevision();
  act(() => result.current.rememberAttempt(photoEntryFromBag(bag, item)));
  act(() => result.current.acceptList(response([]), oldRevision));
  expect(result.current.items).toHaveLength(1);
  act(() => result.current.rememberBag(bag));
  expect(result.current.items[0].confirmation_uncertain).toBeUndefined();
  act(() => result.current.acceptList(response([]), result.current.getRevision()));
  expect(result.current.items).toHaveLength(0);
});

test('mudar o recorte não esconde uma pendência salva de outro malote', () => {
  const { result } = renderHook(() => useReceiptPhotoPendencies());
  act(() => result.current.rememberBag(bag));
  act(() => result.current.acceptList({ ...response([]), rows: [] }, result.current.getRevision()));
  expect(result.current.items).toHaveLength(1);
  expect(result.current.items[0].needs_refresh).toBe(true);
  act(() => result.current.rememberBag({ ...bag, items: [{ ...item, has_whatsapp_photo: true }] }));
  expect(result.current.items).toHaveLength(0);
});

test('cache é isolado por usuário e empresa e preserva memória quando o armazenamento falha', () => {
  const { result: firstResult, unmount: firstUnmount } = renderHook(() => useReceiptPhotoPendencies());
  act(() => firstResult.current.rememberBag(bag)); firstUnmount();
  localStorage.setItem('company_id', '2');
  const { result: secondResult, unmount: secondUnmount } = renderHook(() => useReceiptPhotoPendencies());
  expect(secondResult.current.items).toHaveLength(0);
  const fail = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Sem espaço'); });
  try {
    act(() => secondResult.current.rememberBag(bag));
    expect(secondResult.current.items).toHaveLength(1); expect(secondResult.current.storageError).toBe(true);
  } finally { fail.mockRestore(); }
  secondUnmount(); localStorage.setItem('company_id', '1'); localStorage.setItem('user_login', 'outro');
  const { result: thirdResult } = renderHook(() => useReceiptPhotoPendencies());
  expect(thirdResult.current.items).toHaveLength(0);
});

test('extras recebidos exigem foto no malote atual e entregue não substitui evidência', () => {
  const extra = { ...item, status: 'resolved_elsewhere', origin_bag_id: 5 } as ReceiptBagItem;
  expect(missingPhotosInBag({ ...bag, items: [extra] })).toHaveLength(1);
  expect(missingPhotosInBag({ ...bag, id: 5, items: [extra] })).toHaveLength(0);
  render(<ConferencePanel bag={{ ...bag, items: [extra] }} items={[]} selectedItem={null} itemFilter="all" itemSearch="nenhum" extraInvoice=""
    error="" feedback="" mutating={false} onClose={jest.fn()} onSelect={jest.fn()} onFilter={jest.fn()}
    onSearch={jest.fn()} onExtraChange={jest.fn()} onExtra={jest.fn()} onMutate={jest.fn()} onMarkRemaining={jest.fn()} onFinish={jest.fn()} />);
  expect(screen.getByRole('region', { name: 'Fotos pendentes nesta rota' })).toHaveTextContent('NF 123');
  expect(screen.getByRole('button', { name: 'Finalizar rota' })).toBeDisabled();
});

test('avisa ao trocar de página e ao fechar a aba; cancela voltar do navegador', async () => {
  const { unmount } = renderHook(() => useReceiptPhotoLeaveGuard(1));
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
  const link = document.createElement('a'); link.href = '/#/home'; link.textContent = 'Início'; document.body.appendChild(link);
  confirm.mockResolvedValueOnce(false);
  fireEvent.click(link);
  await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.stringContaining('antes de encaminhar'), expect.objectContaining({ title: 'Fotos pendentes antes de sair' })));
  const nativeConfirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  const previousUrl = window.location.href;
  try {
    window.history.pushState({}, '', '/#/home');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(window.location.href).toBe(previousUrl);
  } finally { nativeConfirm.mockRestore(); link.remove(); unmount(); }
});

test('troca de página por botão também pede confirmação e permite permanecer', async () => {
  function NavigationHarness() {
    useReceiptPhotoLeaveGuard(1);
    const navigate = useNavigate();
    const location = useLocation();
    return <><p>Local: {location.pathname}</p><button onClick={() => navigate('/home')}>Outra página</button></>;
  }
  confirm.mockResolvedValueOnce(false);
  render(<MemoryRouter initialEntries={['/receipt-bag-closing']}><NavigationHarness /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Outra página' }));
  await waitFor(() => expect(confirm).toHaveBeenCalled());
  expect(screen.getByText('Local: /receipt-bag-closing')).toBeInTheDocument();
});

test('cancelar o retorno do navegador mantém a conferência montada no HashRouter', () => {
  function GuardedPage() { useReceiptPhotoLeaveGuard(1); return <p>Conferência aberta</p>; }
  const previousUrl = window.location.href;
  const nativeConfirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  window.history.replaceState({ idx: 1 }, '', '/#/receipt-bag-closing');
  const view = render(<HashRouter><Routes><Route path="/receipt-bag-closing" element={<GuardedPage />} /><Route path="/home" element={<p>Outra página</p>} /></Routes></HashRouter>);
  try {
    act(() => {
      window.history.replaceState({ idx: 0 }, '', '/#/home');
      window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: 0 } }));
    });
    expect(screen.getByText('Conferência aberta')).toBeInTheDocument();
    expect(screen.queryByText('Outra página')).not.toBeInTheDocument();
  } finally { view.unmount(); nativeConfirm.mockRestore(); window.history.replaceState(null, '', previousUrl); }
});


test('Vitalmar dispensada e mudancas de custodia saem da fila; parcial permanece', () => {
  const { result } = renderHook(() => useReceiptPhotoPendencies());
  act(() => result.current.rememberBag(bag));
  expect(result.current.items).toHaveLength(1);
  act(() => result.current.rememberBag({ ...bag, items: [{ ...item, receipt_photo_required: false }] }));
  expect(result.current.items).toHaveLength(0);
  for (const status of ['absent', 'retained', 'redelivery', 'returned', 'waived'] as const) {
    act(() => result.current.rememberBag(bag));
    act(() => result.current.rememberBag({ ...bag, items: [{ ...item, status }] }));
    expect(result.current.items).toHaveLength(0);
  }
  act(() => result.current.rememberBag({ ...bag, items: [{ ...item, operational_status: 'partially_returned' }] }));
  expect(result.current.items).toHaveLength(1);
});

test('pagina parada nao consulta em intervalos nem ao ganhar foco; somente evento da NF pendente verifica o malote', async () => {
  render(<MemoryRouter><ReceiptBagClosing /></MemoryRouter>);
  const pendingPanel = await screen.findByRole('region', { name: /Presentes sem foto/ });
  await within(pendingPanel).findByText(/NF 123/);
  await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  jest.useFakeTimers();
  try {
    act(() => { jest.advanceTimersByTime(120000); window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
    expect(list).toHaveBeenCalledTimes(1); expect(getBag).not.toHaveBeenCalled();
    act(() => {
      mockStatusListener?.({ type: 'driver_location_updated', invoice_number: '123', trip_id: 100 });
      mockStatusListener?.({ invoice_number: '123', invoice_company_id: 2, status: 'on_the_way' });
      mockStatusListener?.({ invoice_number: '999', invoice_company_id: 2, status: 'delivered' });
      mockStatusListener?.({ invoice_number: '123', invoice_company_id: 3, status: 'delivered' });
      jest.advanceTimersByTime(1000);
    });
    expect(getBag).not.toHaveBeenCalled();
    getBag.mockResolvedValue({ ...bag, items: [{ ...item, has_whatsapp_photo: true }] });
    await act(async () => {
      mockStatusListener?.({ invoice_number: '000123', invoice_company_id: 2, status: 'delivered' });
      mockStatusListener?.({ invoice_number: '123', invoice_company_id: 2, status: 'delivered' });
      jest.advanceTimersByTime(500);
    });
    expect(getBag).toHaveBeenCalledTimes(1); expect(getBag).toHaveBeenCalledWith(10);
    expect(list).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: /Presentes sem foto/ })).not.toHaveTextContent('NF 123');
    act(() => jest.advanceTimersByTime(120000));
    expect(getBag).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});

test('verificar fotos consulta apenas malotes salvos e remove dispensa Vitalmar', async () => {
  const cached = photoEntryFromBag(bag, item);
  localStorage.setItem('kp-receipt-photos-v1:1:operacao', JSON.stringify({ version: 1, items: [cached], synced_at: null, saved_at: null }));
  list.mockResolvedValue(response([cached]));
  getBag.mockResolvedValue({ ...bag, items: [{ ...item, receipt_photo_required: false }] });
  render(<MemoryRouter><ReceiptBagClosing /></MemoryRouter>);
  const panel = await screen.findByRole('region', { name: /Presentes sem foto/ });
  await waitFor(() => expect(within(panel).getByRole('button', { name: /Verificar fotos/ })).toBeEnabled());
  fireEvent.click(within(panel).getByRole('button', { name: /Verificar fotos/ }));
  await waitFor(() => expect(panel).not.toHaveTextContent('NF 123'));
  expect(getBag).toHaveBeenCalledTimes(1); expect(list).toHaveBeenCalledTimes(1);
});


test('restaura as duas NFs uma vez cada quando o cache antigo repete o mesmo item sem empresa', () => {
  const notes = ['86293', '86291'].map((invoice_number, index) => photoEntryFromBag(bag, { ...item, id: index + 1, invoice_number }));
  const copies = [...notes.map(note => ({ ...note, company_id: 0 })), ...notes];
  localStorage.setItem('kp-receipt-photos-v1:1:operacao', JSON.stringify({ version: 1, items: copies, saved_at: null, synced_at: null }));
  const { result } = renderHook(() => useReceiptPhotoPendencies());
  expect(result.current.items.map(note => note.invoice_number)).toEqual(['86293', '86291']);
  expect(result.current.items.every(note => note.company_id === 2)).toBe(true);
  expect(uniquePhotoPendencies([...notes, ...notes.map(note => ({ ...note, company_id: 0 }))])).toEqual(notes);
});

test('não confunde NFs homônimas de empresas distintas; rascunho sem identidade só é substituído se não for ambíguo', () => {
  const known = photoEntryFromBag(bag, item);
  const otherCompany = { ...known, item_id: 2, company_id: 3 };
  const unknown = { ...known, item_id: 0, company_id: 0, confirmation_uncertain: true };
  expect(uniquePhotoPendencies([unknown, known])).toEqual([known]);
  expect(uniquePhotoPendencies([unknown, known, otherCompany])).toHaveLength(3);
  expect(uniquePhotoPendencies([unknown, { ...known, status: 'pending' }])).toHaveLength(2);
  expect(uniquePhotoPendencies([known, otherCompany]).map(note => note.company_id)).toEqual([2, 3]);
});

test('verifica uma vez o malote salvo fora da lista e remove Vitalmar dispensada sem polling', async () => {
  const cached = photoEntryFromBag(bag, item);
  localStorage.setItem('kp-receipt-photos-v1:1:operacao', JSON.stringify({ version: 1, items: [cached], saved_at: null, synced_at: null }));
  list.mockResolvedValue({ ...response([]), rows: [] });
  getBag.mockResolvedValue({ ...bag, items: [{ ...item, receipt_photo_required: false }] });
  render(<MemoryRouter><ReceiptBagClosing /></MemoryRouter>);
  const panel = await screen.findByRole('region', { name: /Presentes sem foto/ });
  await waitFor(() => expect(getBag).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(panel).not.toHaveTextContent('NF 123'));
  expect(getBag).toHaveBeenCalledWith(10); expect(list).toHaveBeenCalledTimes(1);
});
