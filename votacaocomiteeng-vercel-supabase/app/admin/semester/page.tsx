import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import SemesterBoard from "./semester-board";
import AppSidebar from "@/components/app-sidebar";
import { currentUserView } from "@/lib/current-user-view";

export const dynamic = "force-dynamic";

export default async function SemesterAdminPage({ searchParams }: { searchParams: Promise<{ semester?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!await isAdmin(user)) redirect("/");
  const sidebarUser = await currentUserView(user);

  const admin = createAdminClient();
  const { data: semesterRows } = await admin.from("semesters").select("*").order("created_at", { ascending: false });
  const semesters = semesterRows ?? [];
  const requestedId = (await searchParams).semester;
  const semester = semesters.find((item) => item.id === requestedId) ?? semesters[0] ?? null;

  if (!semester) {
    return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content semester-shell"><div className="semester-workspace"><SemesterBoard initialData={{ semester: null, semesters: [], groups: [], people: [] }} /></div></main></div>;
  }

  const [{ data: groupRows }, { data: memberRows }, { data: enrollmentRows }, { data: profileRows }] = await Promise.all([
    admin.from("groups").select("*").eq("semester_id", semester.id).order("created_at"),
    admin.from("group_members").select("group_id, user_id, role, joined_at").eq("semester_id", semester.id),
    admin.from("semester_enrollments").select("user_id, status").eq("semester_id", semester.id),
    admin.from("profiles").select("id, name, email, created_at").order("name"),
  ]);
  const groups = groupRows ?? [];
  const members = memberRows ?? [];
  const enrollments = enrollmentRows ?? [];
  const profiles = profileRows ?? [];
  const memberByUser = new Map(members.map((member) => [member.user_id, member]));
  const enrollmentByUser = new Map(enrollments.map((enrollment) => [enrollment.user_id, enrollment]));
  const people = profiles
    .filter((profile) => enrollmentByUser.has(profile.id))
    .map((profile) => ({
      id: profile.id,
      name: profile.name || profile.email?.split("@")[0] || "Participante",
      email: profile.email,
      createdAt: profile.created_at,
      enrollmentStatus: enrollmentByUser.get(profile.id)?.status ?? "pending",
      groupId: memberByUser.get(profile.id)?.group_id ?? null,
      role: memberByUser.get(profile.id)?.role ?? "member",
    }));

  return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content semester-shell"><div className="semester-workspace"><SemesterBoard initialData={{ semester, semesters, groups, people }} /></div></main></div>;
}
