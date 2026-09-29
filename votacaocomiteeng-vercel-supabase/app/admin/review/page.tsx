import { redirect } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";
import { currentUserView } from "@/lib/current-user-view";
import { signedProjectFile } from "@/lib/project-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ReviewClient from "./review-client";

export const dynamic="force-dynamic";
export default async function ReviewPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const sidebarUser=await currentUserView(user);if(!sidebarUser.isAdmin)redirect("/");const admin=createAdminClient();const {data:projects}=await admin.from("projects").select("*, demands(title,submission_due_at,publication_at), groups(name)").in("status",["submitted","late","review","changes_requested","approved"]).order("submitted_at",{ascending:false});const rows=await Promise.all((projects??[]).map(async project=>({...project,mainImageUrl:await signedProjectFile(admin,project.main_image_url),pdfUrl:await signedProjectFile(admin,project.pdf_url)})));return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content"><ReviewClient projects={rows}/></main></div>;}
