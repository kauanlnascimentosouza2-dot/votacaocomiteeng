import { redirect } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";
import { currentUserView } from "@/lib/current-user-view";
import { signedProjectFile } from "@/lib/project-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ReviewClient from "./review-client";

export const dynamic = "force-dynamic";

type SubmissionRelation = {
  id: string;
  project_id: string;
  notes: string;
  is_late: boolean;
  submitted_at: string;
  deliverables: { title: string } | Array<{ title: string }> | null;
};

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const sidebarUser = await currentUserView(user);
  if (!sidebarUser.isAdmin) redirect("/");

  const admin = createAdminClient();
  const { data: projects } = await admin
    .from("projects")
    .select("*, demands(title,description,submission_due_at,publication_at), groups(name)")
    .in("status", ["submitted", "late", "review", "changes_requested", "approved", "published"])
    .order("submitted_at", { ascending: false });

  const projectIds = (projects ?? []).map((project) => project.id);
  const [{ data: images }, { data: submissions }] = projectIds.length
    ? await Promise.all([
        admin.from("project_images").select("id,project_id,image_url,position").in("project_id", projectIds).order("position"),
        admin.from("submissions").select("id,project_id,notes,is_late,submitted_at,deliverables(title)").in("project_id", projectIds).order("submitted_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const submissionRows = (submissions ?? []) as unknown as SubmissionRelation[];
  const submissionIds = submissionRows.map((submission) => submission.id);
  const { data: storedFiles } = submissionIds.length
    ? await admin.from("submission_files").select("id,submission_id,file_name,file_url,size_bytes").in("submission_id", submissionIds)
    : { data: [] };

  const signedImages = await Promise.all((images ?? []).map(async (image) => ({
    ...image,
    signedUrl: await signedProjectFile(admin, image.image_url),
  })));
  const signedFiles = await Promise.all((storedFiles ?? []).map(async (file) => ({
    ...file,
    downloadUrl: await signedProjectFile(admin, file.file_url, file.file_name),
  })));

  const rows = await Promise.all((projects ?? []).map(async (project) => ({
    ...project,
    mainImageUrl: await signedProjectFile(admin, project.main_image_url),
    pdfUrl: await signedProjectFile(admin, project.pdf_url),
    images: signedImages.filter((image) => image.project_id === project.id),
    files: submissionRows.flatMap((submission) => {
      if (submission.project_id !== project.id) return [];
      const deliverable = Array.isArray(submission.deliverables) ? submission.deliverables[0] : submission.deliverables;
      return signedFiles
        .filter((file) => file.submission_id === submission.id)
        .map((file) => ({
          id: file.id,
          fileName: file.file_name,
          sizeBytes: Number(file.size_bytes),
          downloadUrl: file.downloadUrl,
          deliverableTitle: deliverable?.title ?? "Entrega do projeto",
          submittedAt: submission.submitted_at,
          isLate: submission.is_late,
          notes: submission.notes,
        }));
    }),
  })));

  return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content"><ReviewClient projects={rows}/></main></div>;
}
