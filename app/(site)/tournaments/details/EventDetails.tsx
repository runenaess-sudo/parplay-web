'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import TournamentLivePage from '@/components/tournament-live/TournamentLivePage';
import Registration,{button} from './Registration';
import {context,fail,groups,information,players,results,type Context,type Row} from './data';
import {leagueDayResults} from './puttingResults';
import type {Matches} from './puttingTypes';
const tabs=['Registration','Players','Results','Groups','Scorecard','My Rounds','Info'] as const;
type Tab=typeof tabs[number];
const panel='rounded-2xl border border-slate-700 bg-slate-900/60 p-5 sm:p-6';
function name(row:Row){return row.display_name||row.full_name||row.username||'ParPlay player';}
function Roster({rows}:{rows:Row[]}){return !rows.length?<p className="text-slate-400">No published players yet.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr><th className="p-3">Player</th><th className="p-3">Class</th><th className="p-3">Status</th></tr></thead><tbody>{rows.map((p,i)=><tr key={p.profile_id??p.player_id??p.id??i} className="border-t border-slate-800"><td className="p-3 font-medium text-white">{name(p)}</td><td className="p-3">{p.class_code??p.class_name??"-"}</td><td className="p-3">{p.status??'Registered'}</td></tr>)}</tbody></table></div>;}
export default function EventDetails({id,putting=false,roundId,userId}:{id:string;putting?:boolean;roundId?:string;userId:string}){
  const [c,setC]=useState<Context|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[tab,setTab]=useState<Tab>('Info');
  useEffect(()=>{let active=true;setC(null);setError('');void context(id,putting,roundId,userId).then(v=>{if(active)setC(v);}).catch(e=>{if(active)setError(fail(e));});return()=>{active=false;};},[id,putting,roundId,userId,revision]);
  const e=c?.event,r=c?.round;
  const title=c?.kind==='putting'?e?.league_name+" - Day "+e?.day_number:c?.kind==='league'?e?.name+" - Round "+r?.round_number:e?.name;
  const date=c?.kind==='putting'?e?.starts_at:c?.kind==='league'?r?.start_time:e?.start_date;
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <Link href="/tournaments" className="text-sm font-semibold text-blue-300 hover:underline">Back to Events</Link>
    {error?<div role="alert" className={panel}><p className="mb-4 text-rose-300">{error}</p><button className={button} onClick={()=>setRevision(v=>v+1)}>Retry</button></div>:!c?<p role="status" className="py-12 text-slate-400">Loading event...</p>:<>
      <header className={panel}><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold capitalize text-blue-300">{c.kind}</span><span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">{r?.status??e?.status}</span></div>
        <h1 className="mt-3 text-3xl font-bold text-white">{title}</h1>
        <p className="mt-3 text-slate-300">{date?new Date(date).toLocaleString('en-GB',{timeZone:date.includes('T')?(e?.timezone||'UTC'):'UTC',dateStyle:'medium',...(date.includes('T')?{timeStyle:'short' as const}:{})}):'Date to be announced'}</p>
        <p className="mt-1 text-slate-400">{r?.course_name??e?.location} {e?.country}</p>
        {c.kind!=='putting'&&<p className="mt-3 text-sm text-slate-300">Entry fee: {Number(e?.entry_fee??0)>0?e?.entry_fee:'Free'}</p>}
      </header>
      <nav aria-label="Event sections" className="flex flex-wrap gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 p-2">{tabs.map(value=><button type="button" key={value} aria-pressed={tab===value} onClick={()=>setTab(value)} className={'rounded-xl px-4 py-2.5 text-sm font-semibold '+(tab===value?'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/40':'text-slate-300 hover:bg-white/5')}>{value}</button>)}</nav>
      <section className={panel} aria-label={tab}>
        <h2 className="mb-5 text-xl font-bold text-white">{tab}</h2>
        {tab==='Scorecard'||tab==='My Rounds'?<div className="py-8 text-center"><h3 className="text-xl font-bold text-blue-200">Available in the ParPlay app</h3><p className="mt-3 text-slate-300">Open ParPlay on your phone to play rounds and enter scores.</p></div>:tab==='Registration'?<Registration key={c.id+':'+c.round?.tournament_round_id} c={c}/>:<ReadSection key={tab} c={c} tab={tab}/>}
      </section>
    </>}
  </div>;
}
function ReadSection({c,tab}:{c:Context;tab:Tab}){
  const [data,setData]=useState<any>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setData(null);setError('');const reader=tab==='Players'?players:tab==='Groups'?groups:tab==='Results'?results:information;
    void reader(c).then(v=>{if(active)setData(v);}).catch(e=>{if(active)setError(fail(e));});return()=>{active=false;};},[c,tab,retry]);
  if(error)return <div role="alert"><p className="mb-4 text-rose-300">{error}</p><button className={button} onClick={()=>setRetry(v=>v+1)}>Retry</button></div>;
  if(!data)return <p role="status" className="text-slate-400">Loading {tab.toLowerCase()}-</p>;
  if(tab==='Players')return <Roster rows={data.players}/>;
  if(tab==='Info')return <div className="space-y-5 whitespace-pre-wrap text-slate-300">
    <p>{c.event.description||'No additional information has been published.'}</p>
    <p>{c.round?.course_name??c.event.location} {c.round?.layout_name??''}</p>
    {c.kind==='putting'&&<p>Capacity: {c.event.capacity}<br/>Registration closes: {c.event.registration_deadline?new Date(c.event.registration_deadline).toLocaleString('en-GB',{timeZone:c.event.timezone}):'Not configured'}</p>}
    {c.event.classes?.length>0&&<div><h3 className="mb-2 font-bold text-white">Classes</h3>{c.event.classes.map((v:Row)=><p key={v.id}>{v.name}</p>)}</div>}
    {data.schedule?.length>0&&<div><h3 className="mb-2 font-bold text-white">Schedule</h3>{data.schedule.map((v:Row)=><div key={v.id} className="border-t border-slate-700 py-3"><p className="text-sm text-blue-200">{v.event_date} {v.start_time}{v.end_time?" - "+v.end_time:''}</p><h4 className="font-semibold text-white">{v.title}</h4><p>{v.description}</p></div>)}</div>}
    {data.messages?.length>0&&<div><h3 className="mb-2 font-bold text-white">Messages from Staff</h3>{data.messages.map((v:Row)=><div key={v.id} className="border-t border-slate-700 py-3"><h4 className="font-semibold text-white">{v.subject??v.title}</h4><p>{v.body??v.message}</p></div>)}</div>}
  </div>;
  if(tab==='Groups'&&c.kind!=='putting')return <div className="space-y-4">{!data.length&&<p className="text-slate-400">No published groups yet.</p>}{data.map((g:Row,i:number)=><div className="rounded-xl border border-slate-700 p-4" key={g.id??i}><h3 className="font-bold text-white">{g.round_number?'Round '+g.round_number+" - ":''}Group {g.group_number}</h3><p className="my-2 text-sm text-slate-400">{g.course_name} {g.layout_name} {g.flex_start_time_label??''}{g.starting_hole_number?" - Hole "+g.starting_hole_number:''}</p><Roster rows={g.members??[]}/></div>)}</div>;
  if(c.kind==='putting'&&(tab==='Groups'||tab==='Results'))return <PuttingMatches c={c} rounds={tab==='Groups'?data:data.rounds} resultsView={tab==='Results'}/>;
  if(tab==='Results'&&c.kind==='tournament'){
    const first=data.rounds?.[0]?.id;
    return first?<TournamentLivePage tournamentId={c.id} roundId={first}/>:<p className="text-slate-400">No published results yet.</p>;
  }
  if(tab==='Results'&&c.kind==='league')return <LeagueResults data={data}/>;
  return null;
}
function LeagueResults({data}:{data:Row}){
  const [selection,setSelection]=useState('total');
  if(!Array.isArray(data.rounds)||!Array.isArray(data.totals))return <p>Results unavailable.</p>;
  const rows=selection==='total'?data.totals:data.rounds.find((r:Row)=>r.id===selection)?.players??[];
  return <div className="space-y-4"><div className="flex flex-wrap gap-2"><button className={button} aria-pressed={selection==='total'} onClick={()=>setSelection('total')}>Total</button>{data.rounds.map((r:Row)=><button key={r.id} className={button} aria-pressed={selection===r.id} onClick={()=>setSelection(r.id)}>Round {r.round_number}</button>)}</div><ResultsTable rows={rows.map((p:Row)=>({...p,class_name:p.class_label,score:p.relative_to_par,points:p.league_points}))}/></div>;
}
function ResultsTable({rows}:{rows:Row[]}){return !rows.length?<p className="text-slate-400">No published results yet.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr>{['Place','Player','Class','Score','Points'].map(v=><th key={v} className="p-3">{v}</th>)}</tr></thead><tbody>{rows.map((p,i)=><tr key={p.player_id??p.profile_id??i} className="border-t border-slate-800"><td className="p-3">{p.place}</td><td className="p-3 text-white">{name(p)}</td><td className="p-3">{p.class_name}</td><td className="p-3">{p.score??"-"}</td><td className="p-3">{p.points??"-"}</td></tr>)}</tbody></table></div>;}
function PuttingMatches({c,rounds,resultsView}:{c:Context;rounds:Row[];resultsView:boolean}){
  const [roster,setRoster]=useState<Row|null>(null),[error,setError]=useState(''),[selection,setSelection]=useState('total');
  useEffect(()=>{let active=true;void players(c).then(v=>{if(active)setRoster(v);}).catch(e=>{if(active)setError(fail(e));});return()=>{active=false;};},[c]);
  if(error)return <p role="alert" className="text-rose-300">{error}</p>;if(!roster)return <p>Loading players...</p>;
  const player=(id:string)=>roster.players.find((p:Row)=>p.player_id===id);
  const className=(id:string)=>roster.classes.find((p:Row)=>p.id===id)?.name??'';
  const visible=rounds.filter(r=>r.status==='PUBLISHED');
  if(!resultsView)return <div className="space-y-4">{!visible.length&&<p>No published groups yet.</p>}{visible.map(r=><div key={r.id}><h3 className="mb-3 text-lg font-bold text-white">Round {r.round_number}</h3>{[...(r.duels??[])].sort((a:Row,b:Row)=>String(a.class_id).localeCompare(String(b.class_id))||a.position-b.position).map((d:Row)=><div key={d.id} className="mb-3 rounded-xl border border-slate-700 p-4"><h4 className="font-semibold text-blue-200">{className(d.class_id)}  - Basket {[...(r.duels??[])].filter((v:Row)=>v.class_id===d.class_id).sort((a:Row,b:Row)=>a.position-b.position).findIndex((v:Row)=>v.id===d.id)+1}</h4><Roster rows={d.players.map((p:Row)=>({...player(p.player_id),status:d.kind==='DUEL'?d.duel_status:d.kind}))}/></div>)}</div>)}</div>;
  const data={rounds:visible} as Matches;
  const rows=leagueDayResults(data,selection==='total'?'total':Number(selection));
  return <div className="space-y-4"><div className="flex flex-wrap gap-2"><button className={button} onClick={()=>setSelection('total')}>Total</button>{visible.map(r=><button key={r.id} className={button} onClick={()=>setSelection(String(r.round_number))}>Round {r.round_number}</button>)}</div>
    <ResultsTable rows={rows.map(p=>({...p,display_name:name(player(p.player_id)??{}),class_name:className(p.class_id),score:p.hits,points:p.match}))}/>
  </div>;
}
