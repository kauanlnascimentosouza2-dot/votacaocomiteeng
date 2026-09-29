# Atualização V4 — perfis, cronograma, comunidade e navegação

Esta atualização é aditiva: mantém os usuários, semestres, grupos, demandas, projetos e votos já existentes.

## 1. Atualizar o banco de dados

No Supabase, abra **SQL Editor**, crie uma consulta nova, cole todo o conteúdo de `supabase/experience-update.sql` e pressione **Run**.

O resultado esperado é `Success. No rows returned`.

## 2. Atualizar o GitHub

Abra no GitHub a pasta `votacaocomiteeng-vercel-supabase` e envie o conteúdo desta pasta para ela, preservando exatamente os nomes e a estrutura das pastas. Confirme a substituição dos arquivos que já existirem.

Não envie a pasta externa `votacaocomiteeng-v4-pronto`; envie os arquivos que estão dentro dela.

Depois do commit, a Vercel deverá iniciar um novo deployment automaticamente.

## 3. Conferir o deployment

Na Vercel, aguarde o deployment ficar com o estado **Ready**. Depois entre novamente no sistema e confira:

- menu lateral com ícones;
- Área do grupo;
- Cronograma;
- Votação;
- Nós;
- Meu perfil;
- novas seções do Painel administrativo.

Usuários que ainda aguardam alocação verão apenas `Nós` e `Meu perfil`. O acesso completo será liberado quando o administrador os colocar em um grupo ativo.

## 4. Ativar lembretes por e-mail (opcional)

O restante do sistema funciona mesmo sem esta etapa. Para ativar os lembretes automáticos, adicione na Vercel, em **Settings > Environment Variables**:

- `CRON_SECRET`: um valor longo e aleatório;
- `BREVO_API_KEY`: uma chave de API criada na Brevo (não é a chave SMTP);
- `BREVO_SENDER_EMAIL`: o endereço exato do remetente verificado na Brevo;
- `BREVO_SENDER_NAME`: por exemplo, `Comitê de Engenharia`.

Depois, faça um redeploy. O sistema verificará os prazos diariamente às 08:00 no horário de São Paulo e evitará o envio duplicado do mesmo lembrete.

## O que foi incluído

- perfil com foto, curso, período, telefone, especialidade, competências, apresentação, LinkedIn e portfólio;
- perfis visíveis aos integrantes do próprio grupo e a todos os administradores;
- calendário mensal, próximas atividades, filtros e eventos administrativos;
- prazos automáticos de demandas, entregas, publicações e votações;
- área `Nós` com fotos, registros, conquistas, dificuldades, comentários e moderação;
- publicações preservadas no histórico de cada edição;
- aprovação e solicitação de ajustes em projetos;
- gerenciamento de participantes, perfis e administradores;
- menu lateral compacto, expansível e adaptado para celular;
- lembretes opcionais por e-mail.

## Segurança e preservação

- as imagens de perfil e da comunidade ficam em áreas privadas no Supabase;
- a migração não apaga os dados anteriores;
- publicações editadas voltam para aprovação do administrador;
- somente administradores acessam as áreas administrativas.
