import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-request";
import { createAdminClient } from "@/lib/supabase/admin";

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
