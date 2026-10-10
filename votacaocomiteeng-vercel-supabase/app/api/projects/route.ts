import { NextResponse } from "next/server";
import { createActivityNotifications } from "@/lib/activity-notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { demandId?: string };
  if (!body.demandId) return NextResponse.json({ error: "Demanda inválida." }, { status: 400 });

  const admin = createAdminClient();
  const { data: demand } = await admin
    .from("demands")
    .select("id,title,semester_id,status")
    .eq("id", body.demandId)
    .maybeSingle();
  if (!demand) return NextResponse.json({ error: "Demanda não encontrada." }, { status: 404 });
  if (demand.status === "closed") return NextResponse.json({ error: "Esta demanda já foi encerrada." }, { status: 409 });

  const { data: membership } = await admin
    .from("group_members")
    .select("group_id,groups!inner(status)")
    .eq("semester_id", demand.semester_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const groupStatus = (membership?.groups as unknown as { status?: string } | null)?.status;
  if (!membership || groupStatus !== "active") return NextResponse.json({ error: "Você precisa pertencer a um grupo ativo." }, { status: 403 });

  const { data: assignment } = await admin
    .from("demand_groups")
    .select("demand_id")
    .eq("demand_id", demand.id)
    .eq("group_id", membership.group_id)
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: "Esta demanda não foi atribuída ao seu grupo." }, { status: 403 });

  const { data: project, error } = await admin
    .from("projects")
    .insert({ demand_id: demand.id, group_id: membership.group_id })
    .select("id")
    .single();
  if (error || !project) {
    const needsMigration = error?.code === "23505";
    return NextResponse.json({
      error: needsMigration
        ? "Execute a atualização V12 do Supabase antes de adicionar outro projeto."
        : "Não foi possível criar o projeto.",
    }, { status: needsMigration ? 409 : 500 });
  }

  await admin.from("audit_logs").insert({
    semester_id: demand.semester_id,
    actor_user_id: user.id,
    actor_email: user.email ?? "",
    action: "project_created",
    entity_type: "project",
    entity_id: project.id,
    details: { demand_id: demand.id, group_id: membership.group_id },
  });

  const { data: memberRows } = await admin.from("group_members").select("user_id").eq("group_id", membership.group_id);
  await createActivityNotifications({
    semesterId: demand.semester_id,
    recipientIds: (memberRows ?? []).map((member) => member.user_id).filter((id) => id !== user.id),
    eventKey: `project:${project.id}:created`,
    kind: "demand",
    title: `Novo projeto: ${demand.title}`,
    message: "Um integrante do grupo adicionou outro projeto à demanda.",
    href: `/workspace/projects/${project.id}`,
    origin: new URL(request.url).origin,
  });

  return NextResponse.json({ id: project.id }, { status: 201 });
}
