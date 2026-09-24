import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function authorize() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { user, allowed: Boolean(user && await isAdmin(user)) };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, allowed } = await authorize();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });

  const { id } = await context.params;
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const image = form.get("image");
  if (!title || !description) return NextResponse.json({ error: "Preencha o título e a descrição." }, { status: 400 });

  const admin = createAdminClient();
  const { data: current } = await admin.from("proposals").select("id, poll_id, image_url").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });

  const updates: { title: string; description: string; image_url?: string } = { title, description };
  if (image instanceof File && image.size > 0) {
    if (image.size > 5 * 1024 * 1024 || !allowedTypes.has(image.type)) {
      return NextResponse.json({ error: "Use uma imagem JPG, PNG ou WebP de até 5 MB." }, { status: 400 });
    }
    const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    const path = `${current.poll_id}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage.from("proposal-images").upload(path, image, { contentType: image.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: "Não foi possível enviar a nova imagem." }, { status: 400 });
    updates.image_url = admin.storage.from("proposal-images").getPublicUrl(path).data.publicUrl;
  }

  const { data: proposal, error } = await admin.from("proposals").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: "Não foi possível editar a proposta." }, { status: 400 });
  return NextResponse.json({ proposal });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, allowed } = await authorize();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });

  const { id } = await context.params;
  const admin = createAdminClient();
  const { count } = await admin.from("votes").select("id", { count: "exact", head: true }).eq("proposal_id", id);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "Esta proposta já recebeu votos e não pode ser excluída. Você ainda pode editar o título, a descrição ou a imagem." }, { status: 409 });
  }
  const { error } = await admin.from("proposals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Não foi possível excluir a proposta." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
