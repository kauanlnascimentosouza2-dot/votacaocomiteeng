# Atualização V5 — Aulas

Esta versão acrescenta a página **Aulas**. Ela mantém as funções da V4 e não remove os dados já cadastrados.

## Instalação

1. No Supabase, abra **SQL Editor**, crie uma consulta e execute todo o conteúdo de `supabase/lessons-update.sql`. O resultado esperado é `Success. No rows returned`.
2. No GitHub, abra a pasta `votacaocomiteeng-vercel-supabase` do projeto e envie o conteúdo da pasta `votacaocomiteeng-v5-pronto`, mantendo a mesma estrutura de pastas. Substitua os arquivos existentes.
3. Aguarde a Vercel indicar **Ready**. Acesse o sistema novamente para conferir o item **Aulas** no menu lateral.

Não é preciso criar novas variáveis de ambiente para esta função.

## Como usar

- O administrador abre **Aulas**, cria uma pasta principal ou uma subpasta e escolhe a pasta desejada.
- Em **Nova aula**, informa título, link do vídeo no YouTube ou Vimeo e descrição. A aula aparece imediatamente aos participantes com acesso.
- O administrador pode editar a aula e renomear, arquivar ou restaurar pastas e aulas.
- Os participantes podem navegar pelas pastas, assistir ao vídeo na própria página e ler a descrição.
- As aulas são organizadas por edição. A página usa a edição ativa; pessoas sem grupo ativo aguardam a alocação para acessá-la.

Os vídeos permanecem hospedados no YouTube ou Vimeo. Se quiser restringir a descoberta do vídeo, configure a privacidade na própria plataforma de vídeo.
