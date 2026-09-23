import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const image = form.get("image");
  if (!title || !description) return NextResponse.json({ error: "Preencha o título e a descrição." }, { status: 400 });

  const admin = createAdminClient();
  const { data: poll } = await admin.from("polls").select("id").eq("status", "active").limit(1).single();
  if (!poll) return NextResponse.json({ error: "Nenhuma votação aberta." }, { status: 409 });

  let imageUrl: string | null = null;
  if (image instanceof File && image.size > 0) {
    if (image.size > 5 * 1024 * 1024 || !allowedTypes.has(image.type)) {
      return NextResponse.json({ error: "Use uma imagem JPG, PNG ou WebP de até 5 MB." }, { status: 400 });
    }
    const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    const path = `${poll.id}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage.from("proposal-images").upload(path, image, { contentType: image.type, upsert: false });
    if (uploadError) return NextResponse.json({ error: "Não foi possível enviar a imagem." }, { status: 400 });
    imageUrl = admin.storage.from("proposal-images").getPublicUrl(path).data.publicUrl;
  }

  const accents = ["blue", "green", "orange", "purple"];
  const { data: proposal, error } = await admin.from("proposals").insert({
    poll_id: poll.id,
    title,
    description,
    image_url: imageUrl,
    accent: accents[Math.floor(Math.random() * accents.length)],
  }).select().single();
  if (error) return NextResponse.json({ error: "Não foi possível adicionar a proposta." }, { status: 400 });
  return NextResponse.json({ proposal }, { status: 201 });
}
