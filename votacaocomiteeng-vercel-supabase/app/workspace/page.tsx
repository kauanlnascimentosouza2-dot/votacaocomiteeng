import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import AppSidebar from "@/components/app-sidebar";
import { currentUserView } from "@/lib/current-user-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ProjectBoard from "./project-board";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sidebarUser = await currentUserView(user);
  const admin = createAdminClient();
  const { data: semester } = await admin.from("semesters").select("*").eq("status", "active").maybeSingle();
  if (!semester) return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content"><WorkspaceState title="Nenhum semestre ativo" text="O administrador ainda não iniciou o ambiente de trabalho."/></main></div>;

  const { data: enrollment } = await admin.from("semester_enrollments").select("status").eq("semester_id", semester.id).eq("user_id", user.id).maybeSingle();
  const { data: membership } = await admin.from("group_members").select("group_id, role").eq("semester_id", semester.id).eq("user_id", user.id).maybeSingle();
  if (!enrollment || enrollment.status === "pending" || !membership) return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content"><WorkspaceState title="Aguardando alocação" text="Seu cadastro está confirmado. O administrador ainda precisa colocar você em um grupo." semester={semester.name}/></main></div>;

  const { data: group } = await admin.from("groups").select("*").eq("id", membership.group_id).maybeSingle();
  if (!group || group.status !== "active") return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content"><WorkspaceState title="Grupo em preparação" text="Você já foi alocado, mas o administrador ainda não ativou o grupo." semester={semester.name}/></main></div>;

  const [{ data: assignments }, { data: memberRows }] = await Promise.all([
    admin.from("demand_groups").select("demand_id").eq("group_id", group.id),
    admin.from("group_members").select("user_id, role").eq("group_id", group.id),
  ]);
  const demandIds = (assignments ?? []).map((item) => item.demand_id);
  const [{ data: demands }, { data: projects }, { data: profiles }] = await Promise.all([
    demandIds.length ? admin.from("demands").select("*").in("id", demandIds).neq("status", "closed").order("submission_due_at") : Promise.resolve({ data: [] }),
    demandIds.length ? admin.from("projects").select("*").eq("group_id", group.id).in("demand_id", demandIds).order("created_at") : Promise.resolve({ data: [] }),
    admin.from("profiles").select("id, name, email").in("id", (memberRows ?? []).map((member) => member.user_id)),
  ]);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return <div className="app-frame">
    <AppSidebar user={sidebarUser}/>
    <main className="app-content workspace-portal">
      <div className="portal-main">
        <section className="portal-heading">
          <div><span className="semester-state active">Ambiente liberado</span><h1>Área do grupo</h1><p>Crie, desenvolva e envie quantos projetos forem necessários para cada demanda.</p></div>
          <aside><Users/><div><strong>{memberRows?.length ?? 0} integrantes</strong><span>{membership.role === "leader" ? "Você é o líder" : `Líder: ${leaderName(memberRows ?? [], profileById)}`}</span></div></aside>
        </section>
        <section className="team-strip">
          {(memberRows ?? []).map((member) => {
            const profile = profileById.get(member.user_id);
            return <div key={member.user_id}><span>{initials(profile?.name || profile?.email || "P")}</span><div><strong>{profile?.name || profile?.email}</strong><small>{member.role === "leader" ? "Líder" : "Integrante"}</small></div></div>;
          })}
        </section>
        <ProjectBoard demands={demands ?? []} projects={projects ?? []}/>
      </div>
    </main>
  </div>;
}

function WorkspaceState({ title, text, semester }: { title: string; text: string; semester?: string }) {
  return <main className="portal-waiting"><img src="/logo-comite.png" alt="Comitê de Engenharias"/><span className="semester-state draft">{semester ?? "Ambiente de projetos"}</span><h1>{title}</h1><p>{text}</p><Link className="secondary-button link-button" href="/">Voltar</Link></main>;
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function leaderName(members: Array<{ user_id: string; role: string }>, profiles: Map<string, { name: string; email: string }>) { const leader = members.find((member) => member.role === "leader"); const profile = leader ? profiles.get(leader.user_id) : null; return profile?.name || profile?.email || "não definido"; }
