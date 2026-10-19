'use client';
import Link from 'next/link';
import SuggestImprovement from './SuggestImprovement';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { statusDate, validText, type Update, type Comment } from '@/lib/status-updates';
const button='rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-40';
const primary=button+' bg-orange-500 text-slate-950 hover:bg-orange-400 font-semibold';
const input='w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white';
type Cursor={cursor:string;cursor_id:string};
type Data={rows?:Update[];update?:Update;comments?:Comment[];admin:boolean;user_id:string};
type Editor={id?:string;revision?:number;headline:string;body:string};
export default function StatusUpdates({id,management=false}:{id?:string;management?:boolean}) {
 const router=useRouter();
 const listHref=management?'/admin/suggestions?view=updates':'/status-updates';
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[unauthorized,setUnauthorized]=useState(false);
 const [revision,setRevision]=useState(0),[cursors,setCursors]=useState<(Cursor|null)[]>([null]);
 const [drafts,setDrafts]=useState(false),[hidden,setHidden]=useState(false);
 const [editor,setEditor]=useState<Editor|null>(null),[comment,setComment]=useState('');
 const [editing,setEditing]=useState<Comment|null>(null),[confirmed,setConfirmed]=useState('');
 const lock=useRef(false),generation=useRef(0);
 const cursor=cursors[cursors.length-1];
 function refresh(reset=false){setLoading(true);setError('');setNotice('');setConfirmed('');if(reset)setCursors([null]);setRevision(v=>v+1);}
 useEffect(()=>{
  const epoch=generation;
  const {data:sub}=supabaseBrowser.auth.onAuthStateChange((event)=>{
   if(event==='SIGNED_OUT'||event==='SIGNED_IN'){
    generation.current++;setData(null);setEditor(null);setComment('');setEditing(null);setConfirmed('');setDrafts(false);setHidden(false);setCursors([null]);setLoading(true);setRevision(v=>v+1);
   }
  });
  return()=>{epoch.current++;sub.subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  const abort=new AbortController();
  const query=new URLSearchParams({...cursor,...(id?{id}:{}),...(management?{management:'1'}:{}),...(drafts?{drafts:'1'}:{}),...(hidden?{hidden:'1'}:{})});
  void fetch('/api/status-updates?'+query,{cache:'no-store',signal:abort.signal}).then(async response=>{
   const value=await response.json();if(abort.signal.aborted)return;
   if(!response.ok){setUnauthorized(response.status===401);throw Error(value.error||'Could not load updates.');}
   setUnauthorized(false);setData(value);
  }).catch(e=>{if(!abort.signal.aborted){setData(null);setError(e.message);}}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return()=>abort.abort();
 },[id,cursor,drafts,hidden,revision,management]);
 async function mutation(body:Record<string,unknown>) {
  const response=await fetch('/api/status-updates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const value=await response.json();
  if(!response.ok){if(response.status===401){setData(null);setUnauthorized(true);}throw Error(value.error||'Could not save.');}
  return value.row;
 }
 async function run(work:()=>Promise<void>){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
  try{await work();}catch(e){setError((e instanceof Error?e.message:'Request failed.')+' If the response was interrupted, refresh and check before submitting again.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function saveUpdate(publish=true){
  if(!editor||!validText(editor.headline,160)||!validText(editor.body,20000))return;
  const captured=generation.current;
  await run(async()=>{
   let saved:Update;
   if(editor.id) saved=await mutation({kind:'update',action:'edit',id:editor.id,revision:editor.revision,headline:editor.headline,body:editor.body});
   else saved=await mutation({kind:'update',action:'create',headline:editor.headline,body:editor.body});
   if(captured!==generation.current)return;
   setEditor({id:saved.id,revision:saved.revision,headline:saved.headline,body:saved.body});
   if(publish&&saved.publication_status==='draft') saved=await mutation({kind:'update',action:'publish',id:saved.id,revision:saved.revision});
   if(captured!==generation.current)return;
   setEditor(null);
   if(id) {refresh();setNotice('Update saved.');}
   else {setDrafts(saved.publication_status==='draft');refresh(true);setNotice(saved.publication_status==='draft'?'Draft saved.':'Update published.');}
  });
 }
 async function actComment(row:Comment,action:'delete'|'hide'|'show'){
  if(!window.confirm(action==='delete'?'Delete this comment?':action==='hide'?'Hide this comment?':'Show this comment again?'))return;
  const captured=generation.current;
  await run(async()=>{await mutation({kind:'comment',action,id:row.id,revision:row.revision,update_id:id});if(captured===generation.current)refresh();});
 }
 const rows=id?data?.comments??[]:data?.rows??[];
 const pageSize=id?50:25;
 return <main className="mx-auto my-8 w-full max-w-7xl space-y-6 px-4 text-white sm:px-8">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{management?'Manage Updates':'Status Updates'}</h1><p className="mt-3 text-slate-400">{management?'Manage news and updates for the ParPlay community.':'News and updates from the ParPlay community.'}</p></div><button className={button} disabled={busy||loading} onClick={()=>refresh()}>Refresh</button></div>
  {id&&<Link className="text-orange-300" href={listHref}>Back to updates</Link>}

  {management&&data?.admin&&!id&&<div className="flex flex-wrap gap-2"><button className={primary} disabled={busy} onClick={()=>{setEditor({headline:'',body:''});setError('');}}>+ New Update</button><nav aria-label="Update views" className="flex gap-2 rounded-xl bg-white/5 p-1">{[false,true].map(value=><button key={String(value)} aria-pressed={drafts===value} className={button+(drafts===value?' bg-orange-500/15 text-orange-300':' text-slate-400')} disabled={busy||loading} onClick={()=>{setDrafts(value);refresh(true);}}>{value?'Drafts':'Published'}</button>)}</nav></div>}
  {error&&<p role="alert" className="rounded-lg bg-red-950/40 p-3 text-red-200">{error}</p>}
  {unauthorized&&<Link href="/login" className="text-orange-300">Sign in to read Status Updates</Link>}
  {notice&&<p role="status" className="text-orange-200">{notice}</p>}
  {editor&&management&&data?.admin&&<form className="space-y-5 rounded-2xl border border-orange-300/30 bg-[#161a2b] p-5 sm:p-8" onSubmit={e=>{e.preventDefault();void saveUpdate();}}>
   <h2 className="text-xl font-semibold">{editor.id?'Edit Update':'New Update'}</h2>
   <label className="block">Headline<input className={input} required maxLength={160} disabled={busy} value={editor.headline} onChange={e=>setEditor({...editor,headline:e.target.value})}/></label>
   <label className="block">Body<textarea className={input+' min-h-64'} required maxLength={20000} disabled={busy} value={editor.body} onChange={e=>setEditor({...editor,body:e.target.value})}/></label>
   <div className="flex flex-wrap gap-2">{data.update?.publication_status!=='published'&&<button type="button" className={button} disabled={busy||!validText(editor.headline,160)||!validText(editor.body,20000)} onClick={()=>void saveUpdate(false)}>Save as draft</button>}<button className={primary} disabled={busy||!validText(editor.headline,160)||!validText(editor.body,20000)}>{busy?'Saving…':data.update?.publication_status==='published'?'Save changes':'Save and Publish'}</button><button type="button" className={button} disabled={busy} onClick={()=>setEditor(null)}>Cancel</button></div>
  </form>}
  {loading?<p role="status">Loading updates…</p>:!id&&data&&<>
   <h2 className="text-lg font-semibold">{drafts?'Draft updates':'Latest updates'}</h2>
   {!rows.length?<p className="text-slate-400">No updates yet.</p>:<table className="w-full table-fixed rounded-2xl bg-[#161a2b] text-left"><thead><tr className="text-sm text-slate-400"><th className="w-28 px-4 py-4 sm:w-44">Date</th><th>Update</th></tr></thead><tbody>{data.rows?.map(row=><tr key={row.id} className="border-t border-white/10"><td className="px-4 py-5 text-sm text-slate-400">{statusDate(row.published_at)}</td><td className="break-words py-4"><Link className="font-semibold text-orange-200 hover:underline" href={management?'/admin/suggestions?view=updates&id='+row.id:'/status-updates/'+row.id}>{row.headline}</Link></td></tr>)}</tbody></table>}
  </>}
  {!loading&&data?.update&&<>
   <article className="space-y-4 rounded-2xl border border-white/10 bg-[#161a2b] p-5 sm:p-8"><h2 className="break-words text-2xl font-bold">{data.update.headline}</h2><p className="text-sm text-slate-400">{statusDate(data.update.published_at)}</p><p className="whitespace-pre-wrap break-words leading-relaxed">{data.update.body}</p></article>
   {management&&data.admin&&<div className="flex gap-2"><button className={button} disabled={busy} onClick={()=>setEditor({...data.update!})}>Edit update</button><button className={button} disabled={busy} onClick={()=>{if(window.confirm('Delete this update and remove it from the published list?'))void run(async()=>{await mutation({kind:'update',action:'delete',id,revision:data.update!.revision});router.push(listHref);});}}>Delete update</button></div>}
   {data.update.publication_status==='published'&&<section className="space-y-4 border-t border-white/10 pt-5"><h2 className="text-xl font-semibold">Comments</h2>
    {management&&data.admin&&<button className={button} disabled={busy} onClick={()=>{setHidden(!hidden);refresh(true);}}>{hidden?'Visible comments':'Hidden comments'}</button>}
    {!data.comments?.length&&<p className="text-slate-400">{hidden?'No hidden comments.':'No comments yet.'}</p>}
    {data.comments?.map(row=><article key={row.id} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{row.author_name}</strong><time dateTime={row.created_at} className="text-sm text-slate-400">{statusDate(row.created_at)}</time></div><p className="whitespace-pre-wrap break-words">{row.body}</p><div className="flex flex-wrap gap-2">
     {row.author_id===data.user_id&&<><button className={button} disabled={busy} onClick={()=>{setEditing(row);setComment(row.body);}}>Edit</button><button className={button} disabled={busy} onClick={()=>void actComment(row,'delete')}>Delete</button></>}
     {management&&data.admin&&<button className={button} disabled={busy} onClick={()=>void actComment(row,row.moderation_status==='hidden'?'show':'hide')}>{row.moderation_status==='hidden'?'Show comment':'Hide comment'}</button>}
    </div></article>)}
    {confirmed&&<div role="status" className="rounded-lg border border-orange-300/30 p-3"><p className="text-orange-200">Your comment was saved.</p><p className="whitespace-pre-wrap break-words">{confirmed}</p></div>}
    <form className="space-y-3" onSubmit={e=>{e.preventDefault();if(!validText(comment,2000))return;const captured=generation.current;void run(async()=>{const row=await mutation({kind:'comment',action:editing?'edit':'create',id:editing?.id,revision:editing?.revision,update_id:id,body:comment});if(captured!==generation.current)return;setComment('');setEditing(null);refresh();setConfirmed(row.body);});}}>
     <label className="block">{editing?'Edit your comment':'Add a comment'}<textarea className={input+' min-h-28'} required maxLength={2000} disabled={busy} value={comment} onChange={e=>setComment(e.target.value)}/></label>
     <button className={primary} disabled={busy||!validText(comment,2000)}>{busy?'Saving…':editing?'Save comment':'Post comment'}</button>
     {editing&&<button className={button+' ml-2'} type="button" disabled={busy} onClick={()=>{setEditing(null);setComment('');}}>Cancel</button>}
    </form>
   </section>}
  </>}
  {data&&!editor&&<div className="flex gap-2"><button className={button} disabled={loading||busy||cursors.length===1} onClick={()=>{setCursors(v=>v.slice(0,-1));setLoading(true);setError('');}}>Previous</button><button className={button} disabled={loading||busy||rows.length<pageSize} onClick={()=>{const last=rows[rows.length-1];if(!last)return;const stamp=id||drafts?last.created_at:(last as Update).published_at;if(stamp){setCursors(v=>[...v,{cursor:stamp,cursor_id:last.id}]);setLoading(true);setError('');}}}>Next</button></div>}
  {!management&&data&&<SuggestImprovement key={data.user_id} userId={data.user_id}/>}
 </main>;
}
