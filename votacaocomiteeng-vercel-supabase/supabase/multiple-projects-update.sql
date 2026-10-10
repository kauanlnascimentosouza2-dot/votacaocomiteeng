-- V12: permite vários projetos do mesmo grupo na mesma demanda.
-- Seguro para os dados atuais: nenhum projeto, arquivo, voto ou usuário é removido.

alter table public.projects
  drop constraint if exists projects_demand_id_group_id_key;

create index if not exists projects_demand_group_idx
  on public.projects (demand_id, group_id);

-- Corrige apenas o texto padrão criado pelas versões anteriores.
update public.deliverables
set instructions = 'Envio final disponível para todos os integrantes do grupo.'
where is_final = true
  and instructions = 'Envio final realizado exclusivamente pelo líder do grupo.';
