-- Prazos de Manufatura extraidos da imagem enviada pelo administrador.
-- Execute depois de experience-update.sql. Nao altera projetos, entregas nem votos.
-- Datas sem horario informado sao exibidas como eventos de dia inteiro.

alter table public.calendar_events add column if not exists all_day boolean not null default false;
alter table public.calendar_events add column if not exists external_key text;
create unique index if not exists calendar_events_external_key_idx
  on public.calendar_events (semester_id, external_key) where external_key is not null;

do $$
declare target_semester_id uuid;
begin
  select id into target_semester_id
  from public.semesters
  where name = '14ª Semana das Engenharias — 2026.2' and status = 'active'
  limit 1;
  if target_semester_id is null then
    raise exception 'A 14ª Semana das Engenharias — 2026.2 precisa estar ativa antes de importar os prazos.';
  end if;

  insert into public.calendar_events
    (semester_id, title, description, category, audience, starts_at, all_day, external_key)
  select target_semester_id, task.title,
    'Vencimento da tarefa de Manufatura. A imagem original informa apenas a data, sem horário.',
    'delivery', 'all',
    (task.due_date::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo',
    true, 'manufatura-2026:' || task.task_number
  from (values
    (11, 'Embalagem e identificação', date '2026-11-26'),
    (12, 'Inspeção 100% e contagem', date '2026-11-25'),
    (13, 'Acabamento e retrabalho final', date '2026-11-24'),
    (14, 'Fechamento da fabricação', date '2026-11-20'),
    (15, 'Fechamento de produção', date '2026-11-17'),
    (16, 'Protótipo inicial', date '2026-09-22'),
    (17, 'Microprodução', date '2026-09-29'),
    (18, 'Montagem progressiva', date '2026-11-10'),
    (19, 'Lote 4 — produção principal', date '2026-11-03'),
    (20, 'Produção piloto', date '2026-10-06'),
    (21, 'Lote 3 — peças e bases', date '2026-10-27'),
    (22, 'Produção - Lote 01', date '2026-10-13'),
    (23, 'Lote 2 — corte e gravação', date '2026-10-20')
  ) as task(task_number, title, due_date)
  on conflict do nothing;
end $$;
