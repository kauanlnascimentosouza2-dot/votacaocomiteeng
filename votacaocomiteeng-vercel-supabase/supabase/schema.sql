-- Execute este arquivo uma vez no SQL Editor do Supabase.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  title text not null,
  description text not null,
  image_url text,
  accent text not null default 'blue',
  created_at timestamptz not null default now(),
  unique (id, poll_id)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  proposal_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint votes_proposal_poll_fk foreign key (proposal_id, poll_id)
    references public.proposals(id, poll_id) on delete cascade,
  constraint votes_one_per_poll unique (poll_id, user_id)
);

create table if not exists public.admins (
  email text primary key check (email = lower(trim(email))),
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_proposals_poll on public.proposals(poll_id);
create index if not exists idx_votes_poll on public.votes(poll_id);
create index if not exists idx_votes_proposal on public.votes(proposal_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.polls enable row level security;
alter table public.proposals enable row level security;
alter table public.votes enable row level security;
alter table public.admins enable row level security;

drop policy if exists "Usuário consulta o próprio perfil" on public.profiles;
create policy "Usuário consulta o próprio perfil"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "Participantes consultam votações" on public.polls;
create policy "Participantes consultam votações"
  on public.polls for select to authenticated
  using (true);

drop policy if exists "Participantes consultam propostas" on public.proposals;
create policy "Participantes consultam propostas"
  on public.proposals for select to authenticated
  using (true);

drop policy if exists "Participante consulta o próprio voto" on public.votes;
create policy "Participante consulta o próprio voto"
  on public.votes for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Participante registra o próprio voto" on public.votes;
create policy "Participante registra o próprio voto"
  on public.votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.polls
      where polls.id = poll_id
        and polls.status = 'active'
        and (polls.ends_at is null or polls.ends_at > now())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proposal-images',
  'proposal-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.polls (id, title, description, status, ends_at)
values (
  '11111111-1111-4111-8111-111111111111',
  'Prioridades do Comitê de Engenharia',
  'Escolha a proposta que deve receber prioridade no próximo ciclo.',
  'active',
  now() + interval '14 days'
)
on conflict (id) do nothing;

insert into public.proposals (id, poll_id, title, description, accent)
values
  ('21111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Laboratório de prototipagem', 'Criar um espaço compartilhado para testes rápidos, impressão 3D e validação de novos conceitos.', 'blue'),
  ('31111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Programa de eficiência energética', 'Mapear os maiores consumos e executar melhorias com metas mensais de redução.', 'green'),
  ('41111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Biblioteca técnica digital', 'Centralizar normas, memoriais, decisões e aprendizados para consulta de toda a equipe.', 'orange')
on conflict (id) do nothing;
