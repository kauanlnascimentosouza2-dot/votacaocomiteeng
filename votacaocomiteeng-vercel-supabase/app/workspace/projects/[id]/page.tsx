import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { projectAccess, signedProjectFile } from "@/lib/project-access";
import ProjectEditor from "./project-editor";
import AppSidebar from "@/components/app-sidebar";
import { currentUserView } from "@/lib/current-user-view";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const sidebarUser = await currentUserView(user);
  const { id } = await params;
  const access = await projectAccess(user, id);
  if (!access.project || !access.allowed) redirect("/workspace");
  const [{ data: demand }, { data: deliverables }, { data: submissions }, { data: images }] = await Promise.all([
    access.admin.from("demands").select("*").eq("id", access.project.demand_id).single(),
    access.admin.from("deliverables").select("*").eq("demand_id", access.project.demand_id).order("position"),
    access.admin.from("submissions").select("id, deliverable_id, notes, is_late, submitted_at").eq("project_id", id).order("submitted_at", { ascending: false }),
    access.admin.from("project_images").select("id, image_url, position").eq("project_id", id).order("position"),
  ]);
  const [mainImageUrl, pdfUrl, signedImages] = await Promise.all([
    signedProjectFile(access.admin, access.project.main_image_url),
    signedProjectFile(access.admin, access.project.pdf_url),
    Promise.all((images ?? []).map(async (image) => ({ ...image, signedUrl: await signedProjectFile(access.admin, image.image_url) }))),
  ]);
  return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content semester-shell"><div className="project-editor-main"><ProjectEditor project={{ ...access.project, mainImageUrl, pdfUrl, images: signedImages }} demand={demand} deliverables={deliverables ?? []} submissions={submissions ?? []} canSubmitFinal={access.adminMode || access.member?.role === "leader"}/></div></main></div>;
}
