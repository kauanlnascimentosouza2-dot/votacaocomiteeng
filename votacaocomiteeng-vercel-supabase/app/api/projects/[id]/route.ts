import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { projectAccess } from "@/lib/project-access";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const { id } = await params;
  const access = await projectAccess(user, id);
  if (!access.project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  if (!access.allowed) return NextResponse.json({ error: "Você não pertence a este grupo." }, { status: 403 });
  if (access.project.demands.status === "closed" && !access.adminMode) return NextResponse.json({ error: "Esta demanda já foi encerrada." }, { status: 409 });

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  if (!title || !description) return NextResponse.json({ error: "Informe título e descrição." }, { status: 400 });
  const links = String(form.get("externalLinks") ?? "").split(/\r?\n/).map((link) => link.trim()).filter(Boolean);
  if (links.some((link) => !/^https?:\/\//i.test(link))) return NextResponse.json({ error: "Cada link externo deve começar com http:// ou https://." }, { status: 400 });
  const updates: Record<string, unknown> = { title, description, external_links: links, last_edited_by: user.id, updated_at: new Date().toISOString() };

  const mainImage = form.get("mainImage");
  if (mainImage instanceof File && mainImage.size) {
    if (!IMAGE_TYPES.has(mainImage.type) || mainImage.size > 10 * 1024 * 1024) return NextResponse.json({ error: "A imagem principal deve ser JPG, PNG ou WebP e ter até 10 MB." }, { status: 400 });
    const path = await upload(access.admin, access.project.group_id, id, mainImage);
    if (!path) return NextResponse.json({ error: "Não foi possível enviar a imagem principal." }, { status: 400 });
    updates.main_image_url = path;
  }
  const pdf = form.get("pdf");
  if (pdf instanceof File && pdf.size) {
    if (pdf.type !== "application/pdf" || pdf.size > 20 * 1024 * 1024) return NextResponse.json({ error: "O PDF deve ter no máximo 20 MB." }, { status: 400 });
    const path = await upload(access.admin, access.project.group_id, id, pdf);
    if (!path) return NextResponse.json({ error: "Não foi possível enviar o PDF." }, { status: 400 });
    updates.pdf_url = path;
  }
  const extraImages = form.getAll("additionalImages").filter((item): item is File => item instanceof File && item.size > 0);
  const { count: existingCount } = await access.admin.from("project_images").select("id", { count: "exact", head: true }).eq("project_id", id);
  if ((existingCount ?? 0) + extraImages.length > 5) return NextResponse.json({ error: "O projeto pode ter no máximo cinco imagens adicionais." }, { status: 400 });
  for (const image of extraImages) {
    if (!IMAGE_TYPES.has(image.type) || image.size > 10 * 1024 * 1024) return NextResponse.json({ error: "As imagens adicionais devem ser JPG, PNG ou WebP e ter até 10 MB cada." }, { status: 400 });
  }

  const { data: versions } = await access.admin.from("project_versions").select("version_number").eq("project_id", id).order("version_number", { ascending: false }).limit(1);
  await access.admin.from("project_versions").insert({ project_id: id, version_number: (versions?.[0]?.version_number ?? 0) + 1, snapshot: { title: access.project.title, description: access.project.description, external_links: access.project.external_links, main_image_url: access.project.main_image_url, pdf_url: access.project.pdf_url }, edited_by: user.id, edited_by_admin: access.adminMode });
  const { error } = await access.admin.from("projects").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Não foi possível salvar o projeto." }, { status: 400 });
  if (extraImages.length) {
    const paths: string[] = [];
    for (const image of extraImages) { const path = await upload(access.admin, access.project.group_id, id, image); if (path) paths.push(path); }
    if (paths.length) await access.admin.from("project_images").insert(paths.map((imageUrl, index) => ({ project_id: id, image_url: imageUrl, position: (existingCount ?? 0) + index })));
  }
  await access.admin.from("audit_logs").insert({ semester_id: access.project.demands.semester_id, actor_user_id: user.id, actor_email: user.email ?? "", action: access.adminMode ? "project_edited_by_admin" : "project_edited", entity_type: "project", entity_id: id });
  return NextResponse.json({ ok: true });
}

async function upload(admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>, groupId: string, projectId: string, file: File) {
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const path = `${groupId}/${projectId}/${randomUUID()}.${extension}`;
  const { error } = await admin.storage.from("project-files").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  return error ? null : path;
}
