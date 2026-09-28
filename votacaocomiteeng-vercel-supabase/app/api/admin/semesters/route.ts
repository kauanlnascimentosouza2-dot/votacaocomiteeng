import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-request";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { user, allowed } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { name?: string; startsAt?: string | null; endsAt?: string | null };
  const name = body.name?.trim() ?? "";
  if (name.length < 4) return NextResponse.json({ error: "Informe o nome do semestre." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("semesters").insert({
    name,
    starts_at: body.startsAt || null,
    ends_at: body.endsAt || null,
    created_by: user.email ?? "",
  }).select().single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Já existe um semestre com esse nome." : "Não foi possível criar o semestre." }, { status: 400 });

  const { data: profiles } = await admin.from("profiles").select("id");
  if (profiles?.length) {
    const { error: enrollmentError } = await admin.from("semester_enrollments").upsert(
      profiles.map((profile) => ({ semester_id: data.id, user_id: profile.id, status: "pending" })),
      { onConflict: "semester_id,user_id" },
    );
    if (enrollmentError) return NextResponse.json({ error: "O semestre foi criado, mas não foi possível matricular os participantes atuais." }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, allowed } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { semesterId?: string; action?: "update" | "start" | "close"; name?: string; startsAt?: string | null; endsAt?: string | null };
  if (!body.semesterId) return NextResponse.json({ error: "Semestre inválido." }, { status: 400 });
  const admin = createAdminClient();
  const { data: semester } = await admin.from("semesters").select("status").eq("id", body.semesterId).maybeSingle();
  if (!semester) return NextResponse.json({ error: "Semestre não encontrado." }, { status: 404 });

  let changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.action === "start") {
    if (semester.status === "closed") return NextResponse.json({ error: "Um semestre encerrado não pode ser reaberto." }, { status: 409 });
    const { data: active } = await admin.from("semesters").select("id, name").eq("status", "active").neq("id", body.semesterId).maybeSingle();
    if (active) return NextResponse.json({ error: `Encerre “${active.name}” antes de iniciar outro semestre.` }, { status: 409 });
    changes = { ...changes, status: "active", started_at: new Date().toISOString() };
  } else if (body.action === "close") {
    changes = { ...changes, status: "closed", closed_at: new Date().toISOString() };
  } else {
    if (semester.status === "closed") return NextResponse.json({ error: "Semestres encerrados permanecem somente para consulta." }, { status: 409 });
    if (!body.name?.trim()) return NextResponse.json({ error: "Informe o nome do semestre." }, { status: 400 });
    changes = { ...changes, name: body.name.trim(), starts_at: body.startsAt || null, ends_at: body.endsAt || null };
  }

  const { error } = await admin.from("semesters").update(changes).eq("id", body.semesterId);
  if (error) return NextResponse.json({ error: "Não foi possível atualizar o semestre." }, { status: 400 });
  if (body.action === "close") {
    await Promise.all([
      admin.from("groups").update({ status: "archived", updated_at: new Date().toISOString() }).eq("semester_id", body.semesterId),
      admin.from("demands").update({ status: "closed", updated_at: new Date().toISOString() }).eq("semester_id", body.semesterId).neq("status", "closed"),
    ]);
  }
  await admin.from("audit_logs").insert({ semester_id: body.semesterId, actor_user_id: user.id, actor_email: user.email ?? "", action: `semester_${body.action ?? "update"}`, entity_type: "semester", entity_id: body.semesterId });
  return NextResponse.json({ ok: true });
}
