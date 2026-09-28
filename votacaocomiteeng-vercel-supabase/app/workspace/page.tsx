import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Clock3, FolderKanban, LogOut, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const { data: semester } = await admin.from("semesters").select("*").eq("status", "active").maybeSingle();
  if (!semester) return <WorkspaceState title="Nenhum semestre ativo" text="O administrador ainda não iniciou o ambiente de trabalho."/>;
  const { data: enrollment } = await admin.from("semester_enrollments").select("status").eq("semester_id", semester.id).eq("user_id", user.id).maybeSingle();
  const { data: membership } = await admin.from("group_members").select("group_id, role").eq("semester_id", semester.id).eq("user_id", user.id).maybeSingle();
  if (!enrollment || enrollment.status === "pending" || !membership) return <WorkspaceState title="Aguardando alocação" text="Seu cadastro está confirmado. O administrador ainda precisa colocar você em um grupo." semester={semester.name}/>;
  const { data: group } = await admin.from("groups").select("*").eq("id", membership.group_id).maybeSingle();
  if (!group || group.status !== "active") return <WorkspaceState title="Grupo em preparação" text="Você já foi alocado, mas o administrador ainda não ativou o grupo." semester={semester.name}/>;
  const [{ data: assignments }, { data: memberRows }] = await Promise.all([
    admin.from("demand_groups").select("demand_id").eq("group_id", group.id),
    admin.from("group_members").select("user_id, role").eq("group_id", group.id),
  ]);
  const demandIds = (assignments ?? []).map((item) => item.demand_id);
  const [{ data: demands }, { data: projects }, { data: profiles }] = await Promise.all([
    demandIds.length ? admin.from("demands").select("*").in("id", demandIds).neq("status", "closed").order("submission_due_at") : Promise.resolve({ data: [] }),
    demandIds.length ? admin.from("projects").select("*").eq("group_id", group.id).in("demand_id", demandIds) : Promise.resolve({ data: [] }),
    admin.from("profiles").select("id, name, email").in("id", (memberRows ?? []).map((member) => member.user_id)),
  ]);
  const projectByDemand = new Map((projects ?? []).map((project) => [project.demand_id, project]));
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return <div className="workspace-portal"><header className="portal-header"><div><img src="/logo-comite.png" alt="Comitê de Engenharias"/><span><strong>{group.name}</strong><small>{semester.name}</small></span></div><nav><Link href="/">Votação atual</Link><span>{user.email}</span><form action="/auth/signout" method="post"><button title="Sair"><LogOut/></button></form></nav></header><main className="portal-main"><section className="portal-heading"><div><span className="semester-state active">Ambiente liberado</span><h1>Área do grupo</h1><p>Projetos, entregas e prazos atribuídos à sua equipe.</p></div><aside><Users/><div><strong>{memberRows?.length ?? 0} integrantes</strong><span>{membership.role === "leader" ? "Você é o líder" : `Líder: ${leaderName(memberRows ?? [], profileById)}`}</span></div></aside></section><section className="team-strip">{(memberRows ?? []).map((member) => { const profile = profileById.get(member.user_id); return <div key={member.user_id}><span>{initials(profile?.name || profile?.email || "P")}</span><div><strong>{profile?.name || profile?.email}</strong><small>{member.role === "leader" ? "Líder" : "Integrante"}</small></div></div>; })}</section><section className="project-section"><div className="board-toolbar"><div><h2>Demandas do grupo</h2><p>{demands?.length ?? 0} trabalho(s) em andamento</p></div></div><div className="workspace-project-grid">{(demands ?? []).map((demand) => { const project = projectByDemand.get(demand.id); if (!project) return null; const late = demand.submission_due_at && new Date() > new Date(demand.submission_due_at) && !["submitted","approved","published"].includes(project.status); return <article className="workspace-project-card" key={demand.id}><div className="project-card-top"><span className={`demand-status ${late ? "late" : demand.status}`}>{late ? "Prazo vencido" : demandLabel(demand.status)}</span><FolderKanban/></div><h2>{demand.title}</h2><p>{demand.description}</p><div className="project-deadline"><Clock3/><span><small>Entrega final</small><strong>{demand.submission_due_at ? new Date(demand.submission_due_at).toLocaleString("pt-BR") : "Sem prazo"}</strong></span></div><div className="project-card-footer"><span className={`project-state ${project.status}`}>{projectLabel(project.status)}</span><Link className="primary-button" href={`/workspace/projects/${project.id}`}>Abrir projeto</Link></div></article>; })}{!demands?.length && <div className="panel empty-demand"><FolderKanban/><p>O administrador ainda não atribuiu nenhuma demanda ao grupo.</p></div>}</div></section></main></div>;
}

function WorkspaceState({ title, text, semester }: { title: string; text: string; semester?: string }) { return <main className="portal-waiting"><img src="/logo-comite.png" alt="Comitê de Engenharias"/><span className="semester-state draft">{semester ?? "Ambiente de projetos"}</span><h1>{title}</h1><p>{text}</p><Link className="secondary-button link-button" href="/">Voltar</Link></main>; }
function initials(name: string) { return name.split(/\s+/).slice(0,2).map((part) => part[0]).join("").toUpperCase(); }
function leaderName(members: Array<{ user_id: string; role: string }>, profiles: Map<string, { name: string; email: string }>) { const leader = members.find((member) => member.role === "leader"); const profile = leader ? profiles.get(leader.user_id) : null; return profile?.name || profile?.email || "não definido"; }
function demandLabel(status: string) { const map: Record<string,string> = { scheduled:"Agendada",open:"Aberta",development:"Em desenvolvimento",review:"Em revisão",published:"Publicada",voting:"Em votação",awaiting_results:"Resultado pendente" }; return map[status] ?? status; }
function projectLabel(status: string) { const map: Record<string,string> = { draft:"Em edição",submitted:"Entregue",late:"Entregue com atraso",review:"Em análise",changes_requested:"Ajustes solicitados",approved:"Aprovado",published:"Publicado" }; return map[status] ?? status; }
