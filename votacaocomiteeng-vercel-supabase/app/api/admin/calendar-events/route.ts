import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivityNotifications } from "@/lib/activity-notifications";

export async function POST(request:Request){
  const {user,allowed}=await requireAdmin();
  if(!user)return NextResponse.json({error:"Faça login para continuar."},{status:401});
  if(!allowed)return NextResponse.json({error:"Acesso exclusivo do administrador."},{status:403});
  const body=await request.json().catch(()=>({})) as {semesterId?:string;title?:string;description?:string;startsAt?:string;endsAt?:string|null;location?:string;audience?:"all"|"groups"|"admins";groupIds?:string[]};
  if(!body.semesterId||!body.title?.trim()||!body.startsAt)return NextResponse.json({error:"Informe título, semestre e data."},{status:400});
  if(body.endsAt&&new Date(body.endsAt)<new Date(body.startsAt))return NextResponse.json({error:"O término deve ser posterior ao início."},{status:400});
  const admin=createAdminClient();
  const audience=body.audience??"all";
  if(audience==="groups"&&!(body.groupIds??[]).length)return NextResponse.json({error:"Selecione ao menos um grupo."},{status:400});
  const {data:event,error}=await admin.from("calendar_events").insert({semester_id:body.semesterId,title:body.title.trim(),description:body.description?.trim()??"",category:"custom",audience,starts_at:body.startsAt,ends_at:body.endsAt||null,location:body.location?.trim()||null,created_by:user.id}).select().single();
  if(error||!event)return NextResponse.json({error:"Não foi possível criar o evento."},{status:400});
  if(audience==="groups")await admin.from("calendar_event_groups").insert([...(new Set(body.groupIds))].map(groupId=>({event_id:event.id,group_id:groupId})));
  const {data:groups}=await admin.from("groups").select("id").eq("semester_id",body.semesterId).eq("status","active");
  const eligibleIds=(groups??[]).map(group=>group.id).filter(id=>audience!=="groups"||(body.groupIds??[]).includes(id));
  const {data:members}=audience!=="admins"&&eligibleIds.length?await admin.from("group_members").select("user_id").in("group_id",eligibleIds):{data:[]};
  const {data:admins}=audience==="admins"?await admin.from("admins").select("email"):{data:[]};
  const adminEmails=(admins??[]).map(item=>item.email.toLowerCase());
  const {data:adminProfiles}=adminEmails.length?await admin.from("profiles").select("id").in("email",adminEmails):{data:[]};
  await createActivityNotifications({semesterId:body.semesterId,recipientIds:[...(members??[]).map(member=>member.user_id),...(adminProfiles??[]).map(profile=>profile.id)],eventKey:`calendar:${event.id}`,kind:"calendar",title:`Novo evento: ${event.title}`,message:"Confira a data no cronograma.",href:"/calendar",origin:new URL(request.url).origin});
  return NextResponse.json(event,{status:201});
}

export async function DELETE(request:Request){
  const {user,allowed}=await requireAdmin();
  if(!user)return NextResponse.json({error:"Faça login para continuar."},{status:401});
  if(!allowed)return NextResponse.json({error:"Acesso exclusivo do administrador."},{status:403});
  const body=await request.json().catch(()=>({})) as {eventId?:string};
  if(!body.eventId)return NextResponse.json({error:"Evento inválido."},{status:400});
  const {error}=await createAdminClient().from("calendar_events").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",body.eventId).eq("category","custom");
  if(error)return NextResponse.json({error:"Não foi possível cancelar o evento."},{status:400});
  return NextResponse.json({ok:true});
}
