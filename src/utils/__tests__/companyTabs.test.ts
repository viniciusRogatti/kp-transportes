import { COMPANY_LABELS, COMPANY_TAB_ORDER } from '../companyTabs';

describe('companyTabs', () => {
  it('exibe o Grupo Horeca nas telas compartilhadas de empresa', () => {
    expect(COMPANY_TAB_ORDER).toContain('grupo_horeca');
    expect(COMPANY_LABELS.grupo_horeca).toBe('GRUPO HORECA');
    expect(COMPANY_LABELS.bacio_di_latte).toBe('GRUPO HORECA');
  });

  it('exibe Piracanjuba e Vitalmar nas telas compartilhadas de empresa', () => {
    expect(COMPANY_TAB_ORDER).toEqual(expect.arrayContaining(['piracanjuba', 'vitalmar']));
    expect(COMPANY_LABELS.piracanjuba).toBe('PIRACANJUBA');
    expect(COMPANY_LABELS.vitalmar).toBe('VITALMAR');
  });
});
