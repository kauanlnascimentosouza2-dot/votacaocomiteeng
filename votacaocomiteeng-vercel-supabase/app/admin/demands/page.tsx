import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import DemandManager from "./demand-manager";
import AppSidebar from "@/components/app-sidebar";
import { currentUserView } from "@/lib/current-user-view";

export const dynamic = "force-dynamic";

export default async function DemandsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!await isAdmin(user)) redirect("/");
  const sidebarUser = await currentUserView(user);
  const admin = createAdminClient();
  const { data: semester } = await admin.from("semesters").select("*").in("status", ["active", "draft"]).order("status").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const [{ data: groups }, { data: demands }] = semester ? await Promise.all([
    admin.from("groups").select("id, name, status").eq("semester_id", semester.id).order("name"),
    admin.from("demands").select("*, demand_groups(group_id), deliverables(id, title, due_at, is_final, position)").eq("semester_id", semester.id).order("created_at", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }];
  return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content semester-shell"><div className="semester-workspace"><DemandManager semester={semester} groups={groups ?? []} demands={demands ?? []}/></div></main></div>;
}
