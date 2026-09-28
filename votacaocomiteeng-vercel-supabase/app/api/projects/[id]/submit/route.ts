import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { projectAccess } from "@/lib/project-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const { id } = await params;
  const access = await projectAccess(user, id);
  if (!access.project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  if (!access.allowed) return NextResponse.json({ error: "Você não pertence a este grupo." }, { status: 403 });
  const form = await request.formData();
  const deliverableId = String(form.get("deliverableId") ?? "");
  const { data: deliverable } = await access.admin.from("deliverables").select("*").eq("id", deliverableId).eq("demand_id", access.project.demand_id).maybeSingle();
  if (!deliverable) return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
  if (deliverable.is_final && access.member?.role !== "leader" && !access.adminMode) return NextResponse.json({ error: "Somente o líder pode realizar a entrega final." }, { status: 403 });
  if (deliverable.is_final && (!access.project.title || !access.project.description || !access.project.main_image_url)) return NextResponse.json({ error: "Preencha título, descrição e imagem principal antes da entrega final." }, { status: 409 });

  const { data: extension } = await access.admin.from("demand_group_extensions").select("due_at").eq("demand_id", access.project.demand_id).eq("group_id", access.project.group_id).maybeSingle();
  const dueAt = extension?.due_at ?? deliverable.due_at;
  const isLate = Boolean(dueAt && new Date() > new Date(dueAt));
  const { data: submission, error } = await access.admin.from("submissions").insert({ deliverable_id: deliverableId, project_id: id, group_id: access.project.group_id, submitted_by: user.id, notes: String(form.get("notes") ?? "").trim(), is_late: isLate }).select().single();
  if (error || !submission) return NextResponse.json({ error: "Não foi possível registrar a entrega." }, { status: 400 });
  const file = form.get("file");
  if (file instanceof File && file.size) {
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "O arquivo deve ter até 20 MB." }, { status: 400 });
    const extensionName = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
    const path = `${access.project.group_id}/${id}/submissions/${randomUUID()}.${extensionName}`;
    const { error: uploadError } = await access.admin.storage.from("project-files").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (uploadError) return NextResponse.json({ error: "A entrega foi registrada, mas o arquivo não pôde ser enviado." }, { status: 400 });
    await access.admin.from("submission_files").insert({ submission_id: submission.id, file_name: file.name, file_url: path, mime_type: file.type || "application/octet-stream", size_bytes: file.size });
  }
  if (deliverable.is_final) await access.admin.from("projects").update({ status: isLate ? "late" : "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  await access.admin.from("audit_logs").insert({ semester_id: access.project.demands.semester_id, actor_user_id: user.id, actor_email: user.email ?? "", action: deliverable.is_final ? "project_final_submitted" : "deliverable_submitted", entity_type: "project", entity_id: id, details: { deliverable_id: deliverableId, is_late: isLate } });
  return NextResponse.json({ ok: true, isLate });
}
