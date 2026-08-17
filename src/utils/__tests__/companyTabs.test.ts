import { COMPANY_LABELS, COMPANY_TAB_ORDER } from '../companyTabs';

describe('companyTabs', () => {
  it('exibe a Bacio di Latte nas telas compartilhadas de empresa', () => {
    expect(COMPANY_TAB_ORDER).toContain('bacio_di_latte');
    expect(COMPANY_LABELS.bacio_di_latte).toBe('BACIO DI LATTE');
  });
});
