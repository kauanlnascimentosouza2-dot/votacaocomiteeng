import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (!(await isAdmin(user))) return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });

  const payload = await request.json().catch(() => ({})) as { pollId?: string; status?: string; endsAt?: string | null };
  if (!payload.pollId || !["active", "closed"].includes(payload.status ?? "")) {
    return NextResponse.json({ error: "Configuração de votação inválida." }, { status: 400 });
  }
  let endsAt: string | null = null;
  if (payload.endsAt) {
    const parsed = new Date(payload.endsAt);
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: "Informe uma data válida." }, { status: 400 });
    endsAt = parsed.toISOString();
  }

  const admin = createAdminClient();
  const { data: poll, error } = await admin.from("polls").update({ status: payload.status, ends_at: endsAt }).eq("id", payload.pollId).select().single();
  if (error) return NextResponse.json({ error: "Não foi possível atualizar a votação." }, { status: 400 });
  return NextResponse.json({ poll });
}
