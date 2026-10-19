import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { AdminAuthError, requireServerAdmin } from '@/lib/admin-auth';
import { validId, validText } from '@/lib/status-updates';
const headers = { 'Cache-Control': 'private, no-store' };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });
function failure(error: unknown) {
 if (error instanceof AdminAuthError) return json({ error: error.status === 401 ? 'Your session expired. Please sign in again.' : 'Admin access required.' }, error.status);
 const code = (error as { code?: string })?.code;
 if (code === '40001') return json({ error: 'This content changed. Refresh before editing again.' }, 409);
 if (code === '42501') return json({ error: 'You do not have permission for this action.' }, 403);
 if (code === '22023') return json({ error: 'Content is unavailable or the request is invalid. Refresh and try again.' }, 400);
 return json({ error: 'Status Updates is unavailable. Please try again later.' }, 503);
}
async function session() {
 const db = await supabaseServer();
 const { data, error } = await db.auth.getUser();
 if (error || !data.user) throw new AdminAuthError('Unauthorized', 401);
 return { db, user: data.user };
}
export async function GET(request: Request) {
 try {
  const { db, user } = await session();
  const q = new URL(request.url).searchParams, id = q.get('id'), cursor = q.get('cursor'), cursorId = q.get('cursor_id');
  if ((id && !validId(id)) || (!!cursor !== !!cursorId) || (cursorId && !validId(cursorId)) || (cursor && (cursor.length > 40 || !Number.isFinite(Date.parse(cursor))))) return json({ error: 'Invalid page.' }, 400);
  const management = q.get('management') === '1';
  if (management) await requireServerAdmin();
  const admin = management;
  if (!management && (q.get('drafts') === '1' || q.get('hidden') === '1')) return json({error:'Admin management required.'},403);
  if (!id) {
   if (q.get('drafts') === '1') {
    await requireServerAdmin();
    let query = db.from('status_updates').select('id,headline,published_at,created_at,revision,publication_status').eq('publication_status','draft').is('deleted_at',null).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(25);
    if (cursor && cursorId) query = query.or(`created_at.lt.${new Date(cursor).toISOString()},and(created_at.eq.${new Date(cursor).toISOString()},id.lt.${cursorId})`);
    const result = await query; if(result.error) throw result.error;
    return json({ rows: result.data, admin, user_id: user.id });
   }
   const result = await db.rpc('list_status_updates_v1',{ p_before: cursor, p_before_id: cursorId, p_limit:25 });
   if(result.error) throw result.error;
   return json({ rows:result.data, admin, user_id:user.id });
  }
  const result = await db.from('status_updates').select('id,headline,body,published_at,created_at,revision,publication_status').eq('id',id).is('deleted_at',null).maybeSingle();
  if(result.error) throw result.error;
  if(!result.data || (!admin && result.data.publication_status !== 'published')) return json({error:'Update not found.'},404);
  let comments;
  if(q.get('hidden') === '1') {
   await requireServerAdmin();
   let query = db.from('status_update_comments').select('id,author_id,body,created_at,revision,moderation_status').eq('update_id',id).eq('moderation_status','hidden').is('deleted_at',null).order('created_at').order('id').limit(50);
   if(cursor && cursorId) query=query.or(`created_at.gt.${new Date(cursor).toISOString()},and(created_at.eq.${new Date(cursor).toISOString()},id.gt.${cursorId})`);
   comments=await query;
  } else comments=await db.rpc('list_status_update_comments_v1',{p_update_id:id,p_after:cursor,p_after_id:cursorId,p_limit:50});
  if(comments.error) throw comments.error;
  const rows = (comments.data ?? []) as {author_id:string}[];
  const ids = [...new Set(rows.map(c=>c.author_id))];
  const names = new Map<string,string>();
  if(ids.length) {
   const profiles=await db.from('profiles').select('id,full_name,username').in('id',ids);
   if(profiles.error) throw profiles.error;
   for(const p of profiles.data ?? []) names.set(p.id,p.full_name?.trim() || p.username || 'ParPlay player');
  }
  return json({update:result.data,comments:rows.map(c=>({...c,author_name:names.get(c.author_id)??'ParPlay player'})),admin,user_id:user.id});
 } catch(error) { return failure(error); }
}
export async function POST(request: Request) {
 try {
  const { db, user } = await session();
  if(request.headers.get('origin') !== new URL(request.url).origin) return json({error:'Invalid request origin.'},403);
  const raw=await request.text(); if(raw.length>130000) return json({error:'Request too large.'},413);
  let b; try { b=JSON.parse(raw); } catch { return json({error:'Invalid request.'},400); }
  if(!b || typeof b!=='object') return json({error:'Invalid request.'},400);
  const comment=b.kind==='comment', official=b.kind==='update';
  if(!comment && !official) return json({error:'Invalid request.'},400);
  const allowed=comment?['create','edit','delete','hide','show']:['create','edit','publish','unpublish','delete'];
  if(!allowed.includes(b.action) || (b.action!=='create' && (!validId(b.id) || !Number.isSafeInteger(b.revision) || b.revision<0)) || (comment && !validId(b.update_id))) return json({error:'Invalid request.'},400);
  if(['create','edit'].includes(b.action) && (!validText(b.body,comment?2000:20000) || (official && !validText(b.headline,160)))) return json({error:'Please enter text within the allowed length.'},400);
  if(official || ['hide','show'].includes(b.action)) await requireServerAdmin();
  if(comment && ['edit','delete'].includes(b.action)) {
   const own=await db.from('status_update_comments').select('author_id').eq('id',b.id).eq('update_id',b.update_id).maybeSingle();
   if(own.error) throw own.error;
   if(own.data?.author_id !== user.id) return json({error:'You may only change your own comments.'},403);
  }
  const args={p_action:b.action,p_id:b.action==='create'?null:b.id,p_expected_revision:b.action==='create'?null:b.revision,p_body:['create','edit'].includes(b.action)?b.body:null};
  const result=comment ? await db.rpc('mutate_status_update_comment_v1',{...args,p_update_id:b.update_id}) : await db.rpc('mutate_status_update_v1',{...args,p_headline:['create','edit'].includes(b.action)?b.headline:null});
  if(result.error) throw result.error;
  return json({row:result.data});
 } catch(error) { return failure(error); }
}
