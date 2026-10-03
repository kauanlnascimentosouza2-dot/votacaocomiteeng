import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityNotifications } from "@/lib/activity-notifications";

type DemandInput = {
  semesterId?: string;
  title?: string;
  description?: string;
  groupIds?: string[];
  votingEnabled?: boolean;
  ballotVisibility?: "anonymous" | "open";
  submissionOpensAt?: string | null;
  submissionDueAt?: string | null;
  publicationAt?: string | null;
  votingStartsAt?: string | null;
  votingEndsAt?: string | null;
  deliverables?: Array<{ title?: string; instructions?: string; dueAt?: string | null }>;
};

export async function POST(request: Request) {
  const { user, allowed } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as DemandInput;
  const title = body.title?.trim() ?? "";
  const groupIds = [...new Set(body.groupIds ?? [])];
  if (!body.semesterId || title.length < 3) return NextResponse.json({ error: "Informe o título da demanda." }, { status: 400 });
  if (!groupIds.length) return NextResponse.json({ error: "Selecione pelo menos um grupo participante." }, { status: 400 });
  if (body.submissionDueAt && body.submissionOpensAt && new Date(body.submissionDueAt) <= new Date(body.submissionOpensAt)) return NextResponse.json({ error: "O prazo final deve ser posterior à abertura." }, { status: 400 });

  const admin = createAdminClient();
  const { data: semester } = await admin.from("semesters").select("status").eq("id", body.semesterId).maybeSingle();
  if (!semester || semester.status === "closed") return NextResponse.json({ error: "O semestre está encerrado ou não existe." }, { status: 409 });
  const { data: validGroups } = await admin.from("groups").select("id").eq("semester_id", body.semesterId).eq("status", "active").in("id", groupIds);
  if ((validGroups?.length ?? 0) !== groupIds.length) return NextResponse.json({ error: "Todas as equipes selecionadas precisam estar ativas." }, { status: 409 });

  const now = new Date();
  const opens = body.submissionOpensAt ? new Date(body.submissionOpensAt) : null;
  const status = opens && opens > now ? "scheduled" : "open";
  const { data: demand, error } = await admin.from("demands").insert({
    semester_id: body.semesterId,
    title,
    description: body.description?.trim() ?? "",
    status,
    voting_enabled: body.votingEnabled ?? true,
    ballot_visibility: body.ballotVisibility ?? "anonymous",
    submission_opens_at: body.submissionOpensAt || null,
    submission_due_at: body.submissionDueAt || null,
    publication_at: body.publicationAt || null,
    voting_starts_at: body.votingEnabled ? body.votingStartsAt || null : null,
    voting_ends_at: body.votingEnabled ? body.votingEndsAt || null : null,
    created_by: user.email ?? "",
  }).select().single();
  if (error || !demand) return NextResponse.json({ error: "Não foi possível criar a demanda." }, { status: 400 });

  const assignments = groupIds.map((groupId) => ({ demand_id: demand.id, group_id: groupId }));
  const { error: assignmentError } = await admin.from("demand_groups").insert(assignments);
  if (assignmentError) {
    await admin.from("demands").delete().eq("id", demand.id);
    return NextResponse.json({ error: "Não foi possível vincular os grupos à demanda." }, { status: 400 });
  }
  const { data: memberRows } = await admin.from("group_members").select("group_id, user_id, role").in("group_id", groupIds);
  if (memberRows?.length) await admin.from("demand_group_members").insert(memberRows.map((member) => ({ demand_id: demand.id, group_id: member.group_id, user_id: member.user_id, role: member.role })));
  await admin.from("projects").insert(groupIds.map((groupId) => ({ demand_id: demand.id, group_id: groupId })));

  const intermediate = (body.deliverables ?? []).filter((item) => item.title?.trim()).map((item, position) => ({ demand_id: demand.id, title: item.title!.trim(), instructions: item.instructions?.trim() ?? "", due_at: item.dueAt || null, position, is_final: false }));
  await admin.from("deliverables").insert([...intermediate, { demand_id: demand.id, title: "Entrega final", instructions: "Envio final realizado exclusivamente pelo líder do grupo.", due_at: body.submissionDueAt || null, position: intermediate.length, is_final: true }]);
  await admin.from("audit_logs").insert({ semester_id: body.semesterId, actor_user_id: user.id, actor_email: user.email ?? "", action: "demand_created", entity_type: "demand", entity_id: demand.id, details: { groups: groupIds } });
  await createActivityNotifications({ semesterId: body.semesterId, recipientIds: (memberRows ?? []).map(member => member.user_id), eventKey: `demand:${demand.id}`, kind: "demand", title: `Nova demanda: ${title}`, message: "Uma nova demanda foi atribuída ao seu grupo.", href: "/workspace", origin: new URL(request.url).origin });
  return NextResponse.json(demand, { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, allowed } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { demandId?: string; action?: "close" | "publish-results" };
  if (!body.demandId || !body.action) return NextResponse.json({ error: "Demanda inválida." }, { status: 400 });
  const admin = createAdminClient();
  const { data: demand } = await admin.from("demands").select("semester_id").eq("id", body.demandId).maybeSingle();
  if (!demand) return NextResponse.json({ error: "Demanda não encontrada." }, { status: 404 });
  const changes = body.action === "close" ? { status: "closed", updated_at: new Date().toISOString() } : { results_published_at: new Date().toISOString(), status: "closed", updated_at: new Date().toISOString() };
  const { error } = await admin.from("demands").update(changes).eq("id", body.demandId);
  if (error) return NextResponse.json({ error: "Não foi possível atualizar a demanda." }, { status: 400 });
  await admin.from("audit_logs").insert({ semester_id: demand.semester_id, actor_user_id: user.id, actor_email: user.email ?? "", action: `demand_${body.action}`, entity_type: "demand", entity_id: body.demandId });
  return NextResponse.json({ ok: true });
}
