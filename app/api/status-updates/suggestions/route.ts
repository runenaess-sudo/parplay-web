import 'server-only';
import { supabaseServer } from '@/lib/supabase-server';

const reply=(status:number,body:Record<string,unknown>)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request) {
 const authorization=request.headers.get('authorization');
 const bearer=authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
 const origin=request.headers.get('origin');
 // Browser cookies still require same origin. Native bearer requests are verified
 // by the Edge Function; a bad bearer never falls back to browser cookies.
 if((origin!==null&&origin!==new URL(request.url).origin)||(!authorization&&origin===null))return reply(403,{error:'Request origin is not allowed.'});
 if(authorization&&!bearer)return reply(401,{error:'Invalid authentication.'});
 try {
  let token=bearer;
  if(!token){
   const db=await supabaseServer();
   const {data:{user},error}=await db.auth.getUser();
   if(error||!user)return reply(401,{error:'Please sign in to send a suggestion.'});
   const {data:{session},error:sessionError}=await db.auth.getSession();
   if(sessionError||!session||session.user.id!==user.id)return reply(401,{error:'Please sign in to send a suggestion.'});
   token=session.access_token;
  }
  const body=await request.text();
  if(new TextEncoder().encode(body).length>40000)return reply(413,{error:'Suggestion is too long.'});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return reply(503,{error:'Message could not be delivered.'});
  const response=await fetch(`${url.replace(/\/+$/,'')}/functions/v1/status-suggestion`,{
   method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(45000),
   headers:{Authorization:`Bearer ${token}`,apikey:key,'Content-Type':'application/json'},body,
  });
  const result=await response.json();
  if(response.status===200&&result?.state==='sent')return reply(200,{state:'sent'});
  const status=[202,400,401,403,409,413,429,503].includes(response.status)?response.status:503;
  return reply(status,{state:'unconfirmed',error:status===429?'Too many suggestions. Please try again later.':'Message could not be delivered.'});
 }catch{return reply(503,{state:'unknown',error:'Message could not be delivered.'});}
}
