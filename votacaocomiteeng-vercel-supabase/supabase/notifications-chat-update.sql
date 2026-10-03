-- Avisos de atividades e chat geral por edição.
-- Execute após semester-workflow.sql, experience-update.sql e lessons-update.sql.
-- Esta migração não apaga dados existentes.

alter table public.profiles add column if not exists notification_email text;

create table if not exists public.activity_notifications (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  kind text not null check (kind in ('demand', 'lesson', 'calendar')),
  title text not null,
  message text not null default '',
  href text not null,
  read_at timestamptz,
  email_status text not null default 'pending' check (email_status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  email_to text,
  email_error text,
  email_attempts integer not null default 0,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);

create table if not exists public.general_chat_messages (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete restrict,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  status text not null default 'published' check (status in ('published', 'deleted')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.activity_notifications enable row level security;
alter table public.general_chat_messages enable row level security;

create index if not exists activity_notifications_user_created_idx on public.activity_notifications(user_id, created_at desc);
create index if not exists general_chat_messages_semester_created_idx on public.general_chat_messages(semester_id, created_at desc);
