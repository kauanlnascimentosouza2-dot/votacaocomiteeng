import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-request";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeLessonSemester, lessonEmbedUrl, lessonFolderIsActive, normalizeLessonUrl } from "@/lib/lessons";

type LessonInput = {
  lessonId?: string;
  folderId?: string;
  title?: string;
  description?: string;
  videoUrl?: string;
  status?: "published" | "archived";
};

export async function POST(request: Request) {
  const { user, allowed } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as LessonInput;
  const semester = await activeLessonSemester();
  if (!semester) return NextResponse.json({ error: "Abra uma edição antes de cadastrar aulas." }, { status: 409 });
  const title = body.title?.trim() ?? "";
  const videoUrl = normalizeLessonUrl(body.videoUrl);
  if (title.length < 3 || title.length > 160 || (body.description?.length ?? 0) > 10000) return NextResponse.json({ error: "Revise o título e a descrição da aula." }, { status: 400 });
  if (!videoUrl || !lessonEmbedUrl(videoUrl)) return NextResponse.json({ error: "Informe um link válido do YouTube ou Vimeo." }, { status: 400 });
  if (!body.folderId || !await lessonFolderIsActive(semester.id, body.folderId)) return NextResponse.json({ error: "Selecione uma pasta ativa." }, { status: 400 });
  const { data, error } = await createAdminClient().from("lessons").insert({ semester_id: semester.id, folder_id: body.folderId, title, content: body.description?.trim() ?? "", video_url: videoUrl, created_by: user.id }).select().single();
  if (error || !data) return NextResponse.json({ error: "Não foi possível cadastrar a aula." }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, allowed } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as LessonInput;
  if (!body.lessonId) return NextResponse.json({ error: "Aula inválida." }, { status: 400 });
  const semester = await activeLessonSemester();
  if (!semester) return NextResponse.json({ error: "Nenhuma edição ativa." }, { status: 409 });
  const changes: Record<string, string> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) {
    const title = body.title.trim();
    if (title.length < 3 || title.length > 160) return NextResponse.json({ error: "Título inválido." }, { status: 400 });
    changes.title = title;
  }
  if (body.description !== undefined) {
    if (body.description.length > 10000) return NextResponse.json({ error: "Descrição muito longa." }, { status: 400 });
    changes.content = body.description.trim();
  }
  if (body.videoUrl !== undefined) {
    const videoUrl = normalizeLessonUrl(body.videoUrl);
    if (!videoUrl || !lessonEmbedUrl(videoUrl)) return NextResponse.json({ error: "Informe um link válido do YouTube ou Vimeo." }, { status: 400 });
    changes.video_url = videoUrl;
  }
  if (body.folderId !== undefined) {
    if (!await lessonFolderIsActive(semester.id, body.folderId)) return NextResponse.json({ error: "Selecione uma pasta ativa." }, { status: 400 });
    changes.folder_id = body.folderId;
  }
  if (body.status !== undefined) {
    if (body.status !== "published" && body.status !== "archived") return NextResponse.json({ error: "Situação inválida." }, { status: 400 });
    changes.status = body.status;
  }
  const { data, error } = await createAdminClient().from("lessons").update(changes).eq("id", body.lessonId).eq("semester_id", semester.id).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Não foi possível atualizar a aula." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
