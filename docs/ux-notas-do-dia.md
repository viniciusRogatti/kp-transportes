# UX operacional — etapa 1: base visual e Notas do dia

Data: 03/10/2026. Escopo: implementação local; não é implantação nem certificação do ambiente produtivo.

## Diagnóstico e decisões

| Evidência observada | Consequência | Implementação nesta etapa |
| --- | --- | --- |
| `TodayInvoices` exibia todos os filtros e uma segunda lista de produtos somente no celular. | Controles extensos antes da conferência e duplicação de informações. | Produto em primeiro lugar no celular; NF/cliente na mesma linha; filtros complementares recolhíveis; uma lista de cards que mostra os itens correspondentes. |
| Estado inicial vazio também era renderizado durante carregamento/falha. | Falha de rede podia parecer ausência de notas. | Estados exclusivos de carregamento, erro com nova tentativa e vazio. Falha de viagens/contexto mantém a consulta e recebe aviso próprio. |
| Filtros eram apenas estado do componente. | Ao voltar da jornada, a busca e a posição eram perdidas. | Preferências e rolagem em `sessionStorage`, versionadas por usuário, empresa da sessão e perfil, válidas no mesmo dia de São Paulo. Não armazena NFs, comprovantes ou token. |
| Cards usavam barcode ou NF como chave. | NFs homônimas sem barcode podiam compartilhar o estado de detalhes. | Chave composta por empresa, NF e barcode; testes com NF igual em empresas diferentes. |
| Card denso, letra pequena, faces ocultadas apenas por transformação 3D. | Dificuldade de toque/leitura; teclado podia alcançar conteúdo do verso. | Modo de conferência opt-in, quantidade/unidade legíveis, controles de 44px, faces com visibilidade explícita e foco de retorno. |
| Impressão aguardava três segundos antes de abrir janela. | Bloqueio de pop-up e perda do contexto visual da lista. | Janela aberta no gesto do usuário, lista preservada durante geração, erro recuperável e trava de requisição em andamento. |
| Ações dos cards dependiam só do estado assíncrono do botão. | Reentrada no mesmo instante podia enviar outra requisição. | Travas síncronas nas ações de atribuição, status, refaturamento e PDF; seleção mantida após falha. Não equivale à idempotência no servidor. |

Hipóteses a validar com operadores: tempo para localizar produto, preferência entre código e descrição e utilidade da prévia de carga recolhida. Não houve entrevista nem medição em produção. A busca não diagnostica inversão de mercadoria.

## Linguagem visual reutilizável

- `components/ui/Workspace.tsx`: cabeçalho com título/explicação/ações, botões primário/secundário e estados de consulta.
- `style/invoiceWorkspace.css`: ritmo baseado em 4px, controles de 44px, campos com 16px no celular, superfícies sólidas e contraste dos temas existentes. Azul identifica ação; status preservam as cores e os textos operacionais existentes.
- Tipografia existente: Inter no conteúdo e Plus Jakarta Sans nos títulos, com fallback sans-serif. Sem nova biblioteca de UI.
- Filtros têm rótulos persistentes, indicador de seleção, remoção individual e limpeza completa. Recolher controles não desativa seus filtros.
- Cards de conferência usam empresa, carga, NF, cliente/cidade, motorista/status, itens e peso. Quantidades mantêm unidades por item; não soma KG e CX como se fossem UN. Nome longo fica completo nos detalhes.
- `useDialogFocus`: foco dentro dos diálogos, bloqueio de rolagem de fundo e retorno ao acionador. O menu móvel fechado deixa de expor seus links à navegação por teclado.
- Mudanças de apresentação dos cards são opt-in em Notas do dia. Correções de identidade, acessibilidade e proteção de envio também beneficiam consumidores existentes do componente.

## Contratos preservados

1. `GET /danfes?operationDate=...` → `DanfesController` → `DanfesService.getTodayDanfes` → escopo autorizado, `Danfe`/produtos/cliente.
2. `GET /trips/search/date/:date` e `POST /danfes/search-context` → motorista/histórico por empresa e NF; falhas não representam zero pendências.
3. `PUT /trips/add-note/:id` permanece com empresa, número da NF, cliente, peso e caixas. O backend continua responsável por autorização, concorrência e bloqueio de notas entregues/vínculos incompatíveis. A trava da interface não substitui essas regras.
4. Status e refaturamento usam os endpoints e perfis existentes. Não foi criada permissão nova.
5. PDF usa `groupTodayInvoiceProducts` e inclui **todos os itens das notas filtradas**, mesmo quando o card está exibindo apenas os produtos pesquisados. Aviso explícito junto à busca de produto. Não foi alterada a impressão operacional.
6. Bot: foto + dígitos contínuos da NF, grupo/empresa e momento da importação permanecem inalterados. Nenhuma comunicação real foi disparada.

## Dependências operacionais e próximas etapas

- **Datas:** `backend/src/domain/operationDate.js` usa emissão D para operação D+1. O relato de notas recebidas no sábado destinadas à segunda não está completamente representado por essa regra. Não foi alterado nem “corrigido” por inferência visual.
- **Devolução:** `ReturnsOccurrences` já separa transporte, NF, seleção de itens, revisão e lote; remove notas em edição via `DELETE /returns/notes/:id`, confirma envio e recebimento em endpoints distintos. Esses processos não comprovam o significado de “desapreciação de um lote”. A expressão não foi localizada e requer exemplo da ação/tela antes de alterar sua lógica ou nome. Preservar limites por item, tipo total/parcial, estoque/faltante e bloqueio de lotes enviados. Há alterações anteriores do usuário nesses arquivos, preservadas.
- **Ocorrências:** criação sem chave de idempotência no backend e sem trava de envio no formulário de devoluções, conforme inspeção anterior. As travas desta etapa são dos cards de NF; não corrigem a criação de ocorrências nem limpam duplicidades históricas.
- **Monitoramento:** manter status informado separado de localização recebida e indicadores calculados. Sem mudanças nessa página nesta etapa.
- **Roteirização:** preservar prévia versus viagem efetiva e validações em `TripsService`; próxima etapa deve tornar transferência de notas e troca de motorista mais claras sem automatizar remoção de vínculos em andamento.
- Pendências antigas, cancelamento da importação e arquivamento do banco não fazem parte desta alteração visual.

## Identidade visual versus isolamento entre transportadoras

`src/config/brand.ts` centraliza nome, abreviação, wordmark, frase e logo opcionais por implantação, consumidos pelo login, menu e título do navegador. Variáveis opcionais: `REACT_APP_BRAND_NAME`, `REACT_APP_BRAND_SHORT_NAME`, `REACT_APP_BRAND_WORDMARK`, `REACT_APP_BRAND_TAGLINE`, `REACT_APP_BRAND_LOGO_URL`. Nenhuma configuração de sessão é usada para trocar a identidade comercial.

As abas/filtros de empresa representam **empresas atendidas pela KP**, não isolamento entre transportadoras. A personalização não autoriza compartilhar uma base entre clientes independentes. Antes disso, auditar identidade da transportadora em todas as tabelas/endpoints/jobs, usuários e permissões, índices e cache, storage e URLs de arquivos, grupos do WhatsApp/segredos/filas, configurações e catálogo de rotas, exportações, backups e restauração. Imagens de login, favicon, PDFs e textos de módulos legados ainda precisam de inventário para uma personalização visual completa.

## Verificação reproduzível

Testes do frontend usam axios/PDF/autenticação simulados; não iniciam backend real:

```sh
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/pages/__tests__/TodayInvoices.workspace.test.tsx src/components/__tests__/CardDanfes.test.tsx src/components/invoices/__tests__/InvoiceFilters.test.tsx src/utils/__tests__/danfeFilters.test.ts src/utils/__tests__/todayInvoiceProducts.test.ts src/utils/__tests__/todayInvoiceQuickSearch.test.ts
./node_modules/.bin/tsc --noEmit
npm run build
```

Prévia: `node scripts/ux-preview-api.cjs` cria uma API exclusivamente em memória em 127.0.0.1:4317. Usa somente o pacote Socket.IO já instalado no backend, sem carregar seus serviços/configurações. Frontend: `BROWSER=none HOST=127.0.0.1 PORT=3100 REACT_APP_API_URL=http://127.0.0.1:4317 npm start`. **Não iniciar o backend produtivo para esta prévia.**

Fixtures: 300 NFs, três empresas, NFs homônimas, nomes longos, KG/CX, peso ausente, listas de 20 produtos; 01/01/2026 retorna vazio e 02/01/2026 simula erro. A inclusão em viagem retorna falha proposital para conferir a preservação do preenchimento. Uma sessão de navegador isolada usa token sintético, perfil admin fictício e login `ux-preview`.

`scripts/verify-invoice-workspace.cjs <CDP_URL>` conecta ao navegador isolado iniciado com agent-browser; requer Node 20+ e Playwright disponível pelo módulo local ou `PLAYWRIGHT_MODULE`. Verifica larguras 360/390/768/1440 nos dois temas, ausência de overflow horizontal, filtro por produto/empresa/cidade, retorno dos detalhes/jornada, falha de atribuição e estados vazio/erro. Capturas são geradas em `/tmp/kp-notas-*.png`. Os resultados efetivamente executados devem acompanhar a entrega; a presença do roteiro não comprova seu sucesso.

### Resultado executado nesta entrega

- 26 testes passaram em seis suítes; TypeScript sem erros.
- Build de produção concluído; aviso preexistente de `ArrowRight` não utilizado em `Home.tsx`.
- ESLint passou nos arquivos de implementação alterados e na nova suíte de Notas do dia. A suíte antiga `CardDanfes.test.tsx` possui cinco violações preexistentes em linhas não modificadas (uso de `act` e múltiplas asserções em `waitFor`).
- Roteiro de navegador concluído: oito combinações de tema/largura sem overflow, conferência de produto/empresa/cidade, detalhes, falha de atribuição com seleção preservada, retorno da jornada com filtros/rolagem restaurados, vazio, erro e recuperação.
- Nenhum erro JavaScript nem requisição Railway/Hetzner durante o roteiro. A jornada usou resposta fictícia indisponível para testar o retorno; não certifica os dados ou o conteúdo da jornada real.
- PDF verificado por testes automatizados com gerador simulado; impressão física e uso em aparelhos reais ainda exigem homologação operacional.
- Sem publicação, migração, limpeza de dados ou alteração das integrações produtivas.

## Refinamento de cards e inputs — 03/10/2026

- Alterações restritas ao modo conferência de Notas do dia: número da NF destacado, emissão identificada, motorista sem competir com o status operacional, cidade/UF, última rota explicitamente nomeada, quantidade/unidade e peso bruto com hierarquia própria.
- Nome completo do cliente visível; cards crescem com o conteúdo, preservando rolagem local dos produtos e acesso aos detalhes. Dados ausentes não viram valores fictícios.
- Data, empresa e buscas agrupadas em uma linha em telas largas; produto em largura inteira no celular. Campos com ícone, foco visível, textos curtos e limpeza individual que devolve o foco à busca e preserva os outros filtros. Demais consumidores de `InvoiceFilters` mantêm o modo não progressivo.
- Revisão React manteve estado derivado e atualizações funcionais, sem dependências novas ou alterações nos contratos/permissões.
- 20 testes de `CardDanfes` e `TodayInvoices.workspace` aprovados, incluindo limpeza individual/foco e rótulos. TypeScript e lint dos arquivos alterados aprovados. Compilação de desenvolvimento com aviso preexistente em `Home.tsx` (ArrowRight).
- API sintética com 300 notas: conferência em 360/390/768/1440 px, claro/escuro, sem overflow horizontal da página. Busca por produto/limpeza verificadas; verso do card acionado também via DOM para conferir sua renderização. Nenhum erro JavaScript observado. Não equivale a teste de toque/teclado virtual em aparelho físico.
- Sem novo build de produção, alteração de backend, commit ou deploy nesta revisão visual.

## Compactação adicional dos cards — 03/10/2026

- Cabeçalho e rodapé mais compactos: emissão em linha, menos espaçamento, peso bruto em linha e contagem de produtos sem repetição no rodapé.
- Produtos em duas colunas: descrição completa e código agrupados à esquerda, quantidade/unidade à direita. O rótulo de quantidade permanece para leitores de tela, sem repetição visual em cada produto.
- Área dos produtos ampliada de 160–210 px para 240–280 px, com rolagem e acesso à lista completa preservados. Alteração exclusiva do modo conferência.
- 20 testes aprovados, incluindo regressão do agrupamento de descrição/código e unidade; TypeScript e lint aprovados. Prévia isolada com 300 notas: inspeção visual em desktop/celular e tema claro, sem overflow de produtos em 360/768 px; abertura da lista completa e fechamento por Escape conferidos. Consultas de NFs/viagens somente na API fictícia local, sem erros JavaScript observados.
- Nenhuma alteração de backend, banco ou publicação. Homologação em aparelho físico continua pendente; a validação utilizou larguras simuladas no navegador.

### Motorista na primeira linha — 03/10/2026

- Empresa e carga em 10 px, motorista central em 11 px; eliminada a linha exclusiva do motorista. Textos longos quebram dentro de suas colunas.
- Sem motorista: somente ícone de atribuição no topo, com nome acessível e tooltip. As condições existentes de atribuição continuam valendo; indisponibilidade da ação, carregamento e erro de consulta não viram uma ação habilitada indevidamente.
- Testes focados cobrem motorista no topo, ausência por ícone, erro explícito e abertura/segurança da atribuição. Esta última alteração ainda não teve nova conferência visual no navegador; não confundir com as capturas da revisão anterior.

### Lista completa de produtos — 03/10/2026

- Pop-up ampliado para até 860 px, com empresa, NF, cliente e cidade hierarquizados; tabela sem truncar descrições, quantidade/unidade à direita, código em coluna no desktop e abaixo da descrição no celular.
- Cabeçalho da tabela fixo durante a rolagem, rodapé com total de itens sem somar unidades incompatíveis. Foco e fechamento existentes preservados; sem consultas adicionais ou novas dependências.
- Navegador com API fictícia: 20 produtos em 1440/360 px, tema escuro e claro no celular, rolagem até o último item sem overflow horizontal. Escape fecha a lista. Teste de componente confere tabela, descrições, unidades e fechamento.
