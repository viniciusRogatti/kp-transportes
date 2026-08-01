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
  discoverControls?: 'filters' | 'actions';
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
      id: `${id}-filters`, target: 'auto-filters', title: 'Filtros e pesquisa',
      content: 'Use os filtros para reduzir a lista e localizar exatamente o registro necessário. Os campos disponíveis nesta tela aparecem abaixo.',
      placement: 'bottom', required: false, discoverControls: 'filters',
    },
    {
      id: `${id}-content`, target: 'auto-content', title: 'Informações da página',
      content: summary.join(' '), placement: 'center', required: true,
    },
    {
      id: `${id}-actions`, target: 'auto-actions', title: 'Botões e ações',
      content: 'Os botões mudam conforme o estado do registro e as permissões do seu perfil. Confira o resultado antes de confirmar qualquer alteração.',
      placement: 'top', required: false, discoverControls: 'actions',
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
    importantRules: [
      'O número do radar representa itens em aberto; ele não confirma que todos estejam vencidos.',
      'Prioridades vencidas exigem tratamento antes das pendências ainda dentro do prazo.',
      'Resolva a causa na página indicada e confirme o resultado antes de encerrar a tratativa.',
    ],
    faq: [
      { question: 'Por onde devo começar?', answer: 'Comece pelas Prioridades vencidas. Depois trate os maiores volumes do Radar operacional.' },
      { question: 'Por que o número não baixou?', answer: 'Atualize o radar e confirme se a causa foi concluída no módulo de origem. Apenas abrir ou visualizar não resolve a pendência.' },
    ],
    steps: [
      { id: 'home-overview', target: 'app-page-title', title: 'Painel Operacional', content: 'Use este painel como uma fila de trabalho: leia primeiro o prazo e a gravidade, depois abra o cartão e trate a causa no módulo indicado.', placement: 'bottom', required: true },
      { id: 'home-radar', target: 'home-radar', title: 'Como ler o radar', content: 'Cada número mostra quantos itens continuam em aberto. Zero significa que não há item naquela fila; um número maior pede organização, mas somente a área de prioridades indica o que já venceu.', placement: 'bottom', required: true, discoverControls: 'actions' },
      { id: 'home-occurrences', target: 'home-reminder-occurrences', title: 'Ocorrências abertas', content: 'São faltas, avarias, inversões ou outras divergências aguardando análise. Abra o cartão, valide NF, produtos, quantidades e motivo; registre a solução e conclua apenas com evidência do tratamento.', placement: 'right', required: true },
      { id: 'home-redelivery', target: 'home-reminder-redelivery', title: 'Reentregas sem nova rota', content: 'A entrega anterior não foi concluída e a NF ainda precisa de uma nova saída. Abra a tratativa, confirme o motivo e associe a NF a uma rota de reentrega antes de encerrar.', placement: 'right', required: true },
      { id: 'home-unassigned', target: 'home-reminder-unassigned', title: 'Notas sem rota', content: 'São notas disponíveis que ainda não foram direcionadas a motorista e veículo. Confira data, empresa e destino, depois inclua a NF na rota correta.', placement: 'right', required: true },
      { id: 'home-returned', target: 'home-reminder-returned', title: 'Devoluções fora de lote', content: 'A mercadoria retornou, mas ainda não entrou em um lote de devolução. Confira tipo e quantidade, adicione ao lote correto e acompanhe até o envio.', placement: 'right', required: true },
      { id: 'home-retained', target: 'home-reminder-retained', title: 'Canhotos retidos', content: 'O comprovante ficou temporariamente com alguém ou em outro ponto da operação. Identifique o responsável, recupere o documento e registre a regularização na tratativa.', placement: 'right', required: true },
      { id: 'home-pending-receipts', target: 'home-reminder-pending', title: 'Notas sem canhoto', content: 'A entrega de uma operação anterior ainda não possui comprovante válido. Verifique a situação da entrega e regularize o canhoto ou a justificativa correspondente.', placement: 'right', required: true },
      { id: 'home-treatment-center', target: 'home-treatment-center', title: 'Central de Tratativas', content: 'Este botão reúne as filas detalhadas. Ao abrir um cartão do radar, a central já recebe a aba correspondente; use seus filtros para localizar a NF e executar a correção.', placement: 'top', required: true },
      { id: 'home-overdue', target: 'home-overdue-priorities', title: 'Prioridades vencidas', content: 'Aqui aparecem somente itens que ultrapassaram o prazo operacional. Leia o tipo, a NF e os dias em aberto; trate primeiro os mais antigos e os destacados como urgentes.', placement: 'top', required: true, discoverControls: 'actions' },
      { id: 'home-resolution-rule', title: 'Ciclo correto de resolução', content: '1. Entenda o motivo e a idade. 2. Abra o item. 3. Corrija a causa no módulo indicado. 4. Registre observação ou evidência. 5. Atualize o radar e confirme que o item saiu da fila.', placement: 'center', required: true },
      { id: 'home-help', target: 'global-help', title: 'Ajuda sempre disponível', content: 'Use a ajuda para rever esta leitura, consultar as regras e reiniciar o guia da página quando surgir uma dúvida.', placement: 'bottom', required: true },
      { id: 'home-navigation', target: 'app-navigation', targetMobile: 'mobile-menu-button', title: 'Navegação por perfil', content: 'O menu mostra somente páginas autorizadas para o seu perfil. Os cartões do painel também respeitam essas permissões.', placement: 'right', required: true },
    ],
  },
  {
    ...page('today-invoices', '/todayInvoices', 'Notas do Dia', 'Consulte as notas da operação atual e seus estados.', 20,
      ['Filtre as notas por empresa, NF, produto, cliente, cidade, motorista, rota, carga ou situação.', 'Confira os dados e o status de cada nota.', 'Abra detalhes ou atribua uma nota somente depois de validar a operação.']),
    steps: [
      { id: 'today-overview', target: 'app-page-title', title: 'Notas do Dia', content: 'Aqui ficam as notas da operação atual, com pesquisa, situação documental e vínculo com as rotas.', placement: 'bottom', required: true },
      { id: 'today-companies', target: 'company-tabs', title: 'Empresas', content: 'Alterne entre as empresas ou use a visão de todas. Ao escolher “Todas”, o filtro de empresa permite refinar a consulta.', placement: 'bottom', required: true, discoverControls: 'actions' },
      { id: 'today-filters', target: 'today-filters', targetMobile: 'today-mobile-product-search', title: 'Filtros da página', content: 'Pesquise por NF, produto, cliente, cidade, motorista, rota e carga. Os filtros podem ser combinados e a lista de produtos respeita a seleção atual.', placement: 'bottom', required: true, discoverControls: 'filters' },
      { id: 'today-status', target: 'invoice-status-filters', title: 'Situação das notas', content: 'Use os indicadores de situação para mostrar apenas notas pendentes, atribuídas, entregues, devolvidas ou em outros estados operacionais.', placement: 'bottom', required: true, discoverControls: 'actions' },
      { id: 'today-active-filters', target: 'today-active-filters', title: 'Filtros ativos', content: 'Cada filtro aplicado aparece como um marcador. Clique em um marcador para remover somente aquele critério ou use “Limpar filtros” para recomeçar.', placement: 'bottom', required: true, discoverControls: 'actions' },
      { id: 'today-results', target: 'today-results', title: 'Notas encontradas', content: 'Os cartões mostram os dados da nota, cliente, produtos, status e contexto da entrega. As ações disponíveis dependem do estado atual e do seu perfil.', placement: 'top', required: true, discoverControls: 'actions' },
    ],
  },
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
