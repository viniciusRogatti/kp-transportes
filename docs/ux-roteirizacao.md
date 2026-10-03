# Roteirização — etapa 4 de UX

Implementação local em 03/10/2026. Sem publicação, migrações, banco ou bot reais.

## Diagnóstico e entrega

Escopo: prévia aberta em **Viagens → Editar rota**, preservando a roteirização principal e suas regras de foco, bipagem, ordenação, segunda saída e salvamento.

- A remoção na prévia comparava apenas o número da NF. Agora usa empresa + número, como a sincronização já utilizava. Teste com duas NFs homônimas confirma que só a empresa escolhida é retirada.
- Cabeçalho identifica motorista, data, placa e saída. Resumo mostra total na prévia, inclusões e retiradas; cada nota distingue vínculo existente de inclusão ainda não salva.
- Incluir/retirar gera feedback local; fechar/cancelar explicita o descarte da prévia, mantendo o modo edição da roteirização. Nenhuma dessas ações locais grava por si só.
- Clientes longos não são truncados na prévia. Empresa e status permanecem visíveis. Botões/campos principais têm pelo menos 44px; rodapé mantém ações e erro acessíveis durante a rolagem.
- Busca recebe nome acessível e mensagem para resultado vazio. Contenção de foco usa o hook existente, com retorno ao contexto ao fechar.
- Bloqueio síncrono por referência e controles desabilitados impedem reenvio/interferência enquanto esta prévia está salvando. Falha mantém preenchimento e alerta sobre possível aplicação parcial.
- Sucesso atualiza também o rascunho da roteirização com a viagem retornada. Falha posterior ao atualizar listas não é apresentada como falha de gravação.

## Regras e limites

Consultadas regras operacionais, ambientes, cadastros/viagens e roteirização planejada. Mantidos backlog de pendências, validação de caixas PRONTO e bloqueios existentes para notas em andamento/finalizadas. Não foi criada transferência automática entre viagens, nova permissão ou mudança nos contratos da API/bot.

O salvamento existente (`syncTripNotesInPlace`) usa várias requisições para status, remoção, inclusão, caixas e ordem. **Não é uma transação única**. A proteção contra duplo clique desta etapa não garante idempotência no servidor, nem protege de duas abas/usuários. Após uma falha parcial, é necessário conferir/reabrir a viagem antes de repetir a edição. Isso exige evolução específica do backend.

Achado adicional para revisão prioritária: em `backend/src/services/TripsService.js`, `removeNoteFromTrip` obtém a empresa do ator, mas a consulta da nota utiliza apenas `id`/`trip_id` e não valida o status antes de destruí-la. O controlador verifica permissão, mas isso não comprova isolamento da viagem nem bloqueio operacional nessa operação. Não foi alterado silenciosamente nesta etapa visual; o bloqueio da interface não substitui essas garantias no backend.

Não houve auditoria completa dos outros diálogos, PDF, troca de motorista ou remoção/exclusão de viagens. Integração real, concorrência, sessão expirada e comportamento com teclado virtual físico precisam de homologação separada.

## Validação

- **24 testes aprovados**: `RoutePlanning.autocomplete`, `routePlanningRules` e `TripSearchControls`. Incluem identidade por empresa, nota entregue bloqueada, inclusão/retirada local, busca vazia, salvamento repetido, falha com preenchimento preservado e sucesso seguido de falha ao atualizar listas.
- TypeScript, ESLint dos dois arquivos TSX alterados, `git diff --check` e compilação de desenvolvimento aprovados. Build de produção não repetido.
- Navegador com API fictícia em memória: 300 NFs, 30 vinculadas, 135 disponíveis no cenário inicial, números repetidos entre empresas e nomes extensos. Modo da fixture: `UX_ROUTING=true node scripts/ux-preview-api.cjs`.
- Larguras 360, 390, 768 e 1440px sem overflow horizontal da página/prévia; botões da prévia medidos com altura mínima de 44px. Inspeção visual em tema escuro nas quatro larguras e tema claro no desktop/celular.
- No navegador, retirada de uma NF manteve as homônimas; reinclusão acionou validação de caixas; falha da API fictícia preservou 29 notas e uma retirada pendente, com aviso visível no rodapé móvel. Nenhum erro JavaScript observado; consultas e tentativas de escrita de NFs/viagens ficaram em `127.0.0.1:4317`.
- Testes simulados não certificam persistência produtiva. Nenhuma nota real foi modificada, nenhum commit/push/deploy realizado.

## Continuação: reforço da retirada no backend

Em 03/10/2026, a autorização e a retirada de notas foram reforçadas em `backend/src/services/TripsService.js`. A retirada em grupo agora valida as paradas e atualiza vínculo/status/ordem/peso/auditoria na mesma transação; o frontend não reseta mais status separadamente. O achado acima sobre `removeNoteFromTrip` foi tratado nesse escopo. Detalhes, limites, falha legada de teste e ordem proposta de publicação estão em `backend/docs/roteirizacao-remocao-segura.md`.

Próxima prioridade proposta: transação única para **toda** a edição (incluindo inclusões, caixas, ordem e motorista), seguida de homologação operacional controlada. Isso ainda não foi implementado; não confundir a atomicidade da retirada em grupo com a edição completa.
