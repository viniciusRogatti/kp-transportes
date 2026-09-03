import { getRequestIdFromError, withRequestReference } from '../requestError';

describe('requestError', () => {
  it('recupera o identificador retornado no cabecalho', () => {
    const error = { response: { headers: { 'x-request-id': 'request-123' } } };
    expect(getRequestIdFromError(error)).toBe('request-123');
    expect(withRequestReference('Falha na consulta.', error)).toBe('Falha na consulta. Referência: request-123.');
  });

  it('prioriza o identificador do corpo e rejeita valores inseguros', () => {
    expect(getRequestIdFromError({
      response: {
        data: { requestId: 'body-request-1' },
        headers: { 'x-request-id': 'header-request-2' },
      },
    })).toBe('body-request-1');
    expect(getRequestIdFromError({
      response: { headers: { 'x-request-id': 'valor com espaços' } },
    })).toBeNull();
  });
});
