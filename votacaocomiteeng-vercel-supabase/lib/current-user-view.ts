import type { User } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function currentUserView(user: User) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("name, email, avatar_path").eq("id", user.id).maybeSingle();
  let avatarUrl: string | null = null;
  if (profile?.avatar_path) {
    const { data } = await admin.storage.from("profile-images").createSignedUrl(profile.avatar_path, 60 * 60);
    avatarUrl = data?.signedUrl ?? null;
  }
  const adminMode = await isAdmin(user);
  const { data: semester } = await admin.from("semesters").select("id").eq("status", "active").maybeSingle();
  let hasActiveGroup = false;
  if (semester) {
    const { data: membership } = await admin.from("group_members").select("group_id").eq("semester_id", semester.id).eq("user_id", user.id).maybeSingle();
    if (membership) {
      const { data: group } = await admin.from("groups").select("status").eq("id", membership.group_id).maybeSingle();
      hasActiveGroup = group?.status === "active";
    }
  }
  return {
    name: profile?.name || String(user.user_metadata?.name || user.email?.split("@")[0] || "Participante"),
    email: profile?.email || user.email || "",
    isAdmin: adminMode,
    avatarUrl,
    hasActiveGroup,
  };
}
