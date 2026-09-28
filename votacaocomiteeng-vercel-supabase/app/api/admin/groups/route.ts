import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-request";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { user, allowed } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { semesterId?: string; name?: string };
  if (!body.semesterId || !body.name?.trim()) return NextResponse.json({ error: "Informe o nome do grupo." }, { status: 400 });
  const admin = createAdminClient();
  const { data: semester } = await admin.from("semesters").select("status").eq("id", body.semesterId).maybeSingle();
  if (!semester || semester.status === "closed") return NextResponse.json({ error: "Este semestre não aceita novos grupos." }, { status: 409 });
  const { data, error } = await admin.from("groups").insert({ semester_id: body.semesterId, name: body.name.trim(), max_members: 9 }).select().single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Já existe um grupo com esse nome." : "Não foi possível criar o grupo." }, { status: 400 });
  await admin.from("audit_logs").insert({ semester_id: body.semesterId, actor_user_id: user.id, actor_email: user.email ?? "", action: "group_created", entity_type: "group", entity_id: data.id, details: { name: data.name } });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, allowed } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { groupId?: string; name?: string; status?: "building" | "active" };
  if (!body.groupId) return NextResponse.json({ error: "Grupo inválido." }, { status: 400 });
  const admin = createAdminClient();
  const { data: group } = await admin.from("groups").select("semester_id, status").eq("id", body.groupId).maybeSingle();
  if (!group || group.status === "archived") return NextResponse.json({ error: "Grupo não encontrado ou arquivado." }, { status: 404 });
  const { data: semester } = await admin.from("semesters").select("status").eq("id", group.semester_id).maybeSingle();
  if (!semester || semester.status === "closed") return NextResponse.json({ error: "O semestre está encerrado." }, { status: 409 });

  if (body.status === "active") {
    const { count } = await admin.from("group_members").select("user_id", { count: "exact", head: true }).eq("group_id", body.groupId);
    const { data: leader } = await admin.from("group_members").select("user_id").eq("group_id", body.groupId).eq("role", "leader").maybeSingle();
    if (!count) return NextResponse.json({ error: "Adicione pelo menos um integrante antes de ativar o grupo." }, { status: 409 });
    if (!leader) return NextResponse.json({ error: "Escolha o líder antes de ativar o grupo." }, { status: 409 });
  }
  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name?.trim()) changes.name = body.name.trim();
  if (body.status) {
    changes.status = body.status;
    if (body.status === "active") changes.activated_at = new Date().toISOString();
  }
  const { error } = await admin.from("groups").update(changes).eq("id", body.groupId);
  if (error) return NextResponse.json({ error: "Não foi possível atualizar o grupo." }, { status: 400 });
  if (body.status === "active") {
    const { data: members } = await admin.from("group_members").select("user_id").eq("group_id", body.groupId);
    if (members?.length) await admin.from("semester_enrollments").update({ status: "allocated", updated_at: new Date().toISOString() }).eq("semester_id", group.semester_id).in("user_id", members.map((member) => member.user_id));
    await admin.from("group_membership_history").insert((members ?? []).map((member) => ({ semester_id: group.semester_id, user_id: member.user_id, to_group_id: body.groupId, action: "group_activated", actor_email: user.email ?? "" })));
  }
  await admin.from("audit_logs").insert({ semester_id: group.semester_id, actor_user_id: user.id, actor_email: user.email ?? "", action: body.status === "active" ? "group_activated" : "group_updated", entity_type: "group", entity_id: body.groupId });
  return NextResponse.json({ ok: true });
}
