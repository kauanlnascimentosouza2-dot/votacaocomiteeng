# Atualização V6 — Avisos e chat geral

Esta atualização preserva os usuários, grupos, projetos, votos e aulas existentes. Ela acrescenta avisos dentro do site, um e-mail opcional para avisos e um chat geral por edição da Semana das Engenharias.

## Instalação

1. No Supabase, abra **SQL Editor** e execute todo o arquivo `supabase/notifications-chat-update.sql`. O resultado esperado é `Success. No rows returned`.
2. No GitHub, abra a pasta `votacaocomiteeng-vercel-supabase` e envie **o conteúdo completo** da pasta `votacaocomiteeng-v6-pronto`, substituindo os arquivos com o mesmo nome e mantendo a estrutura. Não envie a própria pasta como subpasta.
3. Aguarde o status **Ready** na Vercel. Abra o site novamente; se o menu antigo persistir, atualize a página.

## Como funciona

- Ao criar uma demanda, os membros dos grupos selecionados recebem um aviso no site.
- Ao cadastrar uma aula, os membros dos grupos ativos recebem um aviso no site.
- Ao cadastrar um evento no cronograma, os participantes destinados ao evento recebem um aviso no site.
- O sino no menu mostra os avisos não lidos. É possível abrir um aviso ou marcar todos como lidos.
- Em **Meu perfil**, cada pessoa pode preencher **E-mail para avisos (opcional)**. Este endereço é independente do e-mail usado para entrar. Se estiver vazio, as novas atividades geram somente avisos no site.
- Os e-mails para novas atividades usam as configurações Brevo existentes: `BREVO_API_KEY` e `BREVO_SENDER_EMAIL` na Vercel. O endereço remetente precisa estar validado na Brevo. Se essas variáveis não estiverem configuradas, os avisos dentro do site continuam funcionando.
- **Chat geral** fica no menu lateral. Participantes de grupos ativos e administradores podem conversar na edição ativa. Edições encerradas ficam disponíveis somente para leitura. O autor pode apagar suas mensagens, e o administrador pode moderar qualquer mensagem. O chat é atualizado automaticamente enquanto a página está aberta.
- Os lembretes de prazo que já existiam continuam funcionando com o endereço de login; o novo campo opcional controla os e-mails de **novas atividades**.

## Teste recomendado

1. Preencha **E-mail para avisos** no perfil de um usuário de teste e salve.
2. Como administrador, crie uma nova aula ou demanda para o grupo desse usuário.
3. Confira o sino no site e a caixa de entrada do endereço cadastrado. Se não chegar e-mail, verifique spam e os logs transacionais na Brevo.
4. Envie uma mensagem no **Chat geral** com dois usuários e confira a atualização automática.

Não execute os arquivos SQL antigos novamente se as versões anteriores já foram instaladas. Execute apenas `notifications-chat-update.sql` para esta atualização.
