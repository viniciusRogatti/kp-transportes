import { isRetryableTutorialSyncError } from './tutorialProgressService';

const axiosError = (status?: number) => ({
  isAxiosError: true,
  response: status === undefined ? undefined : { status },
});

describe('tutorialProgressService', () => {
  it('tenta novamente em falha de rede e indisponibilidade temporária', () => {
    expect(isRetryableTutorialSyncError(axiosError())).toBe(true);
    expect(isRetryableTutorialSyncError(axiosError(503))).toBe(true);
    expect(isRetryableTutorialSyncError(axiosError(429))).toBe(true);
  });

  it('não exibe aviso de conexão para erros de autenticação ou validação', () => {
    expect(isRetryableTutorialSyncError(axiosError(401))).toBe(false);
    expect(isRetryableTutorialSyncError(axiosError(400))).toBe(false);
    expect(isRetryableTutorialSyncError(new Error('erro local'))).toBe(false);
  });
});
