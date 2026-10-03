import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const { id } = await params;
  if (id !== user.id && !await isAdmin(user)) return NextResponse.json({ error: "Você só pode editar o próprio perfil." }, { status: 403 });
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });
  const linkedin = cleanUrl(form.get("linkedinUrl"));
  const portfolio = cleanUrl(form.get("portfolioUrl"));
  if (linkedin === false || portfolio === false) return NextResponse.json({ error: "LinkedIn e portfólio precisam começar com http:// ou https://." }, { status: 400 });
  const notificationEmail = clean(form.get("notificationEmail"));
  if (form.has("notificationEmail") && notificationEmail && (notificationEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail))) return NextResponse.json({ error: "Informe um e-mail válido para avisos." }, { status: 400 });
  const admin = createAdminClient();
  const updates: Record<string, unknown> = {
    name,
    course: clean(form.get("course")),
    academic_period: clean(form.get("academicPeriod")),
    phone: clean(form.get("phone")),
    specialty: clean(form.get("specialty")),
    skills: String(form.get("skills") ?? "").split(",").map((skill) => skill.trim()).filter(Boolean).slice(0, 20),
    bio: clean(form.get("bio")),
    linkedin_url: linkedin || null,
    portfolio_url: portfolio || null,
    updated_at: new Date().toISOString(),
  };
  if (form.has("notificationEmail")) updates.notification_email = notificationEmail?.toLowerCase() ?? null;
  const avatar = form.get("avatar");
  if (avatar instanceof File && avatar.size) {
    if (!IMAGE_TYPES.has(avatar.type) || avatar.size > 5 * 1024 * 1024) return NextResponse.json({ error: "A foto deve ser JPG, PNG ou WebP e ter até 5 MB." }, { status: 400 });
    const extension = avatar.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp";
    const path = `${id}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage.from("profile-images").upload(path, Buffer.from(await avatar.arrayBuffer()), { contentType: avatar.type });
    if (uploadError) return NextResponse.json({ error: "Não foi possível enviar a foto." }, { status: 400 });
    updates.avatar_path = path;
  }
  const { error } = await admin.from("profiles").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Não foi possível atualizar o perfil." }, { status: 400 });
  return NextResponse.json({ ok: true });
}

function clean(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || null; }
function cleanUrl(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); if (!text) return null; return /^https?:\/\//i.test(text) ? text : false; }
