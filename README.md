# KP Transportes — Plataforma de Gestão Operacional para Transportadoras

Sistema web para transportadoras que precisam controlar a operação inteira: da importação da NF e montagem da rota até a comprovação da entrega, devolução parcial, coleta, ocorrência, reentrega e acompanhamento pela torre de controle.

Não é apenas um roteirizador. O foco é reduzir os erros que normalmente ficam espalhados entre planilhas, grupos de WhatsApp, romaneios impressos e conversas entre expedição, motorista e conferência.

## O que a plataforma resolve

- Centraliza DANFEs, clientes, produtos, motoristas, veículos e rotas em um único painel.
- Cria rotas por leitura de código de barras ou NF e bloqueia conflitos antes de virarem problema operacional.
- Mantém evidências de entrega e pendências de canhoto conectadas ao status real da nota.
- Controla devoluções e coletas parciais por item, sem permitir coletar mais mercadoria do que foi faturada.
- Organiza ocorrências, sobras, faltas, avarias e solicitações de coleta em uma esteira rastreável.
- Mostra a operação em mapa, com status de rota, alertas e visão para a torre de controle.
- Mantém trilha de auditoria das mudanças de status importantes.

## Para quem é

Ideal para transportadoras, distribuidores com frota própria, operadores logísticos e empresas que realizam entregas com NFs, precisam emitir romaneios e sofrem com reentregas, canhotos pendentes ou devoluções difíceis de conferir.

## Diferenciais operacionais

### A rota não é só uma lista de entregas

- Criação e edição de rotas com motorista, veículo, data e número de saída.
- Inclusão de notas por NF ou código de barras; inclusão em lote e por cidade.
- Ordenação manual das paradas e controle de quantidade de caixas quando aplicável.
- Validação de motorista e veículo já ocupados em outra rota ativa.
- Fluxo de segunda saída para o mesmo motorista.
- Tratamento de NF já atribuída a outra rota, com remoção assistida e reatribuição.
- Exportação de romaneio em TXT, lista de produtos e lista de entregas em PDF.
- Impressão de listas específicas, como o romaneio de salmão.

### Prevenção de baixa indevida por canhoto

O sistema foi desenhado para tratar um problema comum de operação: a foto postada no grupo pode estar com a NF digitada errada.

Quando uma NF já marcada como entregue é bipada na roteirização, o operador precisa conferir a foto e informar a NF visível nela:

1. Se a foto for da mesma NF, a entrega é mantida e a nota sai da rota impressa/aberta indevidamente.
2. Se a foto for de outra NF, a nota baixada por engano volta para **reentrega** e a NF correta é confirmada como entregue.
3. A correção deixa registro operacional para rastreabilidade.

Isso reduz dois riscos ao mesmo tempo: uma nota não entregue marcada como entregue e uma nota entregue de verdade que ficou pendente por erro de digitação.

### Canhotos e prova de entrega pelo WhatsApp

- Integração com grupos configurados de WhatsApp para leitura operacional de fotos com NF na legenda.
- Baixa de entrega vinculada à NF, grupo e horário da postagem.
- Central de atividade com sucessos, revisões e falhas do fluxo.
- Upload manual de canhoto como alternativa operacional.
- Backlog de canhotos e correção de evidência para notas pendentes.
- Lembrete preventivo de canhoto retido no próximo romaneio relevante: se houver nova entrega para o mesmo cliente, a pendência aparece para o motorista; se não houver, a plataforma usa o contexto da cidade para orientar a coleta.

> A postagem no WhatsApp precisa conter a NF na legenda. Esse critério evita que uma foto sem identificação gere baixa automática errada.

### Devoluções, coletas e devoluções parciais com controle de quantidade

Este é um dos pontos mais importantes da plataforma para operações de alimentos, distribuição e cargas fracionadas.

- Cadastro de devolução total, parcial, coleta, sobra, faltante e demais tratamentos operacionais.
- Controle de quantidade por produto e por NF.
- Cálculo de saldo coletável: `quantidade original − total já coletado`.
- Bloqueio automático quando uma coleta parcial tenta ultrapassar o que foi faturado.
- Uma coleta parcial de hoje preserva o saldo correto para outra coleta futura, inclusive meses depois.
- Histórico de coletas confirmado e protegido contra sobrescrita silenciosa.
- Impede duplicidade quando a NF ou o item já foi totalmente devolvido/coletado.
- Tratamento de sobra por inversão com distribuição entre NFs relacionadas e validação do total distribuído.
- Lotes com etapas claras: pendente na transportadora, aguardando torre e finalizado.
- Após o envio do lote para a torre, o conteúdo deixa de ser editável, protegendo a conferência.
- Comprovantes e relatórios de devolução para a operação.

Exemplo: se a NF possui 5 unidades de um item e já houve uma coleta confirmada de 4, a próxima coleta só pode registrar até 1 unidade. A plataforma bloqueia qualquer tentativa de registrar 2.

### Ocorrências e tratativa de exceções

- Registro de falta no carregamento, falta na carga, avaria, produto invertido e produto sem etiqueta/data.
- Fluxos de resolução apropriados para cada motivo, como envio posterior, NF parcial, troca realizada e acerto com o cliente.
- Histórico da ocorrência, responsável e mudança de status.
- Visão de pendências para a expedição e para a torre de controle.

### Torre de controle e coletas

- Painel próprio para acompanhar devoluções, coletas, pendências de crédito e fila de ação.
- Indicadores e gráficos por período, cidade, cliente, produto, tipo e status.
- Acompanhamento de solicitação, aceite/agendamento, coleta, envio em lote e recebimento.
- Detalhe completo de cada caso: resumo, itens, histórico e ações operacionais.

### Monitoramento de entregas e alertas

- Visão de motoristas, rotas e entregas em Google Maps.
- Status visual por etapa: pendente, atribuída, em rota, no local, entregue, reentrega, devolvida e canhoto retido.
- Filtros por empresa, motorista, rota e situação operacional.
- Alertas para exceções operacionais, pendências de canhoto, divergências de NF, falta de rota e outras situações que exigem ação.
- Atualizações em tempo real quando a integração de eventos/localização estiver ativa, com fallback de consulta periódica.

### Gestão de NFs, XML, clientes e produtos

- Importação de XML em fila, com resumo do processamento e erros por arquivo.
- Detecção de produtos novos e atualizados durante a importação.
- Pesquisa de NF por número, período, produto, cliente, cidade, rota, motorista e status.
- Consulta rápida de notas do dia.
- Cadastro/consulta de clientes, produtos, veículos e motoristas.
- Histórico de NF, ocorrências, rota, status e contexto de refaturamento.

### CT-e: preparação fiscal e rascunhos

- Configuração de frete por kg, ad valorem, GRIS, pedágio, despacho e seguro.
- Cadastro dos dados fiscais da emissora, CFOP intra/interestadual, RNTRC e regime tributário.
- Armazenamento e acompanhamento de validade do certificado A1.
- Prévia de valores e criação de rascunhos de CT-e vinculados às NFs.

> A assinatura/transmissão do XML CT-e para a SEFAZ não faz parte da etapa atual do módulo; a plataforma prepara e organiza a operação fiscal.

### Segurança, administração e multiempresa

- Login protegido por JWT e verificação de sessão nas páginas restritas.
- Proteção humana opcional com Cloudflare Turnstile ou reCAPTCHA.
- Perfis de acesso: administrador geral, administrador, expedição, conferente, usuário operacional e torre de controle.
- Escopo multiempresa para equipes internas autorizadas.
- Cadastro de usuários e histórico/analytics de sessões para administração.
- Notificações em tempo real e registro das principais mudanças de status.

## Fluxo resumido da operação

```text
XML / NF → consulta e conferência → roteirização → romaneio
→ entrega ou ocorrência → canhoto / evidência → alerta ou baixa
→ devolução / coleta parcial quando necessário → torre de controle → histórico
```

## Módulos disponíveis

| Módulo | Principais recursos |
|---|---|
| Notas e XML | Importação, pesquisa, produtos, clientes, status e histórico |
| Roteirização | NF/código de barras, rotas, saídas, conflitos, PDFs e TXT |
| Entregas | Monitoramento, status, reentrega, alertas e prova de entrega |
| Canhotos | WhatsApp, upload manual, backlog e lembretes preventivos |
| Devoluções | Total, parcial, coleta, sobra, faltante, saldo por item e lotes |
| Ocorrências | Avarias, faltas, inversões e resolução acompanhada |
| Torre de controle | KPIs, filas, coletas, crédito, filtros e histórico |
| CT-e | Configuração, certificado, prévia e rascunhos |
| Administração | Usuários, perfis, empresas, sessões e notificações |

## Stack e integrações

- React 18 + TypeScript
- React Router com `HashRouter`
- Tailwind CSS, TanStack Query, Axios e ECharts
- Google Maps JavaScript API
- React PDF Renderer
- Socket.io Client
- Backend REST autenticado, armazenamento de evidências e integração opcional com WhatsApp

## Rotas da interface

| Rota | Tela |
|---|---|
| `/` | Login |
| `/home` | Painel operacional |
| `/todayInvoices` e `/invoices` | Notas do dia e pesquisa histórica |
| `/routePlanning` | Roteirização e manutenção de rotas |
| `/delivery-monitoring` | Monitoramento de entregas |
| `/returns-occurrences` | Devoluções e ocorrências |
| `/operational-pendencies` | Pendências de canhotos e operação |
| `/alerts` | Central de alertas |
| `/uploadFiles` | Importação de XML |
| `/cte-management` | Gestão operacional de CT-e |
| `/control-tower/coletas` | Torre de controle |

## Execução local

```bash
npm install
npm start
```

Aplicação local: `http://localhost:3000`

### Variáveis de ambiente

```bash
# Verificação humana no login (opcional)
REACT_APP_TURNSTILE_SITE_KEY=...
# ou
REACT_APP_RECAPTCHA_SITE_KEY=...

# Monitoramento em mapa
REACT_APP_GOOGLE_MAPS_API_KEY=...
# opcional em ambientes que também exponham variáveis no padrão Vite
VITE_GOOGLE_MAPS_API_KEY=...
```

## Scripts

- `npm start`
- `npm run build`
- `npm test`
- `npm run deploy`

## Observações comerciais

- O sistema é adequado para implantação por empresa, com configuração de usuários, motoristas, veículos, regras de grupos de WhatsApp e treinamento inicial.
- Integrações externas, desenvolvimento sob medida, volume extraordinário de armazenamento e serviços de mapas podem ser contratados conforme a necessidade da operação.
- Recursos dependentes de integração — como localização em tempo real e WhatsApp — precisam ser configurados no ambiente do cliente.
