import { canAccessRoute } from '../utils/permissions';

export const CURRENT_TUTORIAL_VERSION = '2026.08.01';

export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';
export type TutorialStep = {
  id: string;
  title: string;
  content: string;
  target?: string;
  targetMobile?: string;
  placement?: TutorialPlacement;
  required?: boolean;
};
export type TutorialModule = {
  id: string;
  route: string;
  title: string;
  description: string;
  summary: string[];
  importantRules?: string[];
  faq?: Array<{ question: string; answer: string }>;
  required: boolean;
  order: number;
  steps: TutorialStep[];
};

const page = (
  id: string,
  route: string,
  title: string,
  description: string,
  order: number,
  summary: string[],
  importantRules: string[] = [],
): TutorialModule => ({
  id, route, title, description, order, summary, importantRules, required: true,
  steps: [
    {
      id: `${id}-overview`, target: 'app-page-title', title,
      content: description, placement: 'bottom', required: true,
    },
    {
      id: `${id}-workflow`, title: 'Fluxo principal',
      content: summary.join(' '), placement: 'center', required: true,
    },
    ...(importantRules.length ? [{
      id: `${id}-rules`, title: 'Antes de confirmar',
      content: importantRules.join(' '), placement: 'center' as const, required: true,
    }] : []),
  ],
});

export const tutorialModules: TutorialModule[] = [
  {
    ...page('home', '/home', 'Painel Operacional', 'Acompanhe indicadores, pendências e atalhos centrais da operação.', 10,
      ['Veja o resumo da operação.', 'Abra pendências diretamente pelos cartões.', 'Use os atalhos para os módulos principais.']),
    steps: [
      { id: 'home-overview', target: 'app-page-title', title: 'Painel Operacional', content: 'Este é o ponto de partida para acompanhar a operação e localizar pendências.', placement: 'bottom', required: true },
      { id: 'home-help', target: 'global-help', title: 'Ajuda sempre disponível', content: 'Clique neste botão quando quiser rever o guia da página atual, regras e dúvidas frequentes.', placement: 'bottom', required: true },
      { id: 'home-navigation', target: 'app-navigation', targetMobile: 'mobile-menu-button', title: 'Navegação por perfil', content: 'O menu mostra somente páginas autorizadas para o seu perfil.', placement: 'right', required: true },
    ],
  },
  page('today-invoices', '/todayInvoices', 'Notas do Dia', 'Consulte as notas da operação atual e seus estados.', 20,
    ['Filtre as notas do dia.', 'Confira situação e empresa.', 'Abra os detalhes antes de agir.']),
  page('invoice-search', '/invoices', 'Pesquisar Notas', 'Localize notas fiscais e consulte o histórico operacional.', 30,
    ['Pesquise pelo número da NF.', 'Confira status e comprovantes.', 'Acesse a jornada completa da nota.']),
  page('invoice-journey', '/invoice-journey', 'Jornada da NF', 'Entenda a sequência de eventos e responsáveis por cada alteração.', 40,
    ['Pesquise uma NF.', 'Leia os eventos em ordem cronológica.', 'Use a jornada para investigar divergências.']),
  page('products', '/products', 'Produtos', 'Consulte produtos importados e dados utilizados pela operação.', 50,
    ['Pesquise por código ou descrição.', 'Confirme unidade e informações fiscais.']),
  page('customers', '/customers', 'Clientes', 'Consulte clientes e dados usados em entregas e roteirização.', 60,
    ['Pesquise o cliente.', 'Confira endereço e contato antes da rota.']),
  page('route-planning', '/routePlanning', 'Roteirização', 'Monte viagens, associe motorista e veículo e organize a sequência das entregas.', 70,
    ['Selecione a data correta.', 'Valide motorista, veículo e segunda saída.', 'Revise as notas antes de criar a rota.'],
    ['Não altere entregas já concluídas sem conferir o histórico.', 'Evite atribuir a mesma NF a rotas concorrentes.']),
  page('delivery-monitoring', '/delivery-monitoring', 'Monitoramento de Entregas', 'Acompanhe o avanço documental das rotas e paradas que exigem atenção.', 80,
    ['Confira progresso por motorista.', 'Identifique paradas sem resultado.', 'Abra alertas vinculados à rota.']),
  {
    ...page('receipt-bag-closing', '/receipt-bag-closing', 'Conferência de Malotes', 'Confira fisicamente os canhotos devolvidos pelos motoristas.', 90,
      ['Localize malotes pendentes.', 'Confira cada canhoto físico.', 'Registre ausências e documentos extras.', 'Mantenha divergências abertas até a resolução.'],
      ['Nunca finalize como regular se houver canhoto faltante.', 'Canhotos sugeridos por telefone são evidências contextuais, não vínculo permanente.']),
    faq: [
      { question: 'Quando o malote aparece?', answer: 'Quando a rota termina documentalmente ou após a virada do dia operacional.' },
      { question: 'O que acontece com uma divergência?', answer: 'O malote permanece visível até a pendência ser resolvida e finalizada.' },
    ],
    steps: [
      { id: 'bag-overview', target: 'bag-page-intro', title: 'Fila de malotes', content: 'A fila reúne rotas concluídas e rotas antigas ainda sem conferência.', placement: 'bottom', required: true },
      { id: 'bag-date', target: 'bag-date-filter', title: 'Data e histórico', content: 'A data ajuda a localizar conferências concluídas. Malotes pendentes continuam visíveis independentemente do filtro.', placement: 'bottom', required: true },
      { id: 'bag-status-filters', target: 'bag-status-filters', title: 'Situação dos malotes', content: 'Alterne entre pendentes, atrasados, conferidos e todos.', placement: 'bottom', required: true },
      { id: 'bag-list', target: 'bag-list', title: 'Iniciar ou retomar', content: 'Abra o malote para conferir os canhotos. O progresso é persistido a cada ação.', placement: 'top', required: true },
      { id: 'bag-rule', title: 'Regra de divergência', content: 'Se faltar um documento ou existir sugestão não resolvida, finalize com pendência. O malote deve continuar na fila.', placement: 'center', required: true },
    ],
  },
  page('returns', '/returns-occurrences', 'Devoluções e Ocorrências', 'Registre e acompanhe devoluções, sobras e ocorrências operacionais.', 100,
    ['Escolha o tipo correto.', 'Confira produtos e quantidades.', 'Acompanhe o tratamento até a resolução.'],
    ['Não duplique lotes ou ocorrências para a mesma devolução.']),
  page('return-base', '/returns-occurrences/base', 'Base de Devoluções', 'Consulte e corrija a classificação operacional importada.', 110,
    ['Pesquise registros.', 'Revise divergências antes de substituir a classificação.']),
  page('pendencies', '/operational-pendencies', 'Central de Tratativas', 'Concentre pendências de canhotos, retornos e inconsistências.', 120,
    ['Use abas e filtros.', 'Abra a origem da pendência.', 'Registre a resolução de forma auditável.']),
  page('alerts', '/alerts', 'Central de Alertas', 'Consulte alertas operacionais, inclusive os já visualizados.', 130,
    ['Filtre por situação e gravidade.', 'Abra a entidade relacionada.', 'Resolva somente após tratar a causa.']),
  page('upload', '/uploadFiles', 'Importação de XML', 'Importe documentos fiscais e revise o resultado do processamento.', 140,
    ['Selecione arquivos válidos.', 'Revise erros e duplicidades.', 'Não reimporte sem analisar o resultado.']),
  page('cte', '/cte-management', 'Gestão de CT-e', 'Calcule, organize e acompanhe documentos de transporte.', 150,
    ['Escolha os documentos corretos.', 'Revise valores antes de confirmar.']),
  page('users', '/users', 'Usuários', 'Administre contas, perfis e escopos de acesso.', 160,
    ['Use o menor privilégio necessário.', 'Confira empresa e permissão antes de salvar.']),
  page('sessions', '/user-sessions', 'Sessões e Horários', 'Acompanhe sessões e registros de acesso dos usuários.', 170,
    ['Consulte sessões ativas.', 'Use os registros para auditoria.']),
  page('whatsapp', '/whatsapp-bot/connect', 'Conexão do WhatsApp', 'Administre a conexão operacional do bot de canhotos.', 180,
    ['Verifique a saúde da conexão.', 'Reconecte somente quando necessário.']),
  page('control-tower', '/control-tower/coletas', 'Torre de Controle', 'Acompanhe coletas, devoluções e eventos autorizados para a empresa.', 190,
    ['Use os filtros de situação.', 'Abra detalhes e histórico.', 'Registre mudanças somente após confirmação operacional.']),
];

export const getTutorialModulesForPermission = (permission: string) => tutorialModules
  .filter((module) => canAccessRoute(permission, module.route))
  .sort((left, right) => left.order - right.order);

export const findTutorialModuleByPath = (pathname: string, permission: string) => (
  getTutorialModulesForPermission(permission).find((module) => (
    pathname === module.route
    || (module.route === '/invoice-journey' && /^\/invoices\/[^/]+\/journey$/.test(pathname))
  )) || null
);
