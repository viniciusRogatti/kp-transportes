# Sistema de Gestão de Transportadora

## Descrição do Sistema
O sistema desenvolvido tem como objetivo gerenciar operações de uma transportadora, facilitando a leitura e processamento de arquivos XML de notas fiscais (DANFEs), e fornecendo ferramentas para a roteirização de entregas, gestão de veículos e motoristas, e monitoramento de viagens e produtos.

### Funcionalidades Principais

1. Leitura de Arquivos XML
   - 📄 Leitura e extração de informações de arquivos XML de notas fiscais.
   - 📊 Armazenamento dos dados extraídos nas tabelas do banco de dados: `Customer`, `Danfe`, `Product`, `DanfeProduct`.

2. Página de Notas do Dia
   - 📅 Exibição das notas fiscais recebidas no dia atual.
   - 🔍 Filtros disponíveis: Nome do Cliente, Cidade, Número da NF, Produto e Rota.

3. Pesquisa de Notas
   - 🔎 Pesquisa de notas por número de NF ou período de data.
   - 📂 Filtros adicionais: Nome do Cliente, Cidade, Número da NF, Produto e Rota.

4. Página de Roteirização
   - 🚚 Seleção de motorista e veículo para adicionar notas à viagem.
   - 📦 Adição de notas via número da NF ou código de barras.
   - 📊 Gerenciamento de motoristas (`Driver`) e veículos (`Car`).

5. Página de Viagens (Trips)
   - 📅 Exibição das viagens realizadas na data atual.
   - 📅 Seleção de data para visualizar viagens de outros dias.

6. Página de Produtos
   - 🛍️ Exibição de todos os produtos cadastrados no banco de dados.

7. Página de Clientes
   - 👥 Exibição de todos os clientes cadastrados no banco de dados.

8. Página de Relatórios para Usuários Master
   - 📊 Visualização das viagens de um motorista em um período selecionado.
   - 💸 Agregação de valores por viagem conforme a região.
   - 💵 Inserção de gastos com pedágios e geração de relatório em PDF.

## Estrutura do Banco de Dados

### Tabelas Principais
- **Customer:** Armazena dados dos clientes.
- **Danfe:** Armazena dados das notas fiscais.
- **Product:** Armazena dados dos produtos.
- **DanfeProduct:** Tabela intermediária que liga produtos às notas.
- **Car:** Armazena dados dos veículos.
- **Driver:** Armazena dados dos motoristas.
- **Trips:** Armazena dados das viagens.
- **TripNotes:** Armazena dados das notas das viagens.


## Como Usar o Sistema

1. **Carregamento de XML:**
   - Faça o upload dos arquivos XML para importar dados de notas fiscais.

2. **Gerenciamento de Notas:**
   - Acesse a página de notas do dia para visualizar e filtrar notas.
   - Use a página de pesquisa para encontrar notas específicas.

3. **Roteirização:**
   - Selecione um motorista e um veículo.
   - Adicione notas às viagens utilizando NF ou código de barras.

4. **Monitoramento de Viagens:**
   - Visualize as viagens do dia ou selecione uma data específica.

5. **Gestão de Produtos e Clientes:**
   - Navegue nas páginas de produtos e clientes para visualizar todos os registros.

6. **Relatórios Master:**
   - Utilize a página de relatórios para gerar relatórios detalhados das viagens e gastos de motoristas.
