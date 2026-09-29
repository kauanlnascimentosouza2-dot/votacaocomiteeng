import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const TYPES=new Set(["update","activity","achievement","challenge"]); const IMAGES=new Set(["image/jpeg","image/png","image/webp"]);

export async function POST(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Faça login para continuar."},{status:401});
  const form=await request.formData();const semesterId=String(form.get("semesterId")??"");const title=String(form.get("title")??"").trim();const content=String(form.get("content")??"").trim();const postType=String(form.get("postType")??"update");
  if(!semesterId||title.length<3||content.length<5||!TYPES.has(postType))return NextResponse.json({error:"Preencha título, conteúdo e categoria."},{status:400});
  const files=form.getAll("images").filter((file):file is File=>file instanceof File&&file.size>0);if(files.length>10)return NextResponse.json({error:"Envie no máximo 10 fotos."},{status:400});for(const file of files)if(!IMAGES.has(file.type)||file.size>10*1024*1024)return NextResponse.json({error:"As fotos devem ser JPG, PNG ou WebP e ter até 10 MB."},{status:400});
  const admin=createAdminClient();const {data:semester}=await admin.from("semesters").select("id").eq("id",semesterId).maybeSingle();if(!semester)return NextResponse.json({error:"Edição inválida."},{status:400});
  const {data:post,error}=await admin.from("community_posts").insert({author_id:user.id,semester_id:semesterId,title,content,post_type:postType,status:"pending"}).select().single();if(error||!post)return NextResponse.json({error:"Não foi possível enviar a publicação."},{status:400});
  const uploaded=[] as Array<{post_id:string;image_path:string;position:number}>;for(let i=0;i<files.length;i++){const file=files[i];const ext=file.name.split(".").pop()?.replace(/[^a-z0-9]/gi,"").toLowerCase()||"webp";const path=`${semesterId}/${post.id}/${randomUUID()}.${ext}`;const {error:uploadError}=await admin.storage.from("community-media").upload(path,Buffer.from(await file.arrayBuffer()),{contentType:file.type});if(!uploadError)uploaded.push({post_id:post.id,image_path:path,position:i});}if(uploaded.length)await admin.from("community_post_images").insert(uploaded);
  return NextResponse.json({ok:true},{status:201});
}

export async function PATCH(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Faça login para continuar."},{status:401});const body=await request.json().catch(()=>({})) as {postId?:string;title?:string;content?:string;postType?:string};if(!body.postId||!body.title?.trim()||!body.content?.trim()||!TYPES.has(body.postType??""))return NextResponse.json({error:"Dados inválidos."},{status:400});
  const admin=createAdminClient();const {data:post}=await admin.from("community_posts").select("author_id").eq("id",body.postId).maybeSingle();const adminMode=await isAdmin(user);if(!post)return NextResponse.json({error:"Publicação não encontrada."},{status:404});if(post.author_id!==user.id&&!adminMode)return NextResponse.json({error:"Sem permissão."},{status:403});
  const {error}=await admin.from("community_posts").update({title:body.title.trim(),content:body.content.trim(),post_type:body.postType,status:adminMode?"approved":"pending",approved_by:adminMode?user.id:null,approved_at:adminMode?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",body.postId);if(error)return NextResponse.json({error:"Não foi possível atualizar."},{status:400});return NextResponse.json({ok:true});
}

export async function DELETE(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Faça login para continuar."},{status:401});const body=await request.json().catch(()=>({})) as {postId?:string};if(!body.postId)return NextResponse.json({error:"Publicação inválida."},{status:400});const admin=createAdminClient();const {data:post}=await admin.from("community_posts").select("author_id").eq("id",body.postId).maybeSingle();if(!post)return NextResponse.json({error:"Não encontrada."},{status:404});if(post.author_id!==user.id&&!await isAdmin(user))return NextResponse.json({error:"Sem permissão."},{status:403});const {error}=await admin.from("community_posts").delete().eq("id",body.postId);if(error)return NextResponse.json({error:"Não foi possível excluir."},{status:400});return NextResponse.json({ok:true});
}
