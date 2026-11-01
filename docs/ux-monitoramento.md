# Monitoramento — etapa 3 de UX

Implementação local em 03/10/2026. Sem publicação, banco, notificações ou WhatsApp reais.

## Entrega

- Falha de consulta agora tem aviso visível, sem apresentar ausência de entregas como resultado. Atualizar permite tentar novamente.
- Falha de atualização da mesma data mantém a última consulta identificada como possivelmente desatualizada. Troca de data limpa os dados anteriores. Resposta com data incompatível ou listas inválidas é rejeitada.
- Falha do diagnóstico auxiliar de endereços não descarta as entregas; recebe aviso próprio.
- Indicadores móveis mostram traço antes de existir uma consulta válida. Progresso é identificado como finalização na rota, não taxa de entregas comprovadas. Quantidade de viagens não é chamada de quantidade de motoristas únicos.
- Resumo de reentregas, canhotos retidos, fotos pendentes e devoluções/cancelamentos por viagem usa os mesmos classificadores das paradas existentes; não cria uma regra nova de vencimento ou conclusão.
- Detalhe e lista distinguem status operacional informado de etapa calculada. Exemplo: uma reentrega pode permanecer na etapa calculada Atribuída, mas seu status REENTREGA fica explícito.
- Controles de parada têm 44px no celular, mantendo a faixa rolável dentro do cartão. Nome do cliente ocupa uma linha própria no detalhe móvel para não comprimir as palavras.
- Cabeçalho com superfície sólida, instrução do recorte dos indicadores e legenda de posição recebida, sem promessa de GPS ao vivo. Chaves da tabela incluem empresa/viagem/sequência/NF.

## Regras preservadas e limites

Consultados `docs/monitoramento-e-fechamento.md`, `DeliveryMonitoringService` e os contratos do componente. Não houve alteração de API ou cálculo de etapa. `completed` representa finalização e inclui devolução/cancelamento/retenção segundo o classificador existente; não equivale a entregue. O filtro de etapa continua refinando lista/mapa, enquanto progresso e indicadores mantêm o recorte de empresa/data/viagem explicado na tela.

As ações manuais continuam usando os endpoints, perfis e confirmações existentes. A atualização do canhoto, as restrições de refaturamento e de outra viagem ativa não foram modificadas. Não houve envio de lembretes/push nem criação de localização fictícia apresentada como real.

Mapas usam a identidade e adaptação existentes; a auditoria completa de NFs homônimas nos marcadores e a persistência de filtros/navegação ficam pendentes. Esta etapa não reestrutura todo o módulo nem amplia permissões. Validação operacional com GPS, bot e mapa Google real requer homologação.

## Verificação

- Suíte do Monitoramento ampliada de 8 para 12 casos, com mocks: falha inicial/recuperação, dados desatualizados, diagnóstico independente, resposta inválida e distinção status/etapa.
- Prévia com API exclusivamente sintética em memória: 60 notas em três viagens, NFs homônimas entre empresas, nomes longos, diagnóstico 503 e ausência de posições GPS.
- Conferência em 360, 390, 768 e 1440px, com temas claro/escuro inspecionados, sem overflow horizontal da página. Faixa de paradas tem rolagem local intencional. Aberto detalhe de reentrega sem alterar status; nenhum erro JavaScript observado.
- TypeScript final, compilação de desenvolvimento e lint do componente aprovados. Compilação mantém o aviso preexistente de import não utilizado em `Home.tsx`. Suíte legada tem quatro apontamentos de lint preexistentes em linhas não modificadas. Build de produção não repetido nesta etapa.
- Regressão: 12 testes de Monitoramento e 8 de Notas do dia aprovados. Dos 22 de Devoluções, um excedeu 5s na execução conjunta; a suíte completa passou ao repetir isoladamente com `--testTimeout=15000`. Não houve alteração de asserções para obter aprovação. Testes simulados não certificam backend produtivo nem recebimento de canhotos reais.

Próxima etapa: roteirização e clareza da inclusão/transferência de notas, preservando vínculos e validações de viagem.

## Mapa como foco — 30/10/2026

Após aprovação visual, a página começa com filtros compactos, círculos de motoristas e mapa alto. Contadores/diagnóstico e barras detalhadas ficam abaixo do mapa. `DriverProgressStrip` agrupa saídas por motorista, exibe iniciais/percentual/nome, divide o anel por NF e usa verde somente com finalização completa. Nomes ficam ocultos em larguras menores, com rótulo acessível completo, tooltip e nome da seleção junto do mapa. As consultas/ações operacionais continuam existentes; o padrão inicial de empresa passa a Todas.

Selecionar centraliza sem filtrar ou esmaecer os outros motoristas. O enquadramento simétrico inclui a frota e as entregas; ausência de GPS não é substituída por endereço de cliente. A centralização ocorre na seleção explícita/troca de data, não a cada leitura. Múltiplas saídas usam a posição válida mais recente do motorista; os círculos agregam as NFs das viagens visíveis no recorte.

A API passa a usar 30 cores fixas e expõe `color_order`/`color_slot` por motorista. A ordem vem da primeira atribuição persistida da data, antes dos filtros da página, com os limites históricos descritos nas regras do workspace. Não há migração nem ledger novo de bipagens. Todos os pins do motorista usam sua cor; etapa continua identificada por símbolo, prioridade, legenda e detalhes. A API e o frontend compatíveis precisam ser publicados juntos para disponibilizar a paleta aprovada.

### Validação da implementação de 30/10

- `node scripts/verify-critical.cjs` na raiz, com Node 20.19.5: frontend 158 testes/17 suítes, backend 25 suítes críticas e bot 37 testes passaram. Depois do último ajuste da altura responsiva, as cinco suítes afetadas (43 testes) passaram novamente; TypeScript passou. Repetido o teste isolado da API que confere paleta, compartilhamento da cor por NF/motorista e NFs homônimas entre empresas.
- Build final aprovado, inclusive `postbuild` que confere a chave no artefato. Foi gerado somente em `/tmp/kp-monitoramento-release`, com chave sintética e API `https://example.invalid`; não é artefato publicável. Não substituiu o diretório de build operacional.
- Prévia da página real, com 20 motoristas e 111 NFs fictícias, API/socket/transporte do mapa substituídos por fixtures. Conferência em 1440×1000, 390×844 e 320×700, claro/escuro: sem overflow horizontal; desktop com dez círculos por linha; nomes ocultos e círculos menores no celular; barras detalhadas abaixo da primeira tela; seleção mantém os 20 caminhões e as 111 notas nos marcadores. Nenhum erro de console observado. Mapa de fundo ilustrativo, sem validação do Google Maps publicado ou GPS real.
- A altura usa o espaço restante da janela, com mínimo de 480px no desktop e 360px no celular. `ResizeObserver` acompanha o cabeçalho/seletor e tem limpeza ao desmontar. Em telas pequenas, a altura mínima pode exigir rolagem também para a parte inferior do mapa.
- A tentativa inicial em Node 18 falhou no teste de treinamento por UUID ausente no mock; não foram alterados código nem asserções desse fluxo para aprovar. A execução completa em Node 20.19.5 passou. Uma execução intermediária foi interrompida por SIGTERM; a repetição final concluiu frontend, API e bot.
- Sem migração, mensagem, commit ou publicação. Fonte da paleta e metadados exigem publicar a API compatível junto do frontend. Não houve conferência autenticada do ambiente produtivo.

Na revisão da paleta, a etapa “Entregue, foto pendente” passou a usar ícone de documento/relógio, distinguindo-a do check de finalização mesmo quando ambos pertencem ao mesmo motorista. Cor continua identificando motorista; conferência documental permanece própria. ESLint dos cinco módulos de implementação alterados passou sem erros ou avisos.

Repetição final após o ajuste do ícone documental: comando crítico conjunto concluído (158 testes do frontend, 25 suítes da API, 37 testes do bot) e `npm run build` concluído com código zero, incluindo `postbuild` e a conferência da chave sintética no artefato. A inspeção adicional em 768px manteve dez colunas sem overflow. Evidências da prévia foram salvas como `monitoramento-desktop-implementado.png`, `monitoramento-mobile-implementado.png` e `monitoramento-escuro-implementado.png` no diretório de visualizações da sessão.
## Correção da configuração local e compatibilidade da paleta — 30/10/2026

Após o relato de mapa ausente, confirmado que a chave existia apenas em `.env.production.local`; o CRA não carrega esse arquivo no desenvolvimento. A chave existente foi configurada também em `.env.development.local` (ignorado pelo Git), sem alterar as demais variáveis. Frontend local reiniciado. O Google Maps real carregou em `http://localhost:3000/kp-transportes/`, usando uma página temporária dos componentes reais com posições fictícias; a porta temporária 8102 foi recusada por restrição de referenciador, preservada. Não foram alteradas permissões da chave.

O frontend agora normaliza a resposta completa com os 30 tons aprovados, aplicando a mesma cor a viagens, entregas e posições recebidas antes dos filtros visuais. `color_order` da API nova é prioritário. Na API antiga, sem ordem/horário de atribuição, usa a primeira viagem por ID como alternativa determinística; isso não comprova a ordem das bipagens. Confirmar a bipagem real continua dependendo da API nova. Viagem concluída continua com anel verde.

Validação desta correção: 160 testes críticos em 18 suítes, TypeScript, lint dos módulos alterados e compilação de desenvolvimento passaram. Google Maps real inspecionado, seleção de um motorista preservando os outros dois marcadores sintéticos. Página temporária removida depois da conferência. Sem consulta/mutação de dados operacionais, commit ou publicação.

## Proporção dos marcadores e contraste — 30/10/2026

Após os novos prints, reduzido o caminhão de 34–45 px para 20–26 px conforme o zoom (20 até 10; 22 até 12; 24 até 14; 26 acima). Pins comuns passam a 11–20 px, com mínimo de 10 px para resultados e prioridade proporcional para destinos ativos. O estado de zoom é atualizado pelo próprio evento do Google Maps, inclusive sem callback do componente pai.

No mapa afastado, nomes ficam visíveis apenas para motorista selecionado ou com detalhes abertos; a partir do zoom 13, nomes de todos voltam em etiquetas compactas. Título, identificação acessível e abertura por teclado permanecem. Removida ampliação/deslocamento do marcador selecionado no modo compacto, preservando a âncora central do caminhão. Sombras e etiquetas menores deixam a cartografia mais visível. Coordenadas, precisão e eventos operacionais não foram alterados.

Mantidas as dez cores-base; substituídas as vinte variações por tons escolhidos com maior distância em Lab, alinhados no frontend e backend. Opacidade dos resultados com motorista sobe de 45% para 65% para reduzir a mistura com o fundo, ainda com tamanho/camada inferiores às entregas pendentes. Ordem e regras de atribuição das cores permanecem.

Validação: 163 testes críticos do frontend/19 suítes, TypeScript, lint dos quatro módulos de implementação e oito casos focados do serviço de monitoramento passaram. Inspeção do Google Maps real com 390 entregas e dois veículos fictícios nos zooms 8, 9 e 13: caminhões medidos em 20/24 px, mantendo 390 entregas e dois veículos renderizados após seleção/zoom. Compilação de desenvolvimento sem erros. Sem publicação ou alteração de dados operacionais.

## Identificação na torre de controle — 01/11/2026

A proposta de códigos numéricos desta etapa foi rejeitada pelo responsável e substituída pelo ajuste de nomes permanentes descrito abaixo.

Refinamento local solicitado pelo responsável, preservando progresso compacto acima do mapa e detalhamento abaixo. Cada motorista tem um código visual curto e sua cor junto do nome, mantidos mesmo quando o anel de finalização fica verde. O código usa a ordem de cores já normalizada na resposta completa, antes dos filtros; não é ID operacional, prioridade ou comprovação da ordem de bipagem.

Na visão regional (zoom até 10), o veículo usa um círculo de 20 px com o código. Ao aproximar, reaparece o caminhão de 22–26 px com o mesmo código; nomes continuam nos detalhes/seleção e a partir do zoom 13. Marcadores permanecem nas coordenadas recebidas. Selecionar mantém a frota; “Aproximar motorista” leva explicitamente ao ponto recebido com zoom mínimo 14. Atualizações de posição não repetem a aproximação. “Limpar seleção” volta à visão geral e encerra os detalhes do motorista. Nenhum endereço de entrega substitui GPS ausente.

O mapa mostra cobertura de posições recebidas sobre motoristas únicos do recorte. A seleção exibe nome, cor, código e horário da última posição, sem prometer GPS ao vivo. A grade acomoda até 24 motoristas em duas linhas quando há largura suficiente; tablet/celular usam duas linhas com rolagem lateral local, mantendo nomes e foco por teclado.

Validação: 35 testes focados em cinco suítes passaram, cobrindo identidade após conclusão/filtros, mesma identidade no adaptador, níveis de zoom, aproximação explícita, ausência de GPS, preservação da frota e limpeza da seleção. TypeScript e ESLint dos módulos de implementação passaram. A suíte mantém avisos preexistentes do React `act`. Conferida a página real no Google Maps com API/socket interceptados no navegador: 24 motoristas fictícios, 20 posições e 312 notas, incluindo veículos próximos e cenário sem GPS. Sem erros JavaScript e sem overflow horizontal da página em 1440, 768, 390 e 320 px. Temas claro/escuro e aproximação em zoom 14 inspecionados. Veículos no mesmo ponto ainda podem se sobrepor; a faixa superior permite escolher cada motorista e aproximar, sem deslocar coordenadas artificialmente.

Não houve alteração de backend, dados operacionais, mensagens, commit ou deploy. As fixtures são externas ao código da aplicação; não há modo de simulação ativado para os usuários. A validação não comprova ingestão de GPS real nem integração produtiva.


## Primeiro nome permanente e tamanho conforme o zoom — 01/11/2026

Decisão explícita do responsável: retirar os códigos numéricos, manter sempre o primeiro nome no mapa e adaptar ícone/etiqueta ao zoom. A referência por número exigia voltar à faixa de motoristas e foi rejeitada. O caminhão agora permanece em todos os níveis, variando de 16 a 26 px; a fonte do primeiro nome varia de 10 a 12 px. Etiquetas claras, borda na cor do motorista e seleção escura mantêm o contraste sobre o mapa. Nome completo permanece no título acessível, tooltip e detalhes.

Etiquetas próximas são distribuídas nas duas direções, evitando sobreposição entre nomes e com os ícones dos veículos. Linhas conectam etiquetas deslocadas ao ponto original; somente as etiquetas mudam de lugar, preservando as coordenadas dos caminhões. Essa distribuição não conhece os rótulos internos de cidades do Google: reduz a área ocupada, mas não promete eliminar todo cruzamento com a cartografia. Primeiros nomes iguais continuam distinguíveis pela cor e pelo nome completo nos detalhes. A faixa de progresso mantém um ponto de cor junto do nome mesmo com o anel verde, sem código numérico.

Validação local com a página e o Google Maps reais, usando somente API e sockets simulados: 24 motoristas, 20 posições e 312 NFs fictícias. As 20 etiquetas permaneceram visíveis, sem colisão entre seus retângulos na visão regional inspecionada; aproximação em zoom 14, temas claro/escuro, larguras 1440/768/390/320 e ausência de GPS conferidos. Sem erro JavaScript ou overflow horizontal da página. As etiquetas continuam clicáveis e os controles preservam navegação por teclado.

Os 36 testes focados em cinco suítes passaram; TypeScript e ESLint dos módulos alterados também passaram. Os casos cobrem permanência do primeiro nome e do caminhão em zoom distante/próximo, alteração proporcional de tamanho, 24 veículos na mesma coordenada em zooms 4/8/10/13/16/20 e preservação de posições/seleção. Nenhum dado operacional, backend, commit ou publicação foi alterado; recebimento de GPS real permanece fora desta validação.
