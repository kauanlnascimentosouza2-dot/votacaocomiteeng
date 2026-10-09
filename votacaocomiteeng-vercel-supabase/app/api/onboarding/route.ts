import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
export async function POST(){
  const {data:{user}}=await (await createClient()).auth.getUser();
  if(!user)return NextResponse.json({error:'Faça login.'},{status:401});
  const {error}=await createAdminClient().from('profiles').update({onboarding_completed_at:new Date().toISOString()}).eq('id',user.id);
  return NextResponse.json({ok:!error},{status:error?400:200});
}
