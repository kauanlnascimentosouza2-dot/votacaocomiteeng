-- Etapa 1: semestres, matrículas e grupos.
-- Esta migração não remove nem altera votos, propostas ou usuários existentes.

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  starts_at timestamptz,
  ends_at timestamptz,
  started_at timestamptz,
  closed_at timestamptz,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists semesters_one_active_idx
  on public.semesters ((status)) where status = 'active';

create table if not exists public.semester_enrollments (
  semester_id uuid not null references public.semesters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'allocated', 'inactive')),
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (semester_id, user_id)
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null,
  status text not null default 'building' check (status in ('building', 'active', 'archived')),
  max_members integer not null default 9 check (max_members between 1 and 9),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (semester_id, name),
  unique (id, semester_id)
);

create table if not exists public.group_members (
  group_id uuid not null,
  semester_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'leader')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  unique (semester_id, user_id),
  foreign key (group_id, semester_id)
    references public.groups(id, semester_id) on delete cascade
);

create unique index if not exists group_one_leader_idx
  on public.group_members (group_id) where role = 'leader';

create table if not exists public.group_membership_history (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_group_id uuid references public.groups(id) on delete set null,
  to_group_id uuid references public.groups(id) on delete set null,
  action text not null check (action in ('assigned', 'moved', 'removed', 'leader_changed', 'group_activated')),
  actor_email text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.enforce_group_capacity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  limit_members integer;
  current_members integer;
begin
  select max_members into limit_members from public.groups where id = new.group_id;
  if tg_op = 'UPDATE' then
    select count(*) into current_members
      from public.group_members
     where group_id = new.group_id
       and user_id <> old.user_id;
  else
    select count(*) into current_members
      from public.group_members
     where group_id = new.group_id;
  end if;
  if current_members >= limit_members then
    raise exception 'O grupo já atingiu o limite de % integrantes.', limit_members;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_group_capacity_trigger on public.group_members;
create trigger enforce_group_capacity_trigger
  before insert or update of group_id on public.group_members
  for each row execute procedure public.enforce_group_capacity();

create table if not exists public.demands (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete restrict,
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'open', 'development', 'review', 'published', 'voting', 'awaiting_results', 'closed')),
  voting_enabled boolean not null default true,
  ballot_visibility text not null default 'anonymous' check (ballot_visibility in ('anonymous', 'open')),
  late_submissions_allowed boolean not null default true,
  submission_opens_at timestamptz,
  submission_due_at timestamptz,
  publication_at timestamptz,
  voting_starts_at timestamptz,
  voting_ends_at timestamptz,
  results_published_at timestamptz,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.demand_groups (
  demand_id uuid not null references public.demands(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (demand_id, group_id)
);

create table if not exists public.demand_group_members (
  demand_id uuid not null,
  group_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('member', 'leader')),
  captured_at timestamptz not null default now(),
  primary key (demand_id, group_id, user_id),
  foreign key (demand_id, group_id)
    references public.demand_groups(demand_id, group_id) on delete cascade
);

create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.demands(id) on delete cascade,
  title text not null,
  instructions text not null default '',
  due_at timestamptz,
  position integer not null default 0,
  is_final boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.demand_group_extensions (
  demand_id uuid not null references public.demands(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  due_at timestamptz not null,
  reason text not null default '',
  granted_by text not null default '',
  granted_at timestamptz not null default now(),
  primary key (demand_id, group_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.demands(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete restrict,
  title text not null default '',
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'late', 'review', 'changes_requested', 'approved', 'published', 'archived')),
  main_image_url text,
  pdf_url text,
  external_links jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  last_edited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (demand_id, group_id)
);

create table if not exists public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  image_url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  edited_by uuid references auth.users(id) on delete set null,
  edited_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete restrict,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  notes text not null default '',
  is_late boolean not null default false,
  submitted_at timestamptz not null default now()
);

create table if not exists public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 20971520),
  created_at timestamptz not null default now()
);

create table if not exists public.voting_rounds (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.demands(id) on delete cascade,
  round_number integer not null default 1 check (round_number > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'open', 'closed', 'awaiting_results', 'published')),
  ballot_visibility text not null default 'anonymous' check (ballot_visibility in ('anonymous', 'open')),
  starts_at timestamptz,
  ends_at timestamptz,
  results_published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (demand_id, round_number)
);

create table if not exists public.round_projects (
  round_id uuid not null references public.voting_rounds(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  primary key (round_id, project_id)
);

create table if not exists public.ballots (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.voting_rounds(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voter_participation (
  round_id uuid not null references public.voting_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  ballot_id uuid unique references public.ballots(id) on delete set null,
  changes_used integer not null default 0 check (changes_used between 0 and 1),
  voted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid references public.semesters(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.enroll_new_profile_in_current_semester()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.semester_enrollments (semester_id, user_id, status)
  select id, new.id, 'pending'
    from public.semesters
   where status in ('draft', 'active')
   order by created_at desc
   limit 1
  on conflict (semester_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists enroll_profile_in_semester on public.profiles;
create trigger enroll_profile_in_semester
  after insert on public.profiles
  for each row execute procedure public.enroll_new_profile_in_current_semester();

-- A alocação é feita dentro do banco para que mover cartões nunca deixe o
-- participante sem vínculo por causa de uma falha entre duas requisições.
create or replace function public.admin_assign_group_member(
  p_semester_id uuid,
  p_user_id uuid,
  p_target_group_id uuid,
  p_actor_email text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  previous_group_id uuid;
  target_semester_id uuid;
  movement_action text;
begin
  perform 1 from public.semesters where id = p_semester_id and status <> 'closed' for update;
  if not found then
    raise exception 'O semestre está encerrado ou não existe.';
  end if;

  select group_id into previous_group_id
    from public.group_members
   where semester_id = p_semester_id and user_id = p_user_id
   for update;

  if p_target_group_id is not null then
    select semester_id into target_semester_id
      from public.groups
     where id = p_target_group_id and status <> 'archived'
     for update;
    if target_semester_id is distinct from p_semester_id then
      raise exception 'O grupo escolhido não pertence a este semestre.';
    end if;
  end if;

  if previous_group_id is not null and previous_group_id is distinct from p_target_group_id then
    delete from public.group_members
     where semester_id = p_semester_id and user_id = p_user_id;
  end if;

  if p_target_group_id is not null and previous_group_id is distinct from p_target_group_id then
    insert into public.group_members (group_id, semester_id, user_id, role)
    values (p_target_group_id, p_semester_id, p_user_id, 'member');
  end if;

  insert into public.semester_enrollments (semester_id, user_id, status, updated_at)
  values (p_semester_id, p_user_id, case when p_target_group_id is null then 'pending' else 'allocated' end, now())
  on conflict (semester_id, user_id) do update
    set status = excluded.status, updated_at = now();

  if previous_group_id is null and p_target_group_id is not null then
    movement_action := 'assigned';
  elsif previous_group_id is not null and p_target_group_id is null then
    movement_action := 'removed';
  elsif previous_group_id is distinct from p_target_group_id then
    movement_action := 'moved';
  else
    return;
  end if;

  insert into public.group_membership_history
    (semester_id, user_id, from_group_id, to_group_id, action, actor_email)
  values
    (p_semester_id, p_user_id, previous_group_id, p_target_group_id, movement_action, coalesce(p_actor_email, ''));
end;
$$;

create or replace function public.admin_set_group_leader(
  p_group_id uuid,
  p_user_id uuid,
  p_actor_email text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  selected_semester_id uuid;
begin
  select semester_id into selected_semester_id
    from public.group_members
   where group_id = p_group_id and user_id = p_user_id;
  if selected_semester_id is null then
    raise exception 'O líder precisa ser integrante do grupo.';
  end if;

  update public.group_members set role = 'member'
   where group_id = p_group_id and role = 'leader';
  update public.group_members set role = 'leader'
   where group_id = p_group_id and user_id = p_user_id;

  insert into public.group_membership_history
    (semester_id, user_id, to_group_id, action, actor_email)
  values
    (selected_semester_id, p_user_id, p_group_id, 'leader_changed', coalesce(p_actor_email, ''));
end;
$$;

revoke all on function public.admin_assign_group_member(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_set_group_leader(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_assign_group_member(uuid, uuid, uuid, text) to service_role;
grant execute on function public.admin_set_group_leader(uuid, uuid, text) to service_role;

alter table public.semesters enable row level security;
alter table public.semester_enrollments enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_membership_history enable row level security;
alter table public.demands enable row level security;
alter table public.demand_groups enable row level security;
alter table public.demand_group_members enable row level security;
alter table public.deliverables enable row level security;
alter table public.demand_group_extensions enable row level security;
alter table public.projects enable row level security;
alter table public.project_images enable row level security;
alter table public.project_versions enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.voting_rounds enable row level security;
alter table public.round_projects enable row level security;
alter table public.ballots enable row level security;
alter table public.voter_participation enable row level security;
alter table public.audit_logs enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files',
  'project-files',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.semesters (name, status, created_by)
values ('14ª Semana das Engenharias — 2026.2', 'draft', 'migração inicial')
on conflict (name) do nothing;

insert into public.semester_enrollments (semester_id, user_id, status)
select semester.id, profile.id, 'pending'
  from public.semesters semester
 cross join public.profiles profile
 where semester.name = '14ª Semana das Engenharias — 2026.2'
on conflict (semester_id, user_id) do nothing;
