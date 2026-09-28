import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import DemandManager from "./demand-manager";

export const dynamic = "force-dynamic";

export default async function DemandsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!await isAdmin(user)) redirect("/");
  const admin = createAdminClient();
  const { data: semester } = await admin.from("semesters").select("*").in("status", ["active", "draft"]).order("status").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const [{ data: groups }, { data: demands }] = semester ? await Promise.all([
    admin.from("groups").select("id, name, status").eq("semester_id", semester.id).order("name"),
    admin.from("demands").select("*, demand_groups(group_id), deliverables(id, title, due_at, is_final, position)").eq("semester_id", semester.id).order("created_at", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }];
  return <div className="semester-shell"><header className="semester-topbar"><Link href="/">← Voltar para a votação</Link><strong>Demandas e prazos</strong><span>{user.email}</span></header><main className="semester-workspace"><DemandManager semester={semester} groups={groups ?? []} demands={demands ?? []}/></main></div>;
}
