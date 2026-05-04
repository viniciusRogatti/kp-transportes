# KP Transportes - Frontend

Aplicacao web da operacao KP Transportes. O painel concentra busca de notas, roteirizacao, devolucoes, ocorrencias, canhotos, monitoramento de entregas, alertas e fluxos administrativos.

## Stack
- React 18 + TypeScript
- React Router DOM com `HashRouter`
- TanStack Query
- Tailwind CSS + componentes internos
- Axios
- ECharts
- Google Maps JavaScript API
- React PDF Renderer
- Socket.io Client

## Perfis e escopo
- Perfis internos: `admin`, `master`, `expedicao`, `conferente`
- Perfil operacional basico: `user`
- Perfil de torre: `control_tower`
- No frontend, os perfis internos operam em modo multiempresa.
- O perfil `control_tower` segue com leitura e contexto por empresa na torre.

## Rotas principais
- `/`: login
- `/home`: painel operacional da transportadora
- `/todayInvoices`: notas do dia
- `/invoices`: pesquisa historica de notas
- `/products`: consulta de produtos
- `/customers`: consulta de clientes
- `/routePlanning`: roteirizacao e manutencao de rotas
- `/delivery-monitoring`: monitoramento de entregas em mapa
- `/returns-occurrences`: devolucoes, sobras, lotes e ocorrencias
- `/receipts`: acompanhamento de canhotos e atividade do WhatsApp
- `/operational-pendencies`: backlog operacional de canhotos e entregas
- `/alerts`: alertas operacionais
- `/uploadFiles`: importacao de XML
- `/users`: gestao de usuarios
- `/user-sessions`: historico e analytics de sessoes
- `/control-tower/coletas`: painel da torre de controle

## Modulos da interface

### Login e sessao
- Login com JWT.
- Verificacao de token ao entrar em paginas protegidas.
- Integracao opcional com Turnstile ou reCAPTCHA.
- Logout com encerramento de sessao no backend.

### Header, navegacao e notificacoes
- Navegacao lateral responsiva por permissao.
- Busca rapida por NF no topo.
- Notificacoes em tempo real com fallback para polling.
- Indicacao visual de perfil, empresa e modo de escopo.

### Notas e cadastro operacional
- `TodayInvoices`: leitura rapida das DANFEs do dia com filtros por NF, cliente, produto, cidade e rota.
- `Invoices`: pesquisa historica de DANFEs por NF e periodo, com detalhes, ocorrencias e contexto de refaturamento.
- `Products`: listagem de produtos com filtros por codigo e descricao.
- `Customers`: consulta de clientes.
- `FileUploadPage`: fila de importacao de XML com relatorio consolidado, erros por arquivo e lista de produtos novos/atualizados.

### Roteirizacao
- `RoutePlanning`: cria e edita rotas, adiciona notas por NF/codigo de barras, reordena paradas, troca motorista/veiculo e remove notas.
- Fluxo de validacao de conflito de atribuicao de motorista e veiculo.
- O sistema acusa conflito operacional antes de salvar quando motorista ou veiculo ja estao ocupados em outra rota ativa.
- Exportacao de TXT, PDF de produtos e PDF de entregas.
- Exclusao de rotas pela propria tela.
- Existe tambem uma implementacao auxiliar em `Trips.tsx`, mas a navegacao principal de rotas/viagens hoje passa por `RoutePlanning`.

### Devolucoes, ocorrencias e coletas
- `Home`: painel da transportadora para ocorrencias pendentes e coletas em andamento.
- `ReturnsOccurrences`: controla lotes de devolucao, sobras, faltas, envio/recebimento, historico e ocorrencias relacionadas.
- O cadastro de devolucao parcial/coleta controla a quantidade maxima disponivel por produto dentro da NF e impede exceder o saldo restante.
- O fluxo considera lotes confirmados anteriores para bloquear devolucao duplicada ou NF ja totalmente devolvida.
- Ha tratamento especifico para sobra por inversao, com distribuicao da sobra entre NFs relacionadas e validacao do total distribuido.
- O lote segue uma esteira operacional real: pendente da transportadora, aguardando torre e finalizado.
- Depois da confirmacao de envio para a torre, o lote deixa de ser editavel na interface.
- `ControlTowerCollections`: dashboard da torre com KPIs, graficos, fila de acao, pendencias de credito e acompanhamento de coletas.

### Canhotos e backlog operacional
- `Receipts`: acompanha sucessos, revisoes e erros do pipeline de canhotos, inclusive atividade do WhatsApp.
- Upload manual de imagem de canhoto com pre-processamento no cliente.
- Marcacao de revisao manual em recibos.
- `OperationalPendencies`: backlog operacional por fila (`pending`, `retained`, `returned`, `cancelled`, `unassigned`) com upload corretivo de canhoto.
- O backlog cruza status operacional da NF, atribuicao de rota/motorista e evidencia de canhoto para separar gargalos reais da operacao.

### Monitoramento e alertas
- `DeliveryMonitoring`: visao operacional em Google Maps com motoristas, entregas, estagios da rota, alertas e acao manual sobre status da parada.
- `Alerts`: lista de alertas operacionais abertos, leitura local por visualizacao e resolucao manual.
- O monitoramento mistura mapa, eventos de tracking e regras de atraso/inatividade para destacar risco operacional antes da baixa final da entrega.

### Administracao
- `UserManagement`: cadastro de usuarios por `admin` e `master`.
- `UserSessions`: historico de login/logout, filtros por usuario/grupo e analytics de interacao, exclusivo de `master`.

## Integracoes com backend
- REST via Axios com `Authorization: Bearer`.
- Socket.io para notificacoes e atualizacao de localizacao.
- Endpoints usados pela UI incluem, entre outros:
  - `/login`
  - `/danfes`
  - `/trips`
  - `/upload`
  - `/products`
  - `/customers`
  - `/returns`
  - `/occurrences`
  - `/collection-requests`
  - `/api/receipts`
  - `/api/alerts`
  - `/api/delivery-monitoring`
  - `/api/notifications`
  - `/users`

## Variaveis de ambiente

### Human verification
Crie `frontend/.env` com uma das chaves abaixo se o login exigir CAPTCHA:

```bash
REACT_APP_TURNSTILE_SITE_KEY=...
# ou
REACT_APP_RECAPTCHA_SITE_KEY=...
```

### Google Maps
Para `DeliveryMonitoring`, configure:

```bash
REACT_APP_GOOGLE_MAPS_API_KEY=...
# opcional em ambientes que tambem exponham Vite-style env:
VITE_GOOGLE_MAPS_API_KEY=...
```

## Execucao local
```bash
npm install
npm start
```

Aplicacao local: `http://localhost:3000`

## Scripts
- `npm start`
- `npm run build`
- `npm test`
- `npm run deploy`

## Build e deploy
- O projeto usa `HashRouter`, entao o deploy estatico nao depende de rewrite no servidor.
- O `homepage` do `package.json` define o path publico usado no build.

## Observacoes
- O app possui refresh automatico de versao para evitar sessao antiga carregando bundle desatualizado.
- O frontend depende do backend para autenticacao, escopo de dados, notificacoes, upload de XML e pipeline de canhotos.
- Parte importante do valor do sistema esta nas regras operacionais refletidas na UI, especialmente em devolucoes, conflitos de roteirizacao, backlog de canhotos e monitoramento assistido por alertas.
