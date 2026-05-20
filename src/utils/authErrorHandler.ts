import axios from 'axios';
import { clearLocalSession } from './logoutSession';

const AUTH_REDIRECT_FLAG = 'kp_auth_redirect_in_progress';

const AUTH_MESSAGE_PATTERNS = [
  /usuario nao autenticado/i,
  /token ausente/i,
  /token invalido/i,
  /sessao encerrada/i,
  /session .* token/i,
  /contexto de empresa ausente no usuario autenticado/i,
];

function isLoginRouteRequest(url: string) {
  return /\/login(?:\/|$)/i.test(url);
}

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    return String(data?.message || data?.error || '').trim();
  }

  if (error instanceof Error) {
    return String(error.message || '').trim();
  }

  return '';
}

export function isAuthenticationError(error: unknown) {
  if (!axios.isAxiosError(error)) return false;

  const status = Number(error.response?.status || 0);
  const url = String(error.config?.url || '').trim();
  const message = getApiErrorMessage(error);

  if (isLoginRouteRequest(url)) {
    return false;
  }

  if (status === 401) return true;
  if (status !== 403) return false;
  return AUTH_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export function redirectToLoginBecauseSessionExpired(message = 'Sua sessão expirou ou não é mais válida. Faça login novamente.') {
  if (sessionStorage.getItem(AUTH_REDIRECT_FLAG) === '1') {
    clearLocalSession();
    return;
  }

  sessionStorage.setItem(AUTH_REDIRECT_FLAG, '1');
  clearLocalSession();
  window.alert(message);
  window.location.hash = '#/';
  window.setTimeout(() => {
    sessionStorage.removeItem(AUTH_REDIRECT_FLAG);
  }, 1000);
}

export function handleAuthenticationError(error: unknown, message?: string) {
  if (!isAuthenticationError(error)) return false;
  redirectToLoginBecauseSessionExpired(message);
  return true;
}
