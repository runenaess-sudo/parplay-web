import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';
import { validId, validText } from '@/lib/status-updates';
import { sendSuggestion } from '@/lib/suggestion-delivery';

const reply=(status:number,body:Record<string,unknown>)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request) {
 const authorization=request.headers.get('authorization');
 const bearer=authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
 const origin=request.headers.get('origin');
 // Cookie requests still require same origin. Native requests use an explicit,
 // independently verified bearer token; invalid bearers never fall back to cookies.
 if((origin!==null&&origin!==new URL(request.url).origin)||(!authorization&&origin===null))return reply(403,{error:'Request origin is not allowed.'});
 if(authorization&&!bearer)return reply(401,{error:'Invalid authentication.'});
 try {
  const db=bearer?createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
   auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${bearer}`}},
  }):await supabaseServer();
  const {data:{user},error:authError}=await db.auth.getUser(bearer);
  if(authError||!user)return reply(401,{error:'Please sign in to send a suggestion.'});
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>40000)return reply(413,{error:'Suggestion is too long.'});
  let body;
  try{body=JSON.parse(raw);}catch{return reply(400,{error:'Invalid suggestion.'});}
  if(!body||!validId(body.id)||!validText(body.subject,160)||!validText(body.body,5000))
   return reply(400,{error:'Enter a subject (up to 160 characters) and suggestion (up to 5,000 characters).'});
  const {data:saved,error}=await db.rpc('submit_status_suggestion_v1',{p_id:body.id,p_subject:body.subject,p_body:body.body});
  if(error){
   if(error.message==='SUGGESTION_RATE_LIMIT')return reply(429,{error:'Too many suggestions. Please try again later with this same submission.'});
   if(error.message==='SUGGESTION_ID_REUSED')return reply(409,{error:'This submission ID already belongs to different content. Keep the original suggestion for retry.'});
   return reply(503,{error:'Could not confirm storage. Keep this form and retry the same submission.'});
  }
  if(saved?.state==='sent')return reply(200,{state:'sent'});
  // Storage succeeds even when delivery credentials are temporarily unavailable.
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY,key=process.env.RESEND_API_KEY;
  if(!secret||!key)return reply(503,{error:'Suggestion saved. Email delivery is unavailable; please retry later.'});
  const service=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:claim,error:claimError}=await service.rpc('claim_status_suggestion_v1',{p_id:body.id,p_owner:user.id});
  if(claimError||!claim)return reply(503,{error:'Suggestion saved. Could not confirm delivery; retry later.'});
  if(claim.state==='sent')return reply(200,{state:'sent'});
  if(claim.state==='review')return reply(202,{state:'review',error:'Suggestion saved. Delivery needs support review. Do not submit a duplicate. Reference: '+body.id});
  if(!claim.lease_id)return reply(202,{state:'waiting',error:'Suggestion saved. Delivery is pending; retry after one minute.'});
  const outcome=await sendSuggestion(claim,key);
  const {data:completed,error:completeError}=await service.rpc('complete_status_suggestion_v1',{
   p_id:body.id,p_lease:claim.lease_id,p_state:outcome.state,p_provider:outcome.provider,p_error:outcome.error});
  if(outcome.state==='sent'&&completed&&!completeError)return reply(200,{state:'sent'});
  return reply(202,{state:outcome.state==='failed'?'failed':'unknown',error:'Suggestion saved, but email delivery is not confirmed. Retry this same submission after one minute.'});
 } catch {
  return reply(503,{error:'Outcome could not be confirmed. Keep this form and retry the same submission.'});
 }
}
