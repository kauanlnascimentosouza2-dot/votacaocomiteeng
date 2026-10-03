import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { projectAccess } from "@/lib/project-access";
import { MAX_SUBMISSION_FILE_SIZE } from "@/lib/submission-upload";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const { id } = await params;
  const access = await projectAccess(user, id);
  if (!access.project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  if (!access.allowed) return NextResponse.json({ error: "Você não pertence a este grupo." }, { status: 403 });
  if (access.project.demands.status === "closed" && !access.adminMode) return NextResponse.json({ error: "Esta demanda já foi encerrada." }, { status: 409 });
  const body = await request.json().catch(() => ({})) as { deliverableId?: string; notes?: string; uploadId?: string };
  const notes = String(body.notes ?? "").trim();
  if (!body.deliverableId || notes.length > 5000) return NextResponse.json({ error: "Revise a etapa e as observações." }, { status: 400 });
  const admin = access.admin;
  const { data: deliverable } = await admin.from("deliverables").select("id,is_final,due_at").eq("id", body.deliverableId).eq("demand_id", access.project.demand_id).maybeSingle();
  if (!deliverable) return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
  if (deliverable.is_final && access.member?.role !== "leader" && !access.adminMode) return NextResponse.json({ error: "Somente o líder pode realizar a entrega final." }, { status: 403 });

  let intent: { id: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; status: string; expires_at: string } | null = null;
  if (body.uploadId) {
    const { data } = await admin.from("project_upload_intents").select("id,storage_path,file_name,mime_type,size_bytes,status,expires_at")
      .eq("id", body.uploadId).eq("project_id", id).eq("deliverable_id", deliverable.id).eq("group_id", access.project.group_id).eq("user_id", user.id).maybeSingle();
    intent = data;
    if (!intent || intent.status !== "pending" || new Date(intent.expires_at).getTime() < Date.now()) return NextResponse.json({ error: "O envio expirou. Selecione e envie o arquivo novamente." }, { status: 409 });
    const { data: fileInfo, error: fileError } = await admin.storage.from("project-files").info(intent.storage_path);
    if (fileError || !fileInfo || Number(fileInfo.size) !== intent.size_bytes || Number(fileInfo.size) > MAX_SUBMISSION_FILE_SIZE || (fileInfo.contentType && fileInfo.contentType !== intent.mime_type)) return NextResponse.json({ error: "O arquivo ainda não chegou completo ao armazenamento. A entrega não foi registrada." }, { status: 409 });
  }
  if (deliverable.is_final && (!access.project.title || !access.project.description || (!access.project.main_image_url && !access.project.pdf_url && !intent))) return NextResponse.json({ error: "Preencha título e descrição e envie um arquivo DWG, DXF, PDF ou uma imagem." }, { status: 409 });

  const { data: extension } = await admin.from("demand_group_extensions").select("due_at").eq("demand_id", access.project.demand_id).eq("group_id", access.project.group_id).maybeSingle();
  const dueAt = extension?.due_at ?? deliverable.due_at;
  const isLate = Boolean(dueAt && new Date() > new Date(dueAt));
  if (intent) {
    const { data: claimed } = await admin.from("project_upload_intents").update({ status: "used", used_at: new Date().toISOString() }).eq("id", intent.id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed) return NextResponse.json({ error: "Este arquivo já foi utilizado em uma entrega." }, { status: 409 });
  }
  const { data: submission, error } = await admin.from("submissions").insert({ deliverable_id: deliverable.id, project_id: id, group_id: access.project.group_id, submitted_by: user.id, notes, is_late: isLate }).select("id").single();
  if (error || !submission) {
    if (intent) await admin.from("project_upload_intents").update({ status: "pending", used_at: null }).eq("id", intent.id);
    return NextResponse.json({ error: "Não foi possível registrar a entrega." }, { status: 500 });
  }
  if (intent) {
    const { error: fileError } = await admin.from("submission_files").insert({ submission_id: submission.id, file_name: intent.file_name, file_url: intent.storage_path, mime_type: intent.mime_type, size_bytes: intent.size_bytes });
    if (fileError) {
      await admin.from("submissions").delete().eq("id", submission.id);
      await admin.from("project_upload_intents").update({ status: "pending", used_at: null }).eq("id", intent.id);
      return NextResponse.json({ error: "Não foi possível vincular o arquivo. A entrega não foi registrada." }, { status: 500 });
    }
  }
  if (deliverable.is_final) {
    const { error: projectError } = await admin.from("projects").update({ status: isLate ? "late" : "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    if (projectError) {
      await admin.from("submissions").delete().eq("id", submission.id);
      if (intent) await admin.from("project_upload_intents").update({ status: "pending", used_at: null }).eq("id", intent.id);
      return NextResponse.json({ error: "Não foi possível concluir a entrega final." }, { status: 500 });
    }
  }
  await admin.from("audit_logs").insert({ semester_id: access.project.demands.semester_id, actor_user_id: user.id, actor_email: user.email ?? "", action: deliverable.is_final ? "project_final_submitted" : "deliverable_submitted", entity_type: "project", entity_id: id, details: { deliverable_id: deliverable.id, is_late: isLate, file_name: intent?.file_name ?? null } });
  return NextResponse.json({ ok: true, isLate });
}
