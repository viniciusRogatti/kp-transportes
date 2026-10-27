import { AxiosRequestConfig } from 'axios';
import { API_URL } from '../data';

export const API_READ_TIMEOUT_MS = 30000;

/** Bound API reads without interrupting uploads or writes whose outcome could be uncertain. */
export function applyApiReadTimeout(config: AxiosRequestConfig) {
  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head'].includes(method) || (config.timeout || 0) > 0) return;
  const url = new URL(config.url || '', config.baseURL || window.location.origin).href;
  if (url === API_URL || url.startsWith(`${API_URL}/`)) config.timeout = API_READ_TIMEOUT_MS;
}
