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
