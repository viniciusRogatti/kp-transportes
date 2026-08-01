import { findTutorialModuleByPath, getTutorialModulesForPermission } from './tutorialConfig';

describe('tutorial contextual por permissao', () => {
  it('inclui a conferencia de malotes para perfis operacionais autorizados', () => {
    const modules = getTutorialModulesForPermission('conferente');
    expect(modules.some((module) => module.id === 'receipt-bag-closing')).toBe(true);
    expect(modules.some((module) => module.id === 'users')).toBe(false);
  });

  it('nao apresenta paginas administrativas ao usuario de consulta', () => {
    const routes = getTutorialModulesForPermission('user').map((module) => module.route);
    expect(routes).toContain('/invoices');
    expect(routes).not.toContain('/users');
    expect(routes).not.toContain('/uploadFiles');
  });

  it('resolve o guia detalhado da conferencia de malotes', () => {
    const module = findTutorialModuleByPath('/receipt-bag-closing', 'expedicao');
    expect(module?.steps.map((step) => step.target)).toEqual(expect.arrayContaining([
      'bag-page-intro', 'bag-date-filter', 'bag-status-filters', 'bag-list',
    ]));
  });

  it('ensina empresas, filtros, status e resultados nas notas do dia', () => {
    const module = findTutorialModuleByPath('/todayInvoices', 'expedicao');
    expect(module?.steps.map((step) => step.id)).toEqual([
      'today-overview',
      'today-companies',
      'today-filters',
      'today-status',
      'today-active-filters',
      'today-results',
    ]);
  });

  it('explica a leitura e a resolucao de cada fila do painel operacional', () => {
    const module = findTutorialModuleByPath('/home', 'expedicao');
    expect(module?.steps.map((step) => step.id)).toEqual(expect.arrayContaining([
      'home-radar',
      'home-occurrences',
      'home-redelivery',
      'home-unassigned',
      'home-returned',
      'home-retained',
      'home-pending-receipts',
      'home-overdue',
      'home-resolution-rule',
    ]));
    expect(module?.importantRules).toHaveLength(3);
    expect(module?.faq).toHaveLength(2);
  });

  it('aplica descoberta de filtros e botoes aos modulos comuns', () => {
    const module = findTutorialModuleByPath('/customers', 'expedicao');
    expect(module?.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: 'auto-filters', discoverControls: 'filters' }),
      expect.objectContaining({ target: 'auto-content' }),
      expect.objectContaining({ target: 'auto-actions', discoverControls: 'actions' }),
    ]));
  });

  it('limita a torre de controle aos modulos permitidos', () => {
    expect(getTutorialModulesForPermission('control_tower').map((module) => module.id)).toEqual([
      'delivery-monitoring', 'returns', 'return-base', 'control-tower',
    ]);
  });
});
