import { redirect } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";
import { currentUserView } from "@/lib/current-user-view";
import { lessonEmbedUrl } from "@/lib/lessons";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import LessonsClient from "./lessons-client";

export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const sidebarUser = await currentUserView(user);
  if (!sidebarUser.isAdmin && !sidebarUser.hasActiveGroup) redirect("/workspace");
  const admin = createAdminClient();
  const { data: semester } = await admin.from("semesters").select("id,name").eq("status", "active").maybeSingle();
  let folders: Array<{ id: string; parent_id: string | null; name: string; description: string; status: string }> = [];
  let lessons: Array<{ id: string; folder_id: string; title: string; content: string; video_url: string; status: string; created_at: string; embedUrl: string | null }> = [];
  if (semester) {
    const [foldersResult, lessonsResult] = await Promise.all([
      admin.from("lesson_folders").select("id,parent_id,name,description,status").eq("semester_id", semester.id).order("name"),
      admin.from("lessons").select("id,folder_id,title,content,video_url,status,created_at").eq("semester_id", semester.id).order("created_at", { ascending: false }),
    ]);
    const allFolders = foldersResult.data ?? [];
    const folderMap = new Map(allFolders.map(folder => [folder.id, folder]));
    const visible = (id: string) => {
      const seen = new Set<string>();
      let current: string | null = id;
      while (current) {
        if (seen.has(current)) return false;
        seen.add(current);
        const folder = folderMap.get(current);
        if (!folder || folder.status !== "active") return false;
        current = folder.parent_id;
      }
      return true;
    };
    folders = sidebarUser.isAdmin ? allFolders : allFolders.filter(folder => visible(folder.id));
    lessons = (lessonsResult.data ?? [])
      .filter(lesson => sidebarUser.isAdmin || (lesson.status === "published" && visible(lesson.folder_id)))
      .map(lesson => ({ ...lesson, embedUrl: lessonEmbedUrl(lesson.video_url) }));
  }
  return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content"><LessonsClient semester={semester} folders={folders} lessons={lessons} isAdmin={sidebarUser.isAdmin}/></main></div>;
}
