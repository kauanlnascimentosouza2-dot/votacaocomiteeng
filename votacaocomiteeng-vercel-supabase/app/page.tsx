import { redirect } from "next/navigation";
import { configuredAdminEmails, isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import VotingClient from "./voting-client";
import { currentUserView } from "@/lib/current-user-view";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userView = await currentUserView(user);
  const adminMode = userView.isAdmin;
  if (!adminMode && !userView.hasActiveGroup) redirect("/workspace");
  const pollQuery = adminMode
    ? createAdminClient().from("polls").select("*").in("status", ["active", "closed"]).order("created_at", { ascending: false }).limit(1)
    : supabase.from("polls").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(1);
  const { data: pollRows } = await pollQuery;
  const poll = pollRows?.[0] ?? null;
  let proposals: Array<Record<string, unknown>> = [];
  let myVote: Record<string, unknown> | null = null;
  let detailedVotes: Array<{ id: string; userName: string; email: string; proposalTitle: string; createdAt: string }> = [];
  let results: Array<{ proposalId: string; total: number }> = [];
  let admins: string[] = [];

  if (poll) {
    const proposalResult = await supabase.from("proposals").select("*").eq("poll_id", poll.id).order("created_at");
    proposals = proposalResult.data ?? [];
    const voteResult = await supabase.from("votes").select("proposal_id").eq("poll_id", poll.id).eq("user_id", user.id).maybeSingle();
    myVote = voteResult.data;

    if (adminMode) {
      const service = createAdminClient();
      const [{ data: allVotes }, { data: profiles }, { data: storedAdmins }] = await Promise.all([
        service.from("votes").select("id, user_id, proposal_id, created_at").eq("poll_id", poll.id).order("created_at"),
        service.from("profiles").select("id, name, email"),
        service.from("admins").select("email").order("created_at"),
      ]);
      admins = [...new Set([...configuredAdminEmails(), ...(storedAdmins ?? []).map((item) => item.email)])];
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      const proposalMap = new Map(proposals.map((proposal) => [String(proposal.id), proposal]));
      const counts = new Map<string, number>();
      detailedVotes = (allVotes ?? []).map((vote) => {
        const profile = profileMap.get(vote.user_id);
        const proposal = proposalMap.get(vote.proposal_id);
        counts.set(vote.proposal_id, (counts.get(vote.proposal_id) ?? 0) + 1);
        return {
          id: vote.id,
          userName: profile?.name || profile?.email || "Participante",
          email: profile?.email || "",
          proposalTitle: String(proposal?.title ?? "Proposta removida"),
          createdAt: vote.created_at,
        };
      });
      results = [...counts.entries()].map(([proposalId, total]) => ({ proposalId, total }));
    }
  }

  return <VotingClient initialTab={(await searchParams).view === "admin" && adminMode ? "admin" : "voting"} initialState={{
    user: userView,
    poll,
    proposals,
    myVote,
    results,
    votes: detailedVotes,
    admins,
  }} />;
}
