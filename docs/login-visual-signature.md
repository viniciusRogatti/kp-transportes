# Login KP — O próximo destino começa aqui

## Composição

O login usa a referência de cartão dividido: uma fotografia da frota à esquerda e um painel de acesso branco à direita, com cantos arredondados e moldura contínua. Um panorama gerado a partir da foto do Volvo continua o galpão à direita e preenche todo o fundo, conectando o cartão à página sem área branca externa. A fotografia original permanece dentro do cartão. O arquivo e o prompt de geração estão documentados em `login-background-generation.md`.

O Volvo original é preservado, incluindo o ângulo, as cores e os detalhes da frota. O enquadramento responsivo e a sobreposição em degradê são feitos em CSS. As imagens WebP existentes são selecionadas com `srcSet`, com fallback em PNG.

A paleta própria do login combina branco, azul e grafite, independentemente do tema salvo para o ambiente autenticado. A preferência de tema do usuário não é alterada.

## Conteúdo e comportamento

- A fotografia e a mensagem “O próximo destino começa aqui.” apresentam a marca.
- O título principal “Bom ter você de volta.” conduz ao formulário.
- Usuário, senha, visualização da senha, CAPTCHA, erros e estados de carregamento mantêm o fluxo de autenticação existente.
- “Precisa de ajuda para entrar?” expande uma orientação real para procurar o administrador da empresa.
- O rodapé identifica a plataforma e a versão configurada.

## Responsividade e acessibilidade

Em telas de até 760 px, a fotografia vira uma faixa superior. Em telas baixas, essa faixa vira um cabeçalho fotográfico compacto com a marca antes do encaixe; o formulário ganha prioridade de espaço. O cartão preserva sua composição e é dimensionado proporcionalmente para caber inteiro na área disponível, sem rolagem vertical, horizontal ou interna.

Um `ResizeObserver` mede a zona disponível e as dimensões naturais do cartão, ajustando a escala quando o CAPTCHA, um erro ou a ajuda alteram sua altura. A viewport visual também é acompanhada para mudanças de tamanho, orientação, zoom e abertura do teclado. A trava de rolagem é removida ao sair do login.

O CAPTCHA usa tema claro e alterna entre tamanho normal e compacto conforme a largura natural disponível, mantendo validação e reset de tokens. Campos usam 16 px no layout mobile; em espaços muito pequenos o cartão inteiro é reduzido para cumprir o requisito de permanecer sem rolagem.

Os campos têm rótulos, autocomplete, estados inválidos e descrição dos erros. Controles têm foco visível e os elementos decorativos ficam ocultos de tecnologias assistivas. A página tem um único h1, e o hero usa h2. Animações respeitam `prefers-reduced-motion`.

Os estilos estão isolados em `src/style/Login/login.css`; os estilos da composição anterior foram removidos do CSS global.
