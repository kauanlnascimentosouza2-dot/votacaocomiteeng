import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { chatAccess } from "@/lib/chat-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const semesterId = new URL(request.url).searchParams.get("semesterId");
  if (!semesterId) return NextResponse.json({ error: "Edição inválida." }, { status: 400 });
  const access = await chatAccess(user, semesterId);
  if (!access.allowed) return NextResponse.json({ error: "Você não tem acesso a este chat." }, { status: 403 });
  const { data, error } = await createAdminClient().from("general_chat_messages").select("id,author_id,author_name,body,created_at").eq("semester_id", semesterId).eq("status", "published").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Não foi possível carregar as mensagens." }, { status: 500 });
  return NextResponse.json({ messages: (data ?? []).reverse(), canWrite: access.canWrite }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { semesterId?: string; message?: string };
  if (!body.semesterId) return NextResponse.json({ error: "Edição inválida." }, { status: 400 });
  const message = body.message?.trim() ?? "";
  if (message.length < 1 || message.length > 1000) return NextResponse.json({ error: "Escreva uma mensagem de até 1000 caracteres." }, { status: 400 });
  const access = await chatAccess(user, body.semesterId);
  if (!access.canWrite) return NextResponse.json({ error: "O chat desta edição está fechado ou você não tem acesso." }, { status: 403 });
  const admin = createAdminClient();
  const { data: last } = await admin.from("general_chat_messages").select("created_at").eq("semester_id", body.semesterId).eq("author_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (last && Date.now() - new Date(last.created_at).getTime() < 2000) return NextResponse.json({ error: "Aguarde um instante antes de enviar outra mensagem." }, { status: 429 });
  const { data: profile } = await admin.from("profiles").select("name").eq("id", user.id).maybeSingle();
  const { data, error } = await admin.from("general_chat_messages").insert({ semester_id: body.semesterId, author_id: user.id, author_name: profile?.name || user.email?.split("@")[0] || "Participante", body: message }).select("id,author_id,author_name,body,created_at").single();
  if (error || !data) return NextResponse.json({ error: "Não foi possível enviar a mensagem." }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { messageId?: string };
  if (!body.messageId) return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  const admin = createAdminClient();
  const { data: message } = await admin.from("general_chat_messages").select("id,semester_id,author_id,status").eq("id", body.messageId).maybeSingle();
  if (!message || message.status !== "published") return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  const access = await chatAccess(user, message.semester_id);
  if (!access.allowed || (message.author_id !== user.id && !await isAdmin(user))) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { error } = await admin.from("general_chat_messages").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", message.id);
  if (error) return NextResponse.json({ error: "Não foi possível apagar a mensagem." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
