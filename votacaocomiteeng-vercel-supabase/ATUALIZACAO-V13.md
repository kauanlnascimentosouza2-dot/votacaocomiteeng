# V13 — novo guia interativo do sistema

## O que mudou

O tutorial simples foi substituído por um guia completo, visual e navegável.

- Explicação individual de cada aba disponível no menu.
- Conteúdo adaptado ao perfil: administrador, integrante com grupo ativo ou usuário aguardando alocação.
- Índice lateral para abrir qualquer explicação sem seguir uma sequência obrigatória.
- Três exemplos práticos do que pode ser feito em cada área.
- Dica rápida com a regra ou cuidado mais importante de cada aba.
- Botão para abrir diretamente a área que está sendo explicada.
- Continuidade entre páginas: ao abrir uma aba pelo guia, o tour reaparece no mesmo ponto.
- Barra de progresso e indicação das etapas já visitadas.
- Opções para fechar temporariamente, pular ou reabrir pelo menu lateral.
- Navegação por teclado, retenção do foco e tecla `Esc` para fechar.
- Layout próprio para computador, tablet e celular.

## Conteúdo apresentado

### Integrantes

- Área do grupo
- Aulas
- Cronograma
- Votação
- Nós
- Chat geral
- Notificações
- Meu perfil

### Administradores

Além das áreas acima, o guia apresenta:

- Semestres e grupos
- Demandas e prazos
- Análise de projetos
- Votação e resultados
- Publicações pendentes
- Participantes e administradores

### Usuários aguardando grupo

O guia mostra a aba Nós, o perfil e explica o que será liberado depois da alocação.

## Exibição para usuários atuais

Esta versão usa uma nova identificação local do guia. Assim, usuários que já concluíram o tutorial antigo verão o novo guia uma vez no navegador atual. Depois de concluir ou pular, ele não abre automaticamente novamente, mas continua disponível em **Guia do sistema** na parte inferior do menu.

## Banco de dados

Esta atualização não exige um SQL novo. Se a V12 ainda não foi publicada, execute antes o arquivo `supabase/multiple-projects-update.sql` para liberar vários projetos por grupo.

## Como publicar

1. Substitua o código atual pelo conteúdo desta pasta.
2. Preserve as variáveis de ambiente existentes.
3. Envie as alterações ao repositório conectado à Vercel.
4. Aguarde o deployment ficar **Ready**.
5. Entre uma vez como administrador e uma vez como integrante para conferir os dois roteiros.

## Verificação realizada

O build de produção do Next.js foi concluído com sucesso, incluindo a verificação do TypeScript e a geração de todas as rotas.
