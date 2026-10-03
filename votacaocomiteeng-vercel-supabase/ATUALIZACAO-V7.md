# Atualização V7 — Entregas AutoCAD no Supabase

Esta versão preserva grupos, projetos, votos, aulas, chat e entregas anteriores. Ela permite anexar DWG ou DXF às etapas e envia os arquivos de entrega diretamente do navegador ao Supabase Storage.

## Instalação

1. Se seu projeto tiver limite global de arquivo abaixo de 50 MB, ajuste-o em **Storage → Settings** para 50 MB. O limite do plano Free é 50 MB por arquivo; o espaço total de Storage incluído é 1 GB.
2. No Supabase, abra **SQL Editor** e execute todo o arquivo `supabase/cad-uploads-update.sql`. O resultado esperado é `Success. No rows returned`. A migração cria o controle de uploads e ajusta o bucket privado `project-files` para arquivos de até 50 MB.
3. No GitHub, abra a pasta `votacaocomiteeng-vercel-supabase` e envie **o conteúdo completo** da pasta `votacaocomiteeng-v7-pronto`, mantendo a estrutura. Não envie a própria pasta como subpasta.
4. Aguarde a Vercel indicar **Ready**. Atualize a página do site.

## Como usar

- Em **Área do grupo → Projeto → Entregas**, escolha um arquivo `.dwg`, `.dxf`, `.pdf`, `.jpg`, `.png` ou `.webp` de até 50 MB e confirme a etapa.
- O arquivo é enviado diretamente ao Supabase. A entrega só é registrada após o servidor confirmar que ele chegou completo.
- O líder do grupo continua responsável pela entrega final; as etapas intermediárias continuam disponíveis para todos os integrantes.
- Na entrega final, título e descrição são obrigatórios. Um arquivo da entrega, uma imagem principal já salva ou um PDF já salvo atende ao requisito de anexo. Assim, uma entrega AutoCAD não precisa de imagem principal.
- Os arquivos de entregas anteriores e novas aparecem no histórico do projeto, com links temporários para download. O administrador pode abri-los em **Revisão de projetos → Editar**.

## Atenção

- O bucket `project-files` permanece privado. O sistema não publica arquivos DWG/DXF para visitantes; só pessoas com acesso ao projeto podem obter o link temporário de download.
- O campo de imagem/PDF no formulário **Conteúdo do projeto** ainda usa o envio anterior. Esta atualização muda especificamente os arquivos das **Entregas**. Para a entrega AutoCAD, use o campo de arquivo da etapa.
- Se um envio for interrompido, a entrega não será marcada como concluída. Reabra a página e envie novamente.
- Monitore o consumo em **Supabase → Usage → Storage**. No plano Free, os arquivos de todos os projetos compartilham o espaço de Storage da organização.
