'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
type Row = { id:string; created_at:string; display_name:string; contact_email:string|null; subject:string; body:string; state:string };
type Cursor = { before:string; before_id:string };
const button = 'rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-40';
export default function Suggestions() {
    const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
    const [cursors,setCursors]=useState<(Cursor|null)[]>([null]),[version,setVersion]=useState(0);
    const cursor=cursors[cursors.length-1];
    useEffect(()=>{
        const {data}=supabaseBrowser.auth.onAuthStateChange(event=>{
            if(event==='SIGNED_IN'||event==='SIGNED_OUT'){setRows([]);setCursors([null]);setVersion(v=>v+1);}
        });
        return ()=>data.subscription.unsubscribe();
    },[]);
    useEffect(()=>{
        const controller=new AbortController();
        void fetch('/api/admin/suggestions?'+new URLSearchParams(cursor??{}),{cache:'no-store',signal:controller.signal})
            .then(async response=>{if(!response.ok)throw Error('Could not load suggestions. Admin access is required.');return response.json();})
            .then(value=>{if(!controller.signal.aborted)setRows(value.rows);})
            .catch(()=>{if(!controller.signal.aborted){setRows([]);setError('Could not load suggestions. Check admin access and try again.');}})
            .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
        return ()=>controller.abort();
    },[cursor,version]);
    function reset(){setLoading(true);setRows([]);setError('');}
    return <section className="min-w-0 space-y-6 text-white">
        <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Suggestions</h1><p className="mt-2 text-slate-400">Private feedback from the ParPlay community.</p></div><button className={button} disabled={loading} onClick={()=>{reset();setCursors([null]);setVersion(v=>v+1);}}>Refresh</button></header>
        {error&&<p role="alert" className="rounded-xl bg-red-950/40 p-4 text-red-200">{error}</p>}
        {loading?<p role="status">Loading suggestions…</p>:!error&&!rows.length?<p className="rounded-2xl border border-white/10 p-6 text-slate-400">No suggestions yet.</p>:rows.map(row=><details key={row.id} className="rounded-2xl border border-white/10 bg-[#161a2b] p-5">
            <summary className="cursor-pointer break-words"><span className="font-semibold text-orange-300">{row.subject}</span><span className="mt-2 block text-sm text-slate-400">{row.display_name} · {Number.isFinite(Date.parse(row.created_at))?new Date(row.created_at).toLocaleString('en-GB',{timeZone:'UTC'})+' UTC':'Date unavailable'}</span><span className="mt-2 inline-block rounded-full bg-white/5 px-3 py-1 text-xs">Delivery: {row.state}</span></summary>
            <div className="mt-5 space-y-4 border-t border-white/10 pt-5"><p className="break-words text-sm text-slate-300">{row.contact_email||'Email unavailable'}</p><p className="whitespace-pre-wrap break-words leading-relaxed">{row.body}</p><details className="text-xs text-slate-400"><summary className="cursor-pointer">Technical details</summary><p className="mt-2 break-all">Submission ID: {row.id}</p></details></div>
        </details>)}
        <nav aria-label="Suggestions pages" className="flex gap-3"><button className={button} disabled={loading||cursors.length===1} onClick={()=>{reset();setCursors(v=>v.slice(0,-1));}}>Previous</button><button className={button} disabled={loading||rows.length<25} onClick={()=>{const last=rows.at(-1);if(last){reset();setCursors(v=>[...v,{before:last.created_at,before_id:last.id}]);}}}>Next</button></nav>
    </section>;
}
