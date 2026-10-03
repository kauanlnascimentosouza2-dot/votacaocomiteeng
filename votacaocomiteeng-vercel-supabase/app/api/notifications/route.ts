import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("activity_notifications")
    .select("id,kind,title,message,href,read_at,created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(40);
  if (error) return NextResponse.json({ error: "Não foi possível carregar os avisos." }, { status: 500 });
  const { count } = await admin.from("activity_notifications")
    .select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
  return NextResponse.json({ notifications: data ?? [], unread: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { id?: string; all?: boolean };
  if (!body.all && !body.id) return NextResponse.json({ error: "Aviso inválido." }, { status: 400 });
  let query = createAdminClient().from("activity_notifications")
    .update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (!body.all) query = query.eq("id", body.id!);
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Não foi possível marcar o aviso." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
