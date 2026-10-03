-- V7: arquivos AutoCAD e envio direto ao Storage.
-- Execute uma vez, depois das migracoes anteriores. Nenhuma entrega existente e removida.

create table if not exists public.project_upload_intents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  deliverable_id uuid not null references public.deliverables(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  status text not null default 'pending' check (status in ('pending', 'used')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  used_at timestamptz
);

alter table public.project_upload_intents enable row level security;
create index if not exists project_upload_intents_user_idx on public.project_upload_intents(user_id, created_at desc);

alter table public.submission_files drop constraint if exists submission_files_size_bytes_check;
alter table public.submission_files add constraint submission_files_size_bytes_check
  check (size_bytes >= 0 and size_bytes <= 52428800);

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/octet-stream']
where id = 'project-files';
