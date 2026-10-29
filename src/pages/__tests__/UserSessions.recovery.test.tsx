import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import UserSessions from '../UserSessions';
import { showConfirm } from '../../utils/dialog';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('react-router', () => ({ useNavigate: () => jest.fn() }));
jest.mock('echarts-for-react', () => () => null);
jest.mock('../../components/Header', () => () => null);
jest.mock('../../utils/verifyToken', () => ({ __esModule: true, default: async () => true }));
jest.mock('../../utils/dialog', () => ({ showConfirm: jest.fn() }));
jest.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ isLightTheme: true }) }));
const api = axios as jest.Mocked<typeof axios>;
const confirm = showConfirm as jest.MockedFunction<typeof showConfirm>;
beforeEach(() => {
  localStorage.setItem('token', 'synthetic-token');
  localStorage.setItem('user_permission', 'master');
  api.get.mockResolvedValue({ data: [] });
  confirm.mockResolvedValue(true);
});
afterEach(() => { jest.clearAllMocks(); localStorage.clear(); });
const openPage = async () => {
  await act(async () => { render(<UserSessions />); });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/analytics'), expect.anything()));
  return screen.getByRole('button', { name: 'Recuperar fotos pendentes de hoje' });
};
test('o botão aguarda a resposta e exibe baixas, alertas e falhas reais', async () => {
  let finish!: (value: any) => void;
  api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(await openPage());
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(expect.stringContaining('/users/sessions/whatsapp-bot/recover-pending')));
  expect(screen.getByRole('button', { name: 'Lendo mensagens...' })).toBeDisabled();
  expect(screen.getByText(/Recuperando mensagens de hoje/)).toBeInTheDocument();
  await act(async () => finish({ data: { summary: { photos: 4, delivered: 1, alreadyDelivered: 1, review: 1, failed: 1 } } }));
  expect(screen.getByText('Recuperação concluída: 4 foto(s), 1 NF(s) baixada(s), 1 já entregue(s), 1 notificação(ões), 1 falha(s).')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Recuperar fotos pendentes de hoje' })).toBeEnabled();
  expect(api.post).toHaveBeenCalledTimes(1);
});
test('falha da recuperação fica visível e permite tentar novamente', async () => {
  const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    api.post.mockRejectedValueOnce({ response: { data: { message: 'Recuperação interrompida.', details: 'Tempo limite ao conectar o WhatsApp.' } } });
    fireEvent.click(await openPage());
    expect(await screen.findByText('Recuperação interrompida. Detalhes: Tempo limite ao conectar o WhatsApp.')).toBeInTheDocument();
    expect(screen.queryByText(/Recuperação concluída/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recuperar fotos pendentes de hoje' })).toBeEnabled();
  } finally { logged.mockRestore(); }
});
test('cancelar a confirmação não inicia recuperação', async () => {
  confirm.mockResolvedValueOnce(false);
  fireEvent.click(await openPage());
  await waitFor(() => expect(confirm).toHaveBeenCalled());
  expect(api.post).not.toHaveBeenCalled();
});

test('o filtro de horarios oferece apenas operadores do painel', async () => {
  api.get.mockImplementation(async (url) => ({ data: String(url).endsWith('/users') ? [
    { id: 1, name: 'Operador Teste', username: 'operador', permission: 'expedicao' },
    { id: 2, name: 'Motorista Teste', username: 'motorista', permission: 'driver' },
  ] : [] }));
  await openPage();
  expect(await screen.findByRole('option', { name: /Operador Teste/ })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Motorista Teste/ })).not.toBeInTheDocument();
});
