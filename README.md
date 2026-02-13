# KP Transportes - Frontend

Aplicacao web para operacao de transporte e distribuicao: importacao de DANFEs, pesquisa e filtragem de notas, roteirizacao de viagens e controle de devolucoes/ocorrencias.

## Stack
- React 18 + TypeScript
- React Router DOM
- Styled Components
- Axios
- React Datepicker
- Framer Motion (animacoes pontuais)
- React PDF Renderer (geracao/abertura de PDFs)

## Funcionalidades

### 1) Autenticacao
- Tela de login com validacao de token.
- Redirecionamento para `/` quando token e invalido ou ausente.

### 2) Upload de XML (DANFEs)
- Importacao de XMLs para alimentar dados de clientes, produtos e notas.

### 3) Notas do dia (`/todayInvoices`)
- Lista de DANFEs do dia.
- Filtros por:
  - NF
  - Produto (codigo ou descricao)
  - Nome do cliente
  - Cidade
  - Rota (oculto no mobile)
- Abertura de lista de produtos em PDF.

### 4) Pesquisar notas (`/invoices`)
- Busca por NF pontual.
- Busca por periodo (data inicio/data fim).
- Busca rapida por NF via header global (atalho): ao pressionar `Enter`, abre `Pesquisar notas` ja com a NF consultada.
- Filtros por:
  - NF
  - Produto (codigo ou descricao)
  - Nome do cliente
  - Cidade
  - Rota (oculto no mobile)
- Layout responsivo com foco em usabilidade no celular.

### 5) Roteirizacao (`/routePlanning`)
- Selecao de motorista e veiculo.
- Adicao de nota por NF ou codigo de barras.
- Reordenacao e remocao de notas da viagem.
- Persistencia da viagem e atualizacao de status das notas.

### 6) Viagens (`/trips`)
- Consulta de viagens por data.
- Visualizacao e exportacao de informacoes da roteirizacao.

### 7) Devolucoes e Ocorrencias (`/returns-occurrences`)
- Fluxo de devolucao total/parcial por NF.
- Criacao e gestao de lotes de devolucao.
- Geracao de PDF de comprovante/lote.
- Registro de ocorrencias (com ou sem produto).
- Resolucao de ocorrencias pendentes.
- Navegacao por abas (Devolucoes/Ocorrencias) com estilo de janela, sem troca de rota.
- Estado da aba persistido por query param (`?tab=returns|occurrences`) e ultima aba salva localmente.

### 8) Cadastros e consultas
- Produtos (`/products`)
- Clientes (`/customers`)
- Home operacional com indicadores e pendencias (`/home`)

## Rotas da aplicacao
- `/` login
- `/home`
- `/todayInvoices`
- `/invoices`
- `/routePlanning`
- `/trips`
- `/returns-occurrences`
- `/uploadFiles`
- `/products`
- `/customers`

## Estrutura de dados utilizada (resumo)
As entidades principais consumidas no frontend sao:
- `Customer`
- `Danfe`
- `DanfeProduct`
- `Product`
- `Driver`
- `Car`
- `Trips`
- `TripNotes`
- `InvoiceReturn` / `InvoiceReturnItem`
- `Occurrence`

## Execucao local
```bash
npm install
npm start
```

Aplicacao local: `http://localhost:3000`

## Build e deploy
```bash
npm run build
npm run deploy
```

Observacoes:
- O projeto usa `HashRouter` para evitar erro `404` em hospedagem estatica.
- `homepage` no `package.json` aponta para o path de publicacao em GitHub Pages.

## Scripts
- `npm start`: ambiente de desenvolvimento
- `npm run build`: build de producao
- `npm test`: testes
- `npm run deploy`: publica build no GitHub Pages

## Atualizacoes recentes
- Busca rapida por NF no topo agora encaminha para `/invoices?nf=...` e executa a busca automaticamente.
- Pagina `Devolucoes/Ocorrencias` recebeu abas conectadas ao painel (efeito de aba de navegador), com aba inativa mais escura e persistencia de selecao.
