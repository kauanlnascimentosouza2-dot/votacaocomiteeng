import { redirect } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";
import { currentUserView } from "@/lib/current-user-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ProfileEditor from "./profile-editor";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const sidebarUser = await currentUserView(user);
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();
  const { data: activeSemester } = await admin.from("semesters").select("id, name").eq("status", "active").maybeSingle();
  let group = null;
  let groupPeople: Array<Record<string, unknown>> = [];
  if (activeSemester) {
    const { data: membership } = await admin.from("group_members").select("group_id, role").eq("semester_id", activeSemester.id).eq("user_id", user.id).maybeSingle();
    if (membership) {
      const [{ data: groupRow }, { data: members }] = await Promise.all([
        admin.from("groups").select("id, name, status").eq("id", membership.group_id).single(),
        admin.from("group_members").select("user_id, role").eq("group_id", membership.group_id),
      ]);
      group = groupRow ? { ...groupRow, role: membership.role } : null;
      const ids = (members ?? []).map((member) => member.user_id);
      if (ids.length) {
        const { data: profiles } = await admin.from("profiles").select("id, name, email, specialty, avatar_path").in("id", ids).order("name");
        groupPeople = await Promise.all((profiles ?? []).map(async (person) => {
          const member = (members ?? []).find((item) => item.user_id === person.id);
          let avatarUrl = null;
          if (person.avatar_path) { const { data } = await admin.storage.from("profile-images").createSignedUrl(person.avatar_path, 3600); avatarUrl = data?.signedUrl ?? null; }
          return { ...person, role: member?.role ?? "member", avatarUrl };
        }));
      }
    }
  }
  let avatarUrl = null;
  if (profile.avatar_path) { const { data } = await admin.storage.from("profile-images").createSignedUrl(profile.avatar_path, 3600); avatarUrl = data?.signedUrl ?? null; }
  return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content"><ProfileEditor profile={{ ...profile, avatarUrl }} group={group} semester={activeSemester} groupPeople={groupPeople}/></main></div>;
}
