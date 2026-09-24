-- Execute uma vez no SQL Editor do Supabase antes de publicar o novo painel.
-- A tabela fica acessível somente pelas rotas administrativas do servidor.

create table if not exists public.admins (
  email text primary key check (email = lower(trim(email))),
  created_by text not null default '',
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
