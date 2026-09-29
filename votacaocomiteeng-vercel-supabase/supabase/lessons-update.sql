-- Aulas por edição. Execute após semester-workflow.sql e experience-update.sql.
-- Migração aditiva: não altera projetos, grupos ou votos existentes.

create table if not exists public.lesson_folders (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete restrict,
  parent_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, semester_id),
  foreign key (parent_id, semester_id) references public.lesson_folders(id, semester_id) on delete restrict,
  check (parent_id is null or parent_id <> id)
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete restrict,
  folder_id uuid not null,
  title text not null check (char_length(trim(title)) between 3 and 160),
  content text not null default '',
  video_url text not null,
  status text not null default 'published' check (status in ('published', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (folder_id, semester_id) references public.lesson_folders(id, semester_id) on delete restrict
);

alter table public.lesson_folders enable row level security;
alter table public.lessons enable row level security;

create index if not exists lesson_folders_semester_parent_idx on public.lesson_folders(semester_id, parent_id, name);
create index if not exists lessons_semester_folder_idx on public.lessons(semester_id, folder_id, created_at);
