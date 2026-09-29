import { redirect } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";
import { configuredAdminEmails } from "@/lib/auth";
import { currentUserView } from "@/lib/current-user-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import PeopleManager from "./people-manager";

export const dynamic="force-dynamic";
export default async function PeoplePage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const sidebarUser=await currentUserView(user);if(!sidebarUser.isAdmin)redirect("/");const admin=createAdminClient();const [{data:profiles},{data:semester},{data:storedAdmins}]=await Promise.all([admin.from("profiles").select("*").order("name"),admin.from("semesters").select("id").eq("status","active").maybeSingle(),admin.from("admins").select("email").order("created_at")]);let members:Array<{user_id:string;group_id:string;role:string}>=[];let groups:Array<{id:string;name:string}>=[];if(semester){const[result1,result2]=await Promise.all([admin.from("group_members").select("user_id,group_id,role").eq("semester_id",semester.id),admin.from("groups").select("id,name").eq("semester_id",semester.id)]);members=result1.data??[];groups=result2.data??[];}const groupMap=new Map(groups.map(group=>[group.id,group.name]));const rows=(profiles??[]).map(profile=>{const member=members.find(item=>item.user_id===profile.id);return{...profile,groupName:member?groupMap.get(member.group_id):null,groupRole:member?.role??null};});const admins=[...new Set([...configuredAdminEmails(),...(storedAdmins??[]).map(item=>item.email)])];return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content"><PeopleManager people={rows} admins={admins}/></main></div>;}
