# V12 — vários projetos por grupo

## O que mudou

- Cada grupo pode criar e enviar vários projetos para a mesma demanda.
- Todos os integrantes do grupo podem adicionar um projeto.
- Todos os integrantes podem editar o conteúdo, enviar arquivos de etapas e confirmar a entrega final.
- A Área do grupo agora organiza os projetos dentro de cada demanda e mostra a quantidade cadastrada.
- Depois de clicar em **Adicionar projeto**, o integrante é levado diretamente ao editor do novo projeto.
- Cada projeto continua aparecendo separadamente na análise administrativa e pode ser aprovado ou devolvido para ajustes de forma independente.
- Projetos aprovados continuam sendo selecionados individualmente para uma votação.
- A proteção contra voto no próprio grupo continua valendo para todos os projetos daquele grupo.

## Atualização obrigatória do Supabase

Antes de publicar o código, abra o **SQL Editor** do Supabase e execute todo o arquivo:

`supabase/multiple-projects-update.sql`

O script remove somente a limitação que permitia um projeto por grupo em cada demanda e cria um índice comum para manter as consultas eficientes. Ele também atualiza o texto padrão da entrega final para informar que todos os integrantes podem enviar.

O script pode ser executado novamente sem apagar dados.

## Preservação dos dados

Nenhum usuário, grupo, demanda, projeto, imagem, arquivo, entrega, rodada ou voto existente é removido ou recriado. O projeto já existente de cada grupo continua sendo o primeiro projeto daquela demanda.

## Como publicar

1. Execute `supabase/multiple-projects-update.sql` no Supabase e confirme a mensagem de sucesso.
2. Substitua o código atual pelo conteúdo desta pasta, preservando as variáveis de ambiente existentes.
3. Envie as alterações ao repositório conectado à Vercel.
4. Aguarde o deployment ficar **Ready**.
5. Entre com uma conta de integrante, abra **Área do grupo** e use **Adicionar projeto** em uma demanda.
6. Confirme que o novo projeto aparece separadamente em **Análise de projetos** para o administrador.

## Verificação recomendada após a publicação

- Criar dois projetos na mesma demanda com o mesmo grupo.
- Editar cada projeto e enviar arquivos diferentes.
- Confirmar a entrega final usando uma conta que não seja líder.
- Aprovar somente um dos projetos na análise administrativa.
- Conferir que os projetos aprovados aparecem individualmente ao criar uma votação.
