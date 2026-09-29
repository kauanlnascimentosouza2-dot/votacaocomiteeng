-- Etapa 2: perfil, cronograma, comunidade "Nós" e lembretes.
-- Migração aditiva: não remove usuários, grupos, projetos, propostas ou votos.

alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists team_name text not null default 'Manufatura';
alter table public.profiles add column if not exists course text;
alter table public.profiles add column if not exists academic_period text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists specialty text;
alter table public.profiles add column if not exists skills text[] not null default '{}';
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists linkedin_url text;
alter table public.profiles add column if not exists portfolio_url text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid references public.semesters(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'custom' check (category in ('demand', 'delivery', 'voting', 'publication', 'custom')),
  audience text not null default 'all' check (audience in ('all', 'groups', 'admins')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  status text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_event_groups (
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (event_id, group_id)
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  reminder_kind text not null check (reminder_kind in ('three_days', 'one_day', 'today', 'overdue')),
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, event_key, reminder_kind)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  title text not null,
  content text not null,
  post_type text not null default 'update' check (post_type in ('update', 'activity', 'achievement', 'challenge')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  moderation_note text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  image_path text not null,
  caption text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.enforce_community_image_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  image_count integer;
begin
  select count(*) into image_count from public.community_post_images where post_id = new.post_id;
  if image_count >= 10 then
    raise exception 'Cada publicação pode ter no máximo 10 fotos.';
  end if;
  return new;
end;
$$;

drop trigger if exists community_image_limit_trigger on public.community_post_images;
create trigger community_image_limit_trigger before insert on public.community_post_images
for each row execute procedure public.enforce_community_image_limit();

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  status text not null default 'published' check (status in ('published', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;
alter table public.calendar_event_groups enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_post_images enable row level security;
alter table public.community_comments enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-images', 'profile-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('community-media', 'community-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create index if not exists calendar_events_semester_starts_idx on public.calendar_events (semester_id, starts_at);
create index if not exists community_posts_semester_status_idx on public.community_posts (semester_id, status, created_at desc);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);
