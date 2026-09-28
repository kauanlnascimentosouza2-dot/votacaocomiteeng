import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { projectAccess, signedProjectFile } from "@/lib/project-access";
import ProjectEditor from "./project-editor";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
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
  return <div className="semester-shell"><header className="semester-topbar"><Link href="/workspace">← Voltar para o grupo</Link><strong>{demand?.title}</strong><span>{access.member?.role === "leader" ? "Líder do grupo" : access.adminMode ? "Administrador" : "Integrante"}</span></header><main className="project-editor-main"><ProjectEditor project={{ ...access.project, mainImageUrl, pdfUrl, images: signedImages }} demand={demand} deliverables={deliverables ?? []} submissions={submissions ?? []} canSubmitFinal={access.adminMode || access.member?.role === "leader"}/></main></div>;
}
