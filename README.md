# KP Transportes - Frontend

Aplicacao web para operacao de transporte e distribuicao, com foco em DANFEs, roteirizacao, devolucoes, ocorrencias e operacao da torre de controle.

## Stack
- React 18 + TypeScript
- React Router DOM (`HashRouter`)
- Tailwind CSS + componentes utilitarios internos
- Axios
- TanStack Query
- TanStack Table
- Date-fns
- React PDF Renderer

## Perfis e acesso
- Perfis internos: `admin`, `user`, `master`, `expedicao`
- Perfil torre: `control_tower`
- Rotas protegidas por permissao no `App.tsx`
- Se o token for invalido/ausente, o usuario volta para `/`

## Modulos principais

### Login e seguranca
- Login com validacao de token.
- Integracao opcional com Human Verification (Turnstile ou reCAPTCHA).

### Upload de XML (`/uploadFiles`)
- Importacao de XMLs de notas para alimentar base de clientes, produtos e DANFEs.
- Fila de upload e feedback de sucesso/erro na interface.

### Notas do dia (`/todayInvoices`)
- Lista de DANFEs do dia.
- Filtros por NF, produto, cliente, cidade e rota.
- Exportacao/abertura de lista de produtos em PDF.
- Cards responsivos com suporte mobile.
- Lista de produtos dentro do card com scroll vertical no mobile.

### Pesquisa de notas (`/invoices`)
- Busca por NF e por periodo.
- Busca rapida via header (atalho por NF).
- Filtros por NF, produto, cliente, cidade e rota.

### Roteirizacao (`/routePlanning`)
- Selecao de motorista e veiculo.
- Adicao de nota por NF ou codigo de barras.
- Reordenacao/remocao de notas.
- Persistencia da viagem e atualizacao de status das notas.

### Viagens (`/trips`)
- Consulta e visualizacao de viagens.
- Exportacao de lista de produtos/roteiro em PDF.

### Home operacional (`/home`)
- Painel de ocorrencias pendentes.
- Fluxo de edicao, exclusao e resolucao de ocorrencias.
- Historico de ocorrencia (perfil admin).
- Itens de ocorrencia exibidos em linhas separadas para leitura rapida.

### Devolucoes e ocorrencias (`/returns-occurrences`)
- Fluxo de devolucao total, parcial, sobra e coleta.
- Criacao e manutencao de lotes.
- Geracao de PDF do lote.
- Cadastro/edicao/resolucao de ocorrencias.
- Abas `returns` e `occurrences` com persistencia em query string.
- Itens de ocorrencia exibidos em linhas separadas.
- Perfil `control_tower` em modo leitura para ocorrencias.
- Para `control_tower`, a lista de ocorrencias fica filtrada por `resolution_type = talao_mercadoria_faltante` e `credit_status = pending`.

### Torre de controle (`/control-tower/coletas`)
- Painel de coletas com KPIs, graficos, fila de acao e tabela detalhada.
- Registro de coleta por NF com validacao de existencia da nota.
- Bloco de ocorrencias com talao pendentes de credito.
- Acao `Credito concluido` para `control_tower`, `admin` e `master`.
- Exibicao focada em pendencias de credito para cliente.

## Regras de negocio refletidas na UI
- Torre de controle trabalha com devolucoes/sobras e ocorrencias com talao pendentes de credito.
- Ocorrencias com outros motivos de resolucao nao entram na pendencia da torre.
- Quando o credito e finalizado na torre, a ocorrencia sai da lista pendente.

## Atualizacao automatica de versao (anti-sessao desatualizada)
- O app executa checagem de versao em producao ao voltar para a aba e ao focar a janela.
- Tambem existe checagem periodica em intervalo fixo.
- A comparacao e feita entre o `main.js` carregado e o `asset-manifest.json` atual.
- Quando detecta versao nova, a pagina recarrega automaticamente.
- Implementacao em `src/hooks/useAppVersionAutoRefresh.ts`.

## Rotas da aplicacao
- `/`
- `/home`
- `/todayInvoices`
- `/invoices`
- `/routePlanning`
- `/trips`
- `/returns-occurrences`
- `/control-tower/coletas`
- `/uploadFiles`
- `/products`
- `/customers`

## Entidades consumidas no frontend
- `Customer`
- `Danfe`
- `DanfeProduct`
- `Product`
- `Driver`
- `Car`
- `Trips`
- `TripNotes`
- `InvoiceReturn`
- `InvoiceReturnItem`
- `Occurrence`

## Integracoes de API usadas na interface
- `GET /danfes`, `GET /danfes/date`, `GET /danfes/nf/:id`, `GET /danfes/barcode/:id`
- `PUT /danfes/update-status`
- `POST /returns/batches/create`
- `GET /returns/batches/search`
- `POST /returns/batches/:batchCode/add-note`
- `DELETE /returns/notes/:id`
- `GET /occurrences/search`
- `GET /occurrences/pending`
- `POST /occurrences/create`
- `PUT /occurrences/:id`
- `PUT /occurrences/status/:id`
- `PUT /occurrences/credit/:id`
- `DELETE /occurrences/:id`

## Execucao local
```bash
npm install
npm start
```

Aplicacao local: `http://localhost:3000`

## Human Verification (login)
Para habilitar CAPTCHA no frontend, crie `frontend/.env` com uma das chaves:

```bash
REACT_APP_TURNSTILE_SITE_KEY=...
# ou
REACT_APP_RECAPTCHA_SITE_KEY=...
```

Variaveis esperadas no backend para validacao:
- `HUMAN_VERIFICATION_PROVIDER` (`turnstile`, `recaptcha` ou `none`)
- `TURNSTILE_SECRET_KEY`
- `RECAPTCHA_SECRET_KEY`

## Build e deploy
```bash
npm run build
npm run deploy
```

Observacoes:
- O projeto usa `HashRouter` para evitar erro 404 em hospedagem estatica.
- O `homepage` no `package.json` define o path de publicacao.

## Scripts
- `npm start`
- `npm run build`
- `npm test`
- `npm run deploy`
