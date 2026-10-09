import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/auth';
export async function POST(request:Request){
  const {data:{user}}=await (await createClient()).auth.getUser();
  if(!user)return NextResponse.json({error:'Faça login para votar.'},{status:401});
  const b=await request.json().catch(()=>({}));
  if(!b.roundId||!b.projectId)return NextResponse.json({error:'Selecione um projeto.'},{status:400});
  const {error}=await createAdminClient().rpc('cast_project_ballot',{p_round:b.roundId,p_project:b.projectId,p_user:user.id,p_admin:await isAdmin(user)});
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({ok:true});
}
