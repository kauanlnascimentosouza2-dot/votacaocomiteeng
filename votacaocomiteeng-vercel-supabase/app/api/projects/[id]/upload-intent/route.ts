import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { projectAccess } from "@/lib/project-access";
import { MAX_SUBMISSION_FILE_SIZE, submissionFileType } from "@/lib/submission-upload";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const { id } = await params;
  const access = await projectAccess(user, id);
  if (!access.project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  if (!access.allowed) return NextResponse.json({ error: "Você não pertence a este grupo." }, { status: 403 });
  if (access.project.demands.status === "closed" && !access.adminMode) return NextResponse.json({ error: "Esta demanda já foi encerrada." }, { status: 409 });

  const body = await request.json().catch(() => ({})) as { deliverableId?: string; fileName?: string; fileSize?: number };
  const fileName = String(body.fileName ?? "").replace(/[\\/\u0000-\u001f]/g, "").trim().slice(0, 180);
  const fileSize = Number(body.fileSize);
  const { extension, mimeType } = submissionFileType(fileName);
  if (!fileName || !mimeType || !Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_SUBMISSION_FILE_SIZE) return NextResponse.json({ error: "Use DWG, DXF, PDF ou imagem de até 50 MB." }, { status: 400 });
  const { data: deliverable } = await access.admin.from("deliverables").select("id,is_final").eq("id", body.deliverableId ?? "").eq("demand_id", access.project.demand_id).maybeSingle();
  if (!deliverable) return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
  if (deliverable.is_final && access.member?.role !== "leader" && !access.adminMode) return NextResponse.json({ error: "Somente o líder pode fazer a entrega final." }, { status: 403 });

  const path = `${access.project.group_id}/${id}/submissions/${randomUUID()}.${extension}`;
  const { data: intent, error: intentError } = await access.admin.from("project_upload_intents").insert({ project_id: id, deliverable_id: deliverable.id, group_id: access.project.group_id, user_id: user.id, storage_path: path, file_name: fileName, mime_type: mimeType, size_bytes: fileSize }).select("id").single();
  if (intentError || !intent) return NextResponse.json({ error: "Não foi possível preparar o envio. Confira se a atualização do banco foi executada." }, { status: 500 });
  const { data: signed, error: signError } = await access.admin.storage.from("project-files").createSignedUploadUrl(path);
  if (signError || !signed) {
    await access.admin.from("project_upload_intents").delete().eq("id", intent.id);
    return NextResponse.json({ error: "Não foi possível autorizar o envio do arquivo." }, { status: 500 });
  }
  return NextResponse.json({ uploadId: intent.id, path, token: signed.token, contentType: mimeType });
}
