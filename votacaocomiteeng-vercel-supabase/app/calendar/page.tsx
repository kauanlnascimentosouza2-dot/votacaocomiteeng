import { redirect } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";
import { currentUserView } from "@/lib/current-user-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import CalendarClient from "./calendar-client";

export const dynamic="force-dynamic";

type CalendarItem={id:string;title:string;description:string;category:"demand"|"delivery"|"voting"|"publication"|"custom";startsAt:string;endsAt:string|null;status:"pending"|"completed"|"late"|"cancelled";source:string;allDay:boolean;location?:string|null};

export default async function CalendarPage(){
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
  const admin=createAdminClient(); const sidebarUser=await currentUserView(user);
  if(!sidebarUser.isAdmin&&!sidebarUser.hasActiveGroup)redirect("/workspace");
  const {data:semester}=await admin.from("semesters").select("id,name,status").eq("status","active").maybeSingle();
  if(!semester)return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content"><div className="feature-page"><section className="panel empty-demand"><p>Nenhum semestre ativo no cronograma.</p></section></div></main></div>;
  const {data:membership}=await admin.from("group_members").select("group_id").eq("semester_id",semester.id).eq("user_id",user.id).maybeSingle();
  const {data:groups}=sidebarUser.isAdmin?await admin.from("groups").select("id,name,status").eq("semester_id",semester.id).order("name"):{data:[]};
  let demandIds:string[]=[];
  if(sidebarUser.isAdmin){const {data}=await admin.from("demands").select("id").eq("semester_id",semester.id);demandIds=(data??[]).map(row=>row.id);}else if(membership){const {data}=await admin.from("demand_groups").select("demand_id").eq("group_id",membership.group_id);demandIds=(data??[]).map(row=>row.demand_id);}
  const [{data:demands},{data:deliverables},{data:projects},{data:submissions},{data:customEvents},{data:eventGroups}]=await Promise.all([
    demandIds.length?admin.from("demands").select("*").in("id",demandIds):Promise.resolve({data:[]}),
    demandIds.length?admin.from("deliverables").select("*").in("demand_id",demandIds):Promise.resolve({data:[]}),
    membership&&demandIds.length?admin.from("projects").select("id,demand_id,status").eq("group_id",membership.group_id).in("demand_id",demandIds):Promise.resolve({data:[]}),
    membership?admin.from("submissions").select("deliverable_id,submitted_at,is_late").eq("group_id",membership.group_id):Promise.resolve({data:[]}),
    admin.from("calendar_events").select("*").eq("semester_id",semester.id).neq("status","cancelled").order("starts_at"),
    admin.from("calendar_event_groups").select("event_id,group_id"),
  ]);
  const submissionIds=new Set((submissions??[]).map(item=>item.deliverable_id)); const now=Date.now(); const items:CalendarItem[]=[];
  const {data:rounds}=await admin.from('voting_rounds').select('id,demand_id,round_number,status,starts_at,ends_at,demands!inner(title,semester_id)').eq('demands.semester_id',semester.id);
  for(const demand of demands??[]){
    if(demand.submission_opens_at)items.push(item(`demand-open-${demand.id}`,`Abertura: ${demand.title}`,demand.description,"demand",demand.submission_opens_at,null,"pending","demand"));
    if(demand.publication_at)items.push(item(`publication-${demand.id}`,`Publicação: ${demand.title}`,"Publicação programada dos projetos aprovados.","publication",demand.publication_at,null,"pending","demand"));
    if(demand.voting_enabled&&demand.voting_starts_at&&!(rounds??[]).some(r=>r.demand_id===demand.id))items.push(item(`vote-start-${demand.id}`,`Início da votação: ${demand.title}`,"Abertura da votação.","voting",demand.voting_starts_at,demand.voting_ends_at,"pending","demand"));
  }
  for(const r of rounds??[]){const title=(r.demands as unknown as {title:string}).title;const finished=!['scheduled','open'].includes(r.status)||Boolean(r.ends_at&&Date.parse(r.ends_at)<=now);if(r.starts_at)items.push(item(`round-start-${r.id}`,`Votação: ${title} · rodada ${r.round_number}`,'Abertura da rodada de votação.','voting',r.starts_at,r.ends_at,finished?'completed':'pending','round'));if(r.ends_at)items.push(item(`round-end-${r.id}`,`Fim da votação: ${title} · rodada ${r.round_number}`,'Encerramento da rodada de votação.','voting',r.ends_at,null,finished?'completed':'pending','round'));}
  for(const delivery of deliverables??[]){if(!delivery.due_at)continue;const completed=submissionIds.has(delivery.id);const status=completed?"completed":new Date(delivery.due_at).getTime()<now?"late":"pending";items.push(item(`delivery-${delivery.id}`,delivery.title,delivery.instructions,"delivery",delivery.due_at,null,status,"deliverable"));}
  const groupEventIds=new Set((eventGroups??[]).filter(row=>row.group_id===membership?.group_id).map(row=>row.event_id));
  const saoPauloDay=(value:string|Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
  for(const event of customEvents??[]){const visible=sidebarUser.isAdmin||event.audience==="all"||(event.audience==="groups"&&groupEventIds.has(event.id));if(visible){const status=event.status==="completed"?"completed":event.all_day&&saoPauloDay(event.starts_at)<saoPauloDay(new Date())?"late":"pending";items.push(item(event.id,event.title,event.description,event.category==="delivery"?"delivery":"custom",event.starts_at,event.ends_at,status,"custom",event.location,Boolean(event.all_day)));}}
  return <div className="app-frame"><AppSidebar user={sidebarUser}/><main className="app-content"><CalendarClient semester={semester} initialItems={items} groups={groups??[]} isAdmin={sidebarUser.isAdmin}/></main></div>;
}
function item(id:string,title:string,description:string,category:CalendarItem["category"],startsAt:string,endsAt:string|null,status:CalendarItem["status"],source:string,location?:string|null,allDay=false):CalendarItem{return{id,title,description,category,startsAt,endsAt,status,source,location,allDay};}
