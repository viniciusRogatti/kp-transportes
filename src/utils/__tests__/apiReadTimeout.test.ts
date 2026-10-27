import { applyApiReadTimeout, API_READ_TIMEOUT_MS } from '../apiReadTimeout';
import { API_URL } from '../../data';
import { AxiosRequestConfig } from 'axios';

it('limita consultas da API, incluindo as com autorização explícita', () => {
  const config: AxiosRequestConfig = { url: `${API_URL}/trips/search`, headers: { Authorization: 'Bearer teste' } };
  applyApiReadTimeout(config);
  expect(config.timeout).toBe(API_READ_TIMEOUT_MS);
});

it('preserva timeout específico, uploads, mutações e serviços externos', () => {
  for (const config of [
    { url: `${API_URL}/trips`, method: 'get', timeout: 12000 },
    { url: `${API_URL}/trips`, method: 'post' },
    { url: `${API_URL}/trips`, method: 'put' },
    { url: `${API_URL}/trips`, method: 'delete' },
    { url: 'https://outro.example/consulta' },
    { url: `${API_URL}.outro.example/consulta` },
  ]) {
    const before = { ...config };
    applyApiReadTimeout(config);
    expect(config).toEqual(before);
  }
});
