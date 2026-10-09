import { redirect } from 'next/navigation';
import AppSidebar from '@/components/app-sidebar';
import { currentUserView } from '@/lib/current-user-view';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { signedProjectFile } from '@/lib/project-access';
import RoundsClient, { RoundView, DemandOption } from './rounds-client';
import { readAllRows } from '@/lib/read-all-rows';
export const dynamic='force-dynamic';
export default async function HomePage({searchParams}:{searchParams:Promise<{view?:string}>}){
  const {data:{user}}=await (await createClient()).auth.getUser();if(!user)redirect('/login');
  const view=await currentUserView(user);if(!view.isAdmin&&!view.hasActiveGroup)redirect('/workspace');
  const db=createAdminClient();
  const [{data:semester},{data:rounds,error:roundError},{data:oldPolls}]=await Promise.all([
    db.from('semesters').select('id,status').eq('status','active').maybeSingle(),
    readAllRows((a,b)=>db.from('voting_rounds').select('*,demands!inner(id,title,status,semester_id)').order('created_at',{ascending:false}).order('id').range(a,b)),
    readAllRows((a,b)=>db.from('polls').select('id,title,status,ends_at').order('created_at',{ascending:false}).order('id').range(a,b)),
  ]);
  const ids=(rounds??[]).map(r=>r.id);
  const [{data:options,error:optionError},{data:ballots,error:ballotError},{data:participation,error:participationError},{data:membership},{data:snapshots}]=await Promise.all([
    ids.length?readAllRows((a,b)=>db.from('round_projects').select('round_id,projects!inner(id,title,description,group_id,main_image_url,pdf_url,external_links,groups(name))').in('round_id',ids).order('round_id').order('project_id').range(a,b)):Promise.resolve({data:[],error:null}),
    ids.length?readAllRows((a,b)=>db.from('ballots').select('id,round_id,project_id').in('round_id',ids).order('id').range(a,b)):Promise.resolve({data:[],error:null}),
    ids.length?readAllRows((a,b)=>db.from('voter_participation').select('round_id,user_id,ballot_id,changes_used').in('round_id',ids).order('round_id').order('user_id').range(a,b)):Promise.resolve({data:[],error:null}),
    semester?db.from('group_members').select('group_id').eq('semester_id',semester.id).eq('user_id',user.id).maybeSingle():Promise.resolve({data:null}),
    db.from('demand_group_members').select('demand_id,group_id').eq('user_id',user.id),
  ]);
  const {data:profiles}=view.isAdmin?await readAllRows((a,b)=>db.from('profiles').select('id,name,email').order('id').range(a,b)):{data:[]};
  const now=Date.now();
  const loadError=Boolean(roundError||optionError||ballotError||participationError);
  const rows:RoundView[]=await Promise.all((loadError?[]:rounds??[]).map(async r=>{
    const closed=!['scheduled','open'].includes(r.status)||Boolean(r.ends_at&&Date.parse(r.ends_at)<=now)||r.demands.status==='closed'||r.demands.semester_id!==semester?.id;
    const my=(participation??[]).find(p=>p.round_id===r.id&&p.user_id===user.id);
    const myBallot=(ballots??[]).find(b=>b.id===my?.ballot_id);
    const showResults=view.isAdmin||Boolean(r.results_published_at);
    return {id:r.id,title:r.demands.title,number:r.round_number,closed,startsAt:r.starts_at,endsAt:r.ends_at,published:Boolean(r.results_published_at),visibility:r.ballot_visibility,
      projects:await Promise.all((options??[]).filter(o=>o.round_id===r.id&&(view.isAdmin||((!r.starts_at||Date.parse(r.starts_at)<=now)&&(!closed||r.results_published_at)))).map(async o=>{
        const p=o.projects as unknown as {id:string;title:string;description:string;group_id:string;main_image_url:string|null;pdf_url:string|null;external_links:string[];groups:{name:string}|null};
        return {id:p.id,title:p.title,description:p.description,group:p.groups?.name??'Grupo',image:await signedProjectFile(db,p.main_image_url),pdf:await signedProjectFile(db,p.pdf_url),links:p.external_links??[],blocked:p.group_id===membership?.group_id||(snapshots??[]).some(s=>s.demand_id===r.demand_id&&s.group_id===p.group_id),votes:showResults?(ballots??[]).filter(b=>b.round_id===r.id&&b.project_id===p.id).length:null};
      })),myProject:myBallot?.project_id??null,changesUsed:my?.changes_used??0,
      participation:view.isAdmin?(participation??[]).filter(p=>p.round_id===r.id).map(p=>{const profile=(profiles??[]).find(x=>x.id===p.user_id);const ballot=(ballots??[]).find(b=>b.id===p.ballot_id);return {name:profile?.name||profile?.email||'Participante',projectId:r.ballot_visibility==='open'?ballot?.project_id??null:null};}):[],
    };
  }));
  let demands:DemandOption[]=[];
  if(view.isAdmin&&semester){
    const {data:d}=await db.from('demands').select('id,title,publication_at,voting_starts_at,voting_ends_at').eq('semester_id',semester.id).eq('voting_enabled',true).neq('status','closed');
    const {data:p}=await db.from('projects').select('id,demand_id,title,groups(name)').in('status',['approved','published']).in('demand_id',(d??[]).map(x=>x.id));
    demands=(d??[]).map(x=>({id:x.id,title:x.title,startsAt:x.voting_starts_at,endsAt:x.voting_ends_at,publicationAt:x.publication_at,projects:(p??[]).filter(y=>y.demand_id===x.id).map(y=>({id:y.id,title:y.title,group:(y.groups as unknown as {name:string}|null)?.name??'Grupo'}))}));
  }
  return <div className="app-frame"><AppSidebar user={view}/><main className="app-content"><RoundsClient rounds={rows} demands={demands} legacy={(oldPolls??[]).filter(p=>view.isAdmin||(p.status==='active'&&(!p.ends_at||Date.parse(p.ends_at)>now)))} isAdmin={view.isAdmin} adminTab={(await searchParams).view==='admin'} migrationError={loadError}/></main></div>;
}
