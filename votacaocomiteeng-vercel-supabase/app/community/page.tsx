import { redirect } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";
import { currentUserView } from "@/lib/current-user-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import CommunityClient from "./community-client";

export const dynamic="force-dynamic";

export default async function CommunityPage(){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const admin=createAdminClient();const sidebarUser=await currentUserView(user);
  const [{data:semesters},{data:activeSemester},{data:posts}]=await Promise.all([admin.from("semesters").select("id,name,status").order("created_at",{ascending:false}),admin.from("semesters").select("id,name").eq("status","active").maybeSingle(),admin.from("community_posts").select("*").or(`status.eq.approved,author_id.eq.${user.id}`).order("created_at",{ascending:false})]);
  const postIds=(posts??[]).map(post=>post.id);const authorIds=[...new Set((posts??[]).map(post=>post.author_id))];
  const [{data:profiles},{data:images},{data:comments}]=await Promise.all([authorIds.length?admin.from("profiles").select("id,name,email,avatar_path,specialty").in("id",authorIds):Promise.resolve({data:[]}),postIds.length?admin.from("community_post_images").select("*").in("post_id",postIds).order("position"):Promise.resolve({data:[]}),postIds.length?admin.from("community_comments").select("*").in("post_id",postIds).eq("status","published").order("created_at"):Promise.resolve({data:[]})]);
  const commentAuthors=[...new Set((comments??[]).map(comment=>comment.author_id))];const {data:commentProfiles}=commentAuthors.length?await admin.from("profiles").select("id,name,email,avatar_path,specialty").in("id",commentAuthors):{data:[]};
  const allProfiles=[...(profiles??[]),...(commentProfiles??[])];const profileMap=new Map(allProfiles.map(profile=>[profile.id,profile]));
  const signedPosts=await Promise.all((posts??[]).map(async post=>{const author=profileMap.get(post.author_id);let authorAvatar=null;if(author?.avatar_path){const {data}=await admin.storage.from("profile-images").createSignedUrl(author.avatar_path,3600);authorAvatar=data?.signedUrl??null;}const postImages=await Promise.all((images??[]).filter(image=>image.post_id===post.id).map(async image=>{const {data}=await admin.storage.from("community-media").createSignedUrl(image.image_path,3600);return{id:image.id,url:data?.signedUrl??null};}));const postComments=await Promise.all((comments??[]).filter(comment=>comment.post_id===post.id).map(async comment=>{const person=profileMap.get(comment.author_id);let avatarUrl=null;if(person?.avatar_path){const {data}=await admin.storage.from("profile-images").createSignedUrl(person.avatar_path,3600);avatarUrl=data?.signedUrl??null;}return{...comment,authorName:person?.name||person?.email||"Participante",avatarUrl,canDelete:comment.author_id===user.id||sidebarUser.isAdmin};}));return{...post,authorName:author?.name||author?.email||"Participante",authorSpecialty:author?.specialty,authorAvatar,images:postImages,comments:postComments,canEdit:post.author_id===user.id||sidebarUser.isAdmin};}));
  return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content"><CommunityClient userId={user.id} semesters={semesters??[]} activeSemester={activeSemester} initialPosts={signedPosts}/></main></div>;
}
