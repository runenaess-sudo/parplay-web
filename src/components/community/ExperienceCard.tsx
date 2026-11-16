'use client';
/* eslint-disable @next/next/no-img-element -- Existing avatars and authorized image blobs. */
import {useEffect,useState,type ReactNode} from 'react';
import {supabaseBrowser as db} from '@/lib/supabase-browser';
import {loadExperiencePhoto} from './experiencePhoto';
import {achievementLabels,experienceStats,feelingEmoji,hasRoundDetails,type ExperiencePost} from './experiencePresentation';
function Photo({id}:{id:string}) {
 const [url,setUrl]=useState<string|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let live=true,current:string|null=null,generation=0;
  const clear=()=>{if(current)URL.revokeObjectURL(current);current=null;setUrl(null);};
  const load=async()=>{const ticket=++generation;clear();setError(false);
   try {const {data,error}=await db.auth.getSession();if(error)throw error;
    const blob=await loadExperiencePhoto({baseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL!,apiKey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,postId:id,accessToken:data.session?.access_token});
    if(!live||ticket!==generation)return;current=URL.createObjectURL(blob);setUrl(current);
   }catch{if(live&&ticket===generation)setError(true);}
  };
  void load();const visibility=()=>{generation++;clear();if(document.visibilityState==='visible')void load();};
  document.addEventListener('visibilitychange',visibility);
  const {data:auth}=db.auth.onAuthStateChange(event=>{if(event!=='INITIAL_SESSION')void load();});
  return()=>{live=false;generation++;if(current)URL.revokeObjectURL(current);auth.subscription.unsubscribe();document.removeEventListener('visibilitychange',visibility);};
 },[id,revision]);
 return url?<img src={url} alt="Experience photo" loading="lazy" className="h-auto w-full rounded-xl" onError={()=>{setError(true);setUrl(null);}}/>:<p role="status" className="text-sm text-slate-400">{error?<button onClick={()=>setRevision(n=>n+1)}>Photo unavailable · Retry</button>:'Loading photo…'}</p>;
}
export default function ExperienceCard({post,onReact,busy=false,children}:{post:ExperiencePost;onReact?:(reaction:'UP'|'DOWN')=>void;busy?:boolean;children?:ReactNode}) {
 const name=post.author_name||'Player', date=post.round_details?.finished_at||post.published_at||post.submitted_at;
 return <article className="space-y-3 rounded-2xl border border-emerald-200/15 bg-[#172725] p-4 text-white">
  {date&&<time className="text-xs text-slate-400" dateTime={date}>{new Date(date).toLocaleDateString()}</time>}
  <div className="flex items-center gap-3">{post.author_avatar?<img src={post.author_avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover"/>:<span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/10">{name.slice(0,2).toUpperCase()}</span>}
   <div className="min-w-0"><p className="font-bold wrap-anywhere">{name}</p><p className="text-sm text-slate-400">{post.layout_name||post.round_details?.layout_name||post.context_name||post.round_details?.course_name||'Course Experience'}</p></div></div>
  {hasRoundDetails(post)&&<div className="flex flex-wrap gap-2">{experienceStats(post).map(([label,value])=><div key={label} className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#203733] px-2.5 py-1.5 text-sm"><span className="font-semibold">{label}</span><span className="font-bold text-[#8DB8E8]">{value}</span></div>)}</div>}
  {post.status&&<p className="text-sm text-yellow-300">{post.status==='PENDING'?'Pending Approval':post.status==='APPROVED'?'Approved':'Declined'}</p>}
  <div className="flex flex-wrap gap-2 text-xs text-yellow-300">{achievementLabels(post).map(label=><span key={label}>{label}</span>)}</div>
  <h3 className="font-bold">{post.title}</h3><p className="text-sm font-bold">Comments</p><p className="whitespace-pre-wrap wrap-anywhere text-sm leading-6 text-slate-200">{post.body}</p>
  {feelingEmoji(post.round_feeling)&&<p className="text-sm">My Round Feeling: {feelingEmoji(post.round_feeling)}</p>}
  {feelingEmoji(post.course_feeling)&&<p className="text-sm">Course Experience: {feelingEmoji(post.course_feeling)}</p>}
  {post.has_photo&&<Photo id={post.id}/>}
  <div className="flex flex-wrap gap-4">{onReact&&(['UP','DOWN'] as const).map(reaction=><button key={reaction} disabled={busy} aria-pressed={post.own_reaction===reaction} aria-label={reaction==='UP'?'Thumbs up':'Thumbs down'} onClick={()=>onReact(reaction)} className={'flex min-h-11 min-w-18 items-center justify-center gap-2 rounded-lg border px-4 py-2 disabled:opacity-50 '+(post.own_reaction===reaction?(reaction==='UP'?'border-emerald-400 text-emerald-300':'border-red-400 text-red-300'):'border-white/20 text-slate-200')}><span>{reaction==='UP'?'👍':'👎'}</span><span>{reaction==='UP'?post.up_count??0:post.down_count??0}</span></button>)}{children}</div>
 </article>;
}
