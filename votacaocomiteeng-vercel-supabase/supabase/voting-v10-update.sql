-- Execute após semester-workflow.sql. Mantém votos e projetos existentes.
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
create or replace function public.cast_project_ballot(p_round uuid, p_project uuid, p_user uuid, p_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r public.voting_rounds; d public.demands; v public.voter_participation; own_group uuid; target_group uuid;
begin
  select * into r from voting_rounds where id=p_round for update;
  if not found or r.status not in ('scheduled','open') or r.starts_at>now() or r.ends_at<=now() then raise exception 'Esta votação não está aberta.'; end if;
  select * into d from demands where id=r.demand_id;
  if d.status='closed' or not exists(select 1 from semesters where id=d.semester_id and status='active') then raise exception 'Esta votação está encerrada.'; end if;
  select gm.group_id into own_group from group_members gm join groups g on g.id=gm.group_id where gm.semester_id=d.semester_id and gm.user_id=p_user and g.status='active';
  if not p_admin and own_group is null then raise exception 'A votação exige alocação em um grupo ativo.'; end if;
  select p.group_id into target_group from round_projects rp join projects p on p.id=rp.project_id where rp.round_id=p_round and p.id=p_project;
  if target_group is null then raise exception 'Projeto fora desta votação.'; end if;
  if target_group=own_group or exists(select 1 from demand_group_members where demand_id=d.id and user_id=p_user and group_id=target_group) then raise exception 'Você não pode votar no projeto do próprio grupo.'; end if;
  select * into v from voter_participation where round_id=p_round and user_id=p_user;
  if found then
    if v.changes_used>=1 then raise exception 'Você já utilizou a única alteração permitida.'; end if;
    if exists(select 1 from ballots where id=v.ballot_id and project_id=p_project) then raise exception 'Este já é seu voto atual.'; end if;
    update ballots set project_id=p_project,updated_at=now() where id=v.ballot_id;
    update voter_participation set changes_used=1,updated_at=now() where round_id=p_round and user_id=p_user;
  else
    insert into ballots(round_id,project_id) values(p_round,p_project) returning id into v.ballot_id;
    insert into voter_participation(round_id,user_id,group_id,ballot_id,voted_at) values(p_round,p_user,own_group,v.ballot_id,now());
  end if;
end $$;
revoke all on function public.cast_project_ballot(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.cast_project_ballot(uuid,uuid,uuid,boolean) to service_role;

create or replace function public.manage_project_round(p_action text,p_demand uuid,p_round uuid,p_projects uuid[],p_start timestamptz,p_end timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare d public.demands; r public.voting_rounds; new_id uuid; n integer; winners uuid[]; top_count bigint;
begin
  if p_action='create' then
    select * into d from demands where id=p_demand for update;
    if not found or not d.voting_enabled or d.status='closed' then raise exception 'Selecione uma demanda aberta com votação habilitada.'; end if;
    if not exists(select 1 from semesters where id=d.semester_id and status='active') then raise exception 'Ative o semestre da demanda.'; end if;
    if p_start is null or p_end is null or p_end<=p_start or p_end<=now() then raise exception 'Informe início e fim válidos.'; end if;
    if d.publication_at is not null and p_start<d.publication_at then raise exception 'A votação deve começar após a data de publicação dos projetos.'; end if;
    if exists(select 1 from voting_rounds where demand_id=d.id and status in ('scheduled','open') and ends_at>now()) then raise exception 'Esta demanda já tem uma votação em andamento.'; end if;
    select count(distinct p.id) into n from projects p where p.id=any(p_projects) and p.demand_id=d.id and p.status in ('approved','published');
    if n<2 or n<>cardinality(p_projects) then raise exception 'Selecione pelo menos dois projetos aprovados da mesma demanda.'; end if;
    insert into voting_rounds(demand_id,round_number,status,ballot_visibility,starts_at,ends_at)
      values(d.id,coalesce((select max(round_number) from voting_rounds where demand_id=d.id),0)+1,'scheduled',d.ballot_visibility,p_start,p_end) returning id into new_id;
    insert into round_projects select new_id,unnest(p_projects);
    return new_id;
  end if;
  select * into r from voting_rounds where id=p_round for update;
  if not found then raise exception 'Votação não encontrada.'; end if;
  select * into d from demands where id=r.demand_id for update;
  if p_action='close' then
    update voting_rounds set status='closed',ends_at=least(coalesce(ends_at,now()),now()) where id=r.id;
  elsif p_action='publish' then
    if r.status in ('scheduled','open') and (r.ends_at is null or r.ends_at>now()) then raise exception 'Encerre a votação antes de liberar os resultados.'; end if;
    update voting_rounds set status='published',results_published_at=now() where id=r.id;
  elsif p_action='tie' then
    if r.status in ('scheduled','open') and (r.ends_at is null or r.ends_at>now()) then raise exception 'Encerre a votação antes do desempate.'; end if;
    if p_start is null or p_end is null or p_end<=p_start or p_end<=now() then raise exception 'Informe as datas do desempate.'; end if;
    if exists(select 1 from voting_rounds where demand_id=d.id and status in ('scheduled','open') and ends_at>now()) then raise exception 'Já existe uma rodada em andamento.'; end if;
    select max(total) into top_count from (select count(b.id) total from round_projects rp left join ballots b on b.round_id=rp.round_id and b.project_id=rp.project_id where rp.round_id=r.id group by rp.project_id) totals;
    select array_agg(project_id) into winners from (select rp.project_id from round_projects rp left join ballots b on b.round_id=rp.round_id and b.project_id=rp.project_id where rp.round_id=r.id group by rp.project_id having count(b.id)=top_count) ties;
    if top_count=0 or cardinality(winners)<2 then raise exception 'Não há empate com votos registrados para desempatar.'; end if;
    if d.status='closed' then raise exception 'A demanda está encerrada.'; end if;
    insert into voting_rounds(demand_id,round_number,status,ballot_visibility,starts_at,ends_at) values(d.id,(select max(round_number)+1 from voting_rounds where demand_id=d.id),'scheduled',r.ballot_visibility,p_start,p_end) returning id into new_id;
    insert into round_projects select new_id,unnest(winners);
    return new_id;
  else raise exception 'Ação inválida.';
  end if;
  return r.id;
end $$;
revoke all on function public.manage_project_round(text,uuid,uuid,uuid[],timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.manage_project_round(text,uuid,uuid,uuid[],timestamptz,timestamptz) to service_role;
