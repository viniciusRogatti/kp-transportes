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

  it('limita a torre de controle aos modulos permitidos', () => {
    expect(getTutorialModulesForPermission('control_tower').map((module) => module.id)).toEqual([
      'delivery-monitoring', 'returns', 'return-base', 'control-tower',
    ]);
  });
});
