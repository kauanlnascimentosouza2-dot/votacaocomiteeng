import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para votar." }, { status: 401 });

  const payload = await request.json().catch(() => ({})) as { proposalId?: string };
  if (!payload.proposalId) return NextResponse.json({ error: "Proposta inválida." }, { status: 400 });

  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, poll_id")
    .eq("id", payload.proposalId)
    .single();
  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });

  const { error } = await supabase.from("votes").insert({
    poll_id: proposal.poll_id,
    proposal_id: proposal.id,
    user_id: user.id,
  });
  if (error?.code === "23505") return NextResponse.json({ error: "Seu voto já foi registrado nesta votação." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Não foi possível registrar o voto." }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
