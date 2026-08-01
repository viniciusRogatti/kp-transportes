import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login';
import verifyToken from '../../utils/verifyToken';

const mockNavigate = jest.fn();

jest.mock('axios');
jest.mock('../../utils/verifyToken');
jest.mock('../../components/ui/ThemeToggleButton', () => () => <button type="button">Alternar tema</button>);
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));
jest.mock('../../components/ui/HumanVerification', () => {
  const ReactModule = jest.requireActual('react');
  const Verification = ReactModule.forwardRef((_props: any, ref: any) => {
    const props = _props as { onTokenChange: (token: string) => void };
    ReactModule.useImperativeHandle(ref, () => ({ reset: jest.fn() }));
    return <button type="button" onClick={() => props.onTokenChange('captcha-ok')}>Concluir verificação</button>;
  });
  return { __esModule: true, default: Verification };
});

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const originalSiteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;

const renderLogin = () => render(<MemoryRouter><Login /></MemoryRouter>);

const fillCredentials = async () => {
  await userEvent.type(screen.getByLabelText('Usuário'), 'operacao');
  await userEvent.type(screen.getByLabelText('Senha'), 'senha-segura');
};

describe('Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REACT_APP_TURNSTILE_SITE_KEY = 'site-key-test';
    mockedVerifyToken.mockResolvedValue(true);
    mockedAxios.isAxiosError.mockImplementation((error: any) => Boolean(error?.isAxiosError));
  });

  afterAll(() => {
    process.env.REACT_APP_TURNSTILE_SITE_KEY = originalSiteKey;
  });

  it('renderiza a identidade logística e os campos acessíveis', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Controle, rastreabilidade e eficiência em cada operação.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bem-vindo à operação' })).toBeInTheDocument();
    expect(screen.getByLabelText('Usuário')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByAltText('Caminhão Volvo da frota em ambiente operacional')).toBeInTheDocument();
  });

  it('pausa a rota ao clicar e libera os caminhões ao digitar', async () => {
    renderLogin();
    const route = screen.getByRole('button', { name: 'Pausar caminhões da rota' });
    const scene = route.closest('section');
    expect(scene).toHaveAttribute('data-traffic-paused', 'false');
    await userEvent.click(route);
    expect(scene).toHaveAttribute('data-traffic-paused', 'true');
    await userEvent.type(screen.getByLabelText('Usuário'), 'o');
    expect(scene).toHaveAttribute('data-traffic-paused', 'false');
  });

  it('valida os dois campos sem enviar credenciais vazias', () => {
    renderLogin();
    fireEvent.submit(screen.getByRole('button', { name: /entrar no sistema/i }).closest('form')!);
    expect(screen.getByText('Informe seu usuário.')).toBeInTheDocument();
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('mostra e oculta a senha com um botão acessível', async () => {
    renderLogin();
    const password = screen.getByLabelText('Senha');
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('mantém a entrada bloqueada até concluir a verificação de segurança', async () => {
    renderLogin();
    const submit = screen.getByRole('button', { name: /entrar no sistema/i });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Concluir verificação' }));
    expect(submit).toBeEnabled();
  });

  it('autentica, valida o token e redireciona conforme o perfil', async () => {
    mockedAxios.post.mockImplementation(async (url: string) => {
      if (url.includes('verify-turnstile')) return { data: { success: true, proof: 'proof-ok' } } as any;
      return {
        data: {
          token: 'token-ok',
          data: { permission: 'expedicao', name: 'Operação', username: 'operacao', companyId: 1, companyCode: 'KP', companyName: 'KP Transportes' },
        },
      } as any;
    });
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Concluir verificação' }));
    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: /entrar no sistema/i }));
    await waitFor(() => expect(mockedVerifyToken).toHaveBeenCalledWith('token-ok'));
    expect(mockNavigate).toHaveBeenCalledWith('/home');
    expect(localStorage.getItem('company_name')).toBe('KP Transportes');
  });

  it('envia pelo Enter e impede novo envio enquanto autentica', async () => {
    let resolveLogin: ((value: any) => void) | null = null;
    mockedAxios.post.mockImplementation((url: string) => {
      if (url.includes('verify-turnstile')) return Promise.resolve({ data: { success: true, proof: 'proof-ok' } });
      return new Promise((resolve) => { resolveLogin = resolve; });
    });
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Concluir verificação' }));
    await fillCredentials();
    await userEvent.type(screen.getByLabelText('Senha'), '{enter}');
    await waitFor(() => expect(screen.getByRole('button', { name: /validando acesso/i })).toBeDisabled());
    expect(mockedAxios.post.mock.calls.filter(([url]) => String(url).endsWith('/login'))).toHaveLength(1);
    resolveLogin?.({ data: { token: 'token-ok', data: { permission: 'expedicao' } } });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/home'));
  });

  it('apresenta erro de rede sem expor detalhes internos', async () => {
    mockedAxios.post.mockImplementation(async (url: string) => {
      if (url.includes('verify-turnstile')) return { data: { success: true, proof: 'proof-ok' } } as any;
      const error = new Error('ECONNREFUSED') as any;
      error.isAxiosError = true;
      throw error;
    });
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Concluir verificação' }));
    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: /entrar no sistema/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar ao ambiente operacional');
    expect(screen.queryByText('ECONNREFUSED')).not.toBeInTheDocument();
  });
});
