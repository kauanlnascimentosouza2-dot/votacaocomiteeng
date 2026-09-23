# votacaocomiteeng

Sistema de votação com login, voto único, cadastro de propostas, envio de imagens e painel administrativo identificado.

## Configuração

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e execute.
3. Em **Authentication > URL Configuration**, informe a URL do site da Vercel e acrescente `https://SEU-SITE.vercel.app/auth/callback` às URLs permitidas.
4. Copie `.env.example` para `.env.local` e preencha as quatro variáveis.
5. Use no `ADMIN_EMAIL` exatamente o e-mail da conta que administrará a votação.
6. No desenvolvimento, execute `npm install` e `npm run dev`.

## Publicação na Vercel

1. Envie este projeto para um repositório no GitHub.
2. Importe o repositório em https://vercel.com/new.
3. Cadastre as quatro variáveis de `.env.example` nas configurações do projeto.
4. Faça a publicação.
5. Atualize as URLs permitidas no Supabase com o endereço definitivo da Vercel.

## Segurança

- Nunca envie `.env.local` ao GitHub.
- Nunca exponha `SUPABASE_SECRET_KEY` no navegador nem use prefixo `NEXT_PUBLIC_` nessa variável.
- O banco impede mais de um voto por usuário em cada votação.
- Somente o e-mail configurado em `ADMIN_EMAIL` acessa os votos identificados e cadastra propostas.
