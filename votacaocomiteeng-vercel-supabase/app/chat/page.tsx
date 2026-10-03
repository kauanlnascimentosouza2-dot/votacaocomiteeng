import { redirect } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";
import { currentUserView } from "@/lib/current-user-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ChatClient from "./chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const sidebarUser = await currentUserView(user);
  const admin = createAdminClient();
  let semesterIds: string[] | null = null;
  if (!sidebarUser.isAdmin) {
    const { data: memberships } = await admin.from("group_members").select("semester_id").eq("user_id", user.id);
    semesterIds = [...new Set((memberships ?? []).map(item => item.semester_id))];
    if (!semesterIds.length) redirect("/workspace");
  }
  let query = admin.from("semesters").select("id,name,status,created_at").order("created_at", { ascending: false });
  if (semesterIds) query = query.in("id", semesterIds);
  const { data: semesters } = await query;
  const selected = (semesters ?? []).find(item => item.status === "active") ?? semesters?.[0] ?? null;
  const { data: profile } = await admin.from("profiles").select("name").eq("id", user.id).maybeSingle();
  return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content"><ChatClient semesters={semesters ?? []} initialSemesterId={selected?.id ?? ""} userId={user.id} displayName={profile?.name || sidebarUser.name} isAdmin={sidebarUser.isAdmin}/></main></div>;
}
