# Assinatura visual do login KP

## Conceito

O login combina **Fluxo Logístico Vivo** e **Documento em Movimento**. A fotografia não ocupa uma coluna: ela é recortada como uma janela operacional, atravessada por uma linha contínua e parcialmente coberta por uma folha de acesso em múltiplos planos.

O conjunto representa o ciclo real do sistema:

1. entrada do documento;
2. organização da operação;
3. formação da rota;
4. confirmação da entrega;
5. retorno do comprovante;
6. registro auditável.

## Elemento exclusivo

A **Linha de Retorno KP** é um SVG com seis pontos ligados por avanços, retornos e mudanças de nível. Ela não representa um mapa literal. O desenho resume visualmente o movimento de ida da carga e a volta da informação até o registro final.

O índice vertical `KP 01—06`, preso à folha de acesso, conecta o formulário aos seis pontos e permite que a assinatura seja reutilizada futuramente sem depender da fotografia.

## Profundidade e interação

- plano de fundo: grade técnica e luz ambiente;
- plano intermediário: fotografia recortada, borda deslocada e linha operacional;
- primeiro plano: folha de acesso com duas cópias deslocadas, como documentos em processamento;
- tráfego operacional: três caminhões vistos de cima percorrem a Linha de Retorno KP com velocidade igual e espaçamento de um terço do circuito, evitando encontros e reforçando a leitura da linha como pista;
- controle contextual: clicar na pista ou nos caminhões mantém o tráfego pausado; aproximar o ponteiro pausa temporariamente; digitar uma credencial libera novamente a circulação;
- foco em usuário e senha: avança a linha e destaca os pontos correspondentes;
- validação: percorre o restante do circuito;
- sucesso: conclui a linha em verde antes da navegação disponível no mesmo ciclo de renderização.

## Acessibilidade e fallback

A narrativa visual é decorativa e não interfere na ordem de leitura. O SVG fica oculto para tecnologias assistivas e possui uma descrição textual equivalente. Campos, erros, botão de senha e envio preservam rótulos e estados acessíveis.

Com `prefers-reduced-motion`, os caminhões móveis são ocultados e a pista permanece estática. O comando da pista possui rótulo acessível e também aceita teclado. Sem suporte a recorte, mistura de cores ou filtros, a fotografia e a folha continuam legíveis em planos retangulares. Nenhuma biblioteca gráfica, canvas ou WebGL é utilizada.

## Mobile

No celular, o recorte vira uma janela vertical. A folha invade a borda inferior da cena e mantém o índice `01—06`, formando uma única composição. Os caminhões recebem compensação de escala para continuarem reconhecíveis na pista comprimida e podem ser pausados por toque. O formulário permanece em fluxo normal para permitir rolagem e acomodar CAPTCHA, teclado virtual e mensagens de erro.
