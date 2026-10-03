import type { User } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function chatAccess(user: User, semesterId: string) {
  const admin = createAdminClient();
  const { data: semester } = await admin.from("semesters").select("id,name,status").eq("id", semesterId).maybeSingle();
  if (!semester) return { allowed: false, canWrite: false, semester: null };
  if (await isAdmin(user)) return { allowed: true, canWrite: semester.status === "active", semester };
  const { data: membership } = await admin.from("group_members").select("group_id").eq("semester_id", semesterId).eq("user_id", user.id).maybeSingle();
  if (!membership) return { allowed: false, canWrite: false, semester };
  const { data: group } = await admin.from("groups").select("status").eq("id", membership.group_id).maybeSingle();
  return { allowed: group?.status === "active" || semester.status === "closed", canWrite: semester.status === "active" && group?.status === "active", semester };
}
