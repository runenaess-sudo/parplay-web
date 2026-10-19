'use client';
import { useRef, useState } from 'react';
import { validId, validText } from '@/lib/status-updates';
type Draft={id:string;subject:string;body:string};
const button='rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-40';
const input='mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white';
export default function SuggestImprovement({userId}:{userId:string}) {
 const [open,setOpen]=useState(false),[subject,setSubject]=useState(''),[body,setBody]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[sent,setSent]=useState(false);
 const [draft,setDraft]=useState<Draft|null>(null);
 const lock=useRef(false);
 const storageKey='parplay-status-suggestion-v1:'+userId;
 function show(){
  try {
   const raw=sessionStorage.getItem(storageKey);
   if(raw){const saved=JSON.parse(raw);if(!validId(saved.id)||!validText(saved.subject,160)||!validText(saved.body,5000))throw Error();
    setDraft(saved);setSubject(saved.subject);setBody(saved.body);}
   setOpen(true);
  }catch{setMessage('Could not recover the previous submission. Please contact support before sending again.');}
 }
 async function submit(){
  if(lock.current)return;
  if(!validText(subject,160)||!validText(body,5000)){setMessage('Enter a subject (maximum 160 characters) and suggestion (maximum 5,000 characters).');return;}
  lock.current=true;setBusy(true);setMessage('');setSent(false);
  try {
   const current=draft??{id:crypto.randomUUID(),subject:subject.trim(),body:body.trim()};
   // Keep the same immutable submission across timeouts, Cancel and tab reloads.
   sessionStorage.setItem(storageKey,JSON.stringify(current));setDraft(current);
   const response=await fetch('/api/status-updates/suggestions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)});
   const value=await response.json();
   if(response.ok&&value.state==='sent'){
    sessionStorage.removeItem(storageKey);setDraft(null);setSubject('');setBody('');setOpen(false);setSent(true);
    setMessage('Thank you! Your suggestion has been sent to ParPlay.');
   }else setMessage(value.error||'Delivery is not confirmed. Retry the same submission.');
  }catch{setMessage('Delivery is not confirmed. Your form is preserved. Retry the same submission.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="space-y-3">
  <button className={button} onClick={show} disabled={busy}>+ Suggest Improvement</button>
  {message&&<p role={sent?'status':'alert'} className={sent?'text-lime-200':'text-amber-200'}>{message}</p>}
  {open&&<form className="space-y-3 rounded-xl border border-white/20 bg-white/5 p-4" onSubmit={e=>{e.preventDefault();void submit();}}>
   <h2 className="text-xl font-semibold">Suggest Improvement</h2><p className="text-sm text-slate-300">Private feedback to ParPlay support. It will not appear in updates or comments.</p>
   <label className="block">Subject<input required maxLength={160} className={input} value={subject} disabled={busy||!!draft} onChange={e=>setSubject(e.target.value)}/></label>
   <label className="block">Your Suggestion<textarea required maxLength={5000} className={input+' min-h-40'} value={body} disabled={busy||!!draft} onChange={e=>setBody(e.target.value)}/></label>
   {draft&&<p className="break-all text-sm text-slate-300">Submission: {draft.id}. Content is kept unchanged for safe retries.</p>}
   <div className="flex flex-wrap gap-2"><button disabled={busy} className={button+' bg-lime-300 font-semibold text-slate-950'}>{busy?'Sending…':draft?'Retry same suggestion':'Send Suggestion'}</button><button type="button" disabled={busy} className={button} onClick={()=>setOpen(false)}>Cancel</button></div>
  </form>}
 </section>;
}
