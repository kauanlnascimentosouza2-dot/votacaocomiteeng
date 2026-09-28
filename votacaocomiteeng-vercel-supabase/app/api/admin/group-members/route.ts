import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-request";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { user, allowed } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { semesterId?: string; userId?: string; groupId?: string | null };
  if (!body.semesterId || !body.userId) return NextResponse.json({ error: "Participante ou semestre inválido." }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_assign_group_member", {
    p_semester_id: body.semesterId,
    p_user_id: body.userId,
    p_target_group_id: body.groupId || null,
    p_actor_email: user.email ?? "",
  });
  if (error) return NextResponse.json({ error: error.message || "Não foi possível mover o participante." }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const { user, allowed } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { groupId?: string; userId?: string };
  if (!body.groupId || !body.userId) return NextResponse.json({ error: "Grupo ou líder inválido." }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_set_group_leader", { p_group_id: body.groupId, p_user_id: body.userId, p_actor_email: user.email ?? "" });
  if (error) return NextResponse.json({ error: error.message || "Não foi possível escolher o líder." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
