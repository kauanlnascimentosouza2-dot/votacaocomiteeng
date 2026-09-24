import { NextResponse } from "next/server";
import { configuredAdminEmails, isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function currentAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { user, allowed: Boolean(user && await isAdmin(user)) };
}

export async function POST(request: Request) {
  const { user, allowed } = await currentAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  const payload = await request.json().catch(() => ({})) as { email?: string };
  const email = payload.email?.trim().toLowerCase() ?? "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("admins").upsert({ email, created_by: user.email ?? "" }, { onConflict: "email" });
  if (error) return NextResponse.json({ error: "Não foi possível adicionar o administrador. Execute a atualização do banco primeiro." }, { status: 400 });
  return NextResponse.json({ email }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { user, allowed } = await currentAdmin();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  const payload = await request.json().catch(() => ({})) as { email?: string };
  const email = payload.email?.trim().toLowerCase() ?? "";
  if (!email) return NextResponse.json({ error: "Administrador inválido." }, { status: 400 });
  if (configuredAdminEmails().includes(email)) {
    return NextResponse.json({ error: "Este é o administrador principal configurado na Vercel e não pode ser removido pelo painel." }, { status: 409 });
  }
  if (email === user.email?.trim().toLowerCase()) {
    return NextResponse.json({ error: "Você não pode remover seu próprio acesso." }, { status: 409 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("admins").delete().eq("email", email);
  if (error) return NextResponse.json({ error: "Não foi possível remover o administrador." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
