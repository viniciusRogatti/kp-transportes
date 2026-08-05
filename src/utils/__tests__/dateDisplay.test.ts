import { formatDateBR, normalizeDateForApi } from '../dateDisplay';

describe('padronizacao de datas', () => {
  it('exibe ISO no formato brasileiro sem inverter dia e mes', () => {
    expect(formatDateBR('2026-03-08')).toBe('08/03/2026');
    expect(formatDateBR('2026-08-05')).toBe('05/08/2026');
    expect(formatDateBR('2026-05-08')).toBe('08/05/2026');
  });

  it('normaliza entrada brasileira para a API', () => {
    expect(normalizeDateForApi('08/03/2026')).toBe('2026-03-08');
    expect(normalizeDateForApi('03/08/2026')).toBe('2026-08-03');
  });

  it('rejeita datas inexistentes ou formatos ambiguos', () => {
    expect(normalizeDateForApi('31/02/2026')).toBeNull();
    expect(normalizeDateForApi('March 8, 2026')).toBeNull();
  });
});
