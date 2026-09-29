import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-request";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeLessonSemester, lessonFolderIsActive } from "@/lib/lessons";

export async function POST(request: Request) {
  const { user, allowed } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { name?: string; description?: string; parentId?: string | null };
  const name = body.name?.trim() ?? "";
  if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "O nome da pasta deve ter entre 2 e 100 caracteres." }, { status: 400 });
  const semester = await activeLessonSemester();
  if (!semester) return NextResponse.json({ error: "Abra uma edição antes de criar pastas." }, { status: 409 });
  if (body.parentId && !await lessonFolderIsActive(semester.id, body.parentId)) return NextResponse.json({ error: "A pasta superior não está disponível." }, { status: 400 });
  const { data, error } = await createAdminClient().from("lesson_folders").insert({ semester_id: semester.id, parent_id: body.parentId || null, name, description: body.description?.trim() ?? "", created_by: user.id }).select().single();
  if (error || !data) return NextResponse.json({ error: "Não foi possível criar a pasta." }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, allowed } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { folderId?: string; name?: string; description?: string; status?: "active" | "archived" };
  if (!body.folderId || (!body.name && body.status === undefined)) return NextResponse.json({ error: "Informe a pasta e a alteração." }, { status: 400 });
  const semester = await activeLessonSemester();
  if (!semester) return NextResponse.json({ error: "Nenhuma edição ativa." }, { status: 409 });
  const changes: Record<string, string> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "Nome de pasta inválido." }, { status: 400 });
    changes.name = name;
    changes.description = body.description?.trim() ?? "";
  }
  if (body.status !== undefined) {
    if (!(["active", "archived"] as const).includes(body.status)) return NextResponse.json({ error: "Situação inválida." }, { status: 400 });
    changes.status = body.status;
  }
  const { data, error } = await createAdminClient().from("lesson_folders").update(changes).eq("id", body.folderId).eq("semester_id", semester.id).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Não foi possível atualizar a pasta." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
