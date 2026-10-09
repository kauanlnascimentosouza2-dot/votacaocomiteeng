import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-request';
import { createAdminClient } from '@/lib/supabase/admin';
export async function POST(request:Request){
  const {user,allowed}=await requireAdmin();
  if(!user||!allowed)return NextResponse.json({error:'Acesso exclusivo do administrador.'},{status:403});
  const b=await request.json().catch(()=>({}));
  if(!['create','close','publish','tie'].includes(b.action))return NextResponse.json({error:'Ação inválida.'},{status:400});
  const admin=createAdminClient();
  const {data,error}=await admin.rpc('manage_project_round',{p_action:b.action,p_demand:b.demandId||null,p_round:b.roundId||null,p_projects:b.projectIds||[],p_start:b.startsAt||null,p_end:b.endsAt||null});
  if(!error&&data){const {data:round}=await admin.from('voting_rounds').select('demand_id').eq('id',data).maybeSingle();const {data:demand}=round?await admin.from('demands').select('semester_id').eq('id',round.demand_id).maybeSingle():{data:null};await admin.from('audit_logs').insert({semester_id:demand?.semester_id,actor_user_id:user.id,actor_email:user.email??'',action:`round_${b.action}`,entity_type:'voting_round',entity_id:data});}
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({id:data});
}
