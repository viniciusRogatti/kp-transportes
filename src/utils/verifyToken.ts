import axios from "axios";
import { API_URL } from "../data";

const VALID_TOKEN_CACHE_MS = 30_000;
let validTokenCache: { token: string; validUntil: number } | null = null;
const pendingVerifications = new Map<string, Promise<boolean>>();

const verifyToken = async (token: string) => {
  const clearSessionStorage = (expectedToken?: string) => {
    const currentToken = localStorage.getItem('token');
    if (expectedToken && currentToken && currentToken !== expectedToken) {
      return;
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user_permission');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_login');
    localStorage.removeItem('company_id');
    localStorage.removeItem('company_code');
    localStorage.removeItem('company_name');
    delete axios.defaults.headers.common.Authorization;
    if (!expectedToken || validTokenCache?.token === expectedToken) {
      validTokenCache = null;
    }
  };

  if (validTokenCache?.token === token && validTokenCache.validUntil > Date.now()) {
    return true;
  }

  const pendingVerification = pendingVerifications.get(token);
  if (pendingVerification) return pendingVerification;

  const verification = (async () => {
    try {
      const response = await axios.get(`${API_URL}/login/verifyToken`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.valid) {
        validTokenCache = { token, validUntil: Date.now() + VALID_TOKEN_CACHE_MS };
        return true;
      }

      clearSessionStorage(token);
      return false;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = Number(error.response?.status || 0);
        if (status === 401 || status === 403) {
          clearSessionStorage(token);
          return false;
        }
      }

      console.error('[auth] verifyToken falhou sem indicar token invalido; sessao local preservada.', error);
      return true;
    } finally {
      pendingVerifications.delete(token);
    }
  })();

  pendingVerifications.set(token, verification);
  return verification;
};

export default verifyToken;
