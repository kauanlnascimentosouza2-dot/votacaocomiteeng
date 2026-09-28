import type { User } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function projectAccess(user: User, projectId: string) {
  const admin = createAdminClient();
  const { data: project } = await admin.from("projects").select("*, demands!inner(id, semester_id, status, submission_due_at)").eq("id", projectId).maybeSingle();
  if (!project) return { admin, project: null, allowed: false, member: null, adminMode: false };
  const adminMode = await isAdmin(user);
  const { data: member } = await admin.from("group_members").select("role").eq("group_id", project.group_id).eq("semester_id", project.demands.semester_id).eq("user_id", user.id).maybeSingle();
  return { admin, project, allowed: adminMode || Boolean(member), member, adminMode };
}

export async function signedProjectFile(admin: ReturnType<typeof createAdminClient>, path: string | null) {
  if (!path) return null;
  const { data } = await admin.storage.from("project-files").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
