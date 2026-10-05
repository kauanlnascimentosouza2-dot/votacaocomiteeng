# Atualização V9 — recuperação de senha

Esta versão adiciona o fluxo completo de **Esqueci minha senha**:

- botão na tela de entrada;
- envio do link pelo e-mail cadastrado;
- validação segura do link pelo Supabase;
- página para criar e confirmar a nova senha;
- aviso claro quando o link estiver inválido ou expirado.

## Publicação

1. Envie o conteúdo desta pasta para `votacaocomiteeng-vercel-supabase` no GitHub, mantendo a estrutura dos arquivos.
2. Aguarde o novo deployment da Vercel ficar `Ready`.
3. No Supabase, abra **Authentication → URL Configuration**.
4. Confirme que **Site URL** é `https://votacaocomiteeng.vercel.app`.
5. Em **Redirect URLs**, mantenha os endereços existentes e acrescente `https://votacaocomiteeng.vercel.app/auth/callback` caso ainda não esteja na lista. Não é necessário apagar os redirects atuais.
6. Salve e teste em uma janela anônima: **Entrar → Esqueci minha senha → informar e-mail → abrir o link recebido → criar nova senha**.

O envio utiliza o SMTP já configurado no Supabase. Nenhuma alteração SQL é necessária para esta função. O sistema apresenta uma resposta genérica mesmo quando o e-mail não existe, evitando expor quais endereços estão cadastrados.

## Observações

- A senha nova deve ter no mínimo 8 caracteres.
- O usuário precisa digitar a senha duas vezes.
- Links expirados ou já utilizados não permitem a alteração; basta solicitar outro.
- Esta versão contém também os arquivos e melhorias das versões anteriores, inclusive a atualização do calendário.
