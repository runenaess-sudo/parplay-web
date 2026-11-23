'use client';
import {useEffect,useRef,useState} from 'react';
import {context,db,eligible,fail,leagueArgs,registration,rpc,verifyOwner,type Context,type Row} from './data';
export const button='rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 font-semibold text-blue-200 hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-40';
export const input='w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-white';
export default function Registration({c}:{c:Context}){
  const [data,setData]=useState<Row|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[group,setGroup]=useState('');
  const [reload,setReload]=useState(0),[pending,setPending]=useState(false),[options,setOptions]=useState<Row|null>(null);
  const locked=useRef(false),live=useRef(true);
  const storage='parplay:web:putting-registration:'+c.userId+':'+c.id;
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  useEffect(()=>{let active=true;setData(null);setError('');setOptions(null);
    void registration(c).then(d=>{if(!active)return;setData(d);setSelected(c.kind==='putting'?d.mine?.class_id??d.classes.find((v:Row)=>v.active)?.id??'':c.kind==='league'?d.mine?.tournament_class_id??'':d.mine?.class_code??'');setGroup(d.flex?.group_id??'');
      if(c.kind==='putting'){try{setPending(!!localStorage.getItem(storage));}catch{setError('Browser storage is required to safely confirm registration.');}}
    }).catch(e=>{if(active)setError(fail(e));});return()=>{active=false;};
  },[c,reload,storage]);
  async function action(kind:'REGISTER'|'WITHDRAW'|'CHANGE_CLASS'|'RETRY'){
    if(locked.current||!data)return;
    if(kind==='WITHDRAW'&&!window.confirm('Withdraw from this event?'))return;
    locked.current=true;setBusy(true);setError('');
    try{
      await verifyOwner(c);
      // Recheck publication and fee immediately before mutation. Never submit a paid entry as free.
      const fresh=await context(c.id,c.kind==='putting',c.round?.tournament_round_id,c.userId);
      const d=await registration(fresh);
      if(c.kind==='putting'){
        let intent:Row|null=JSON.parse(localStorage.getItem(storage)??'null');
        if(intent&&kind!=='RETRY')throw Error('Retry your saved registration action first.');
        if(!intent){if(kind==='RETRY')throw Error('No saved action. Refresh this section.');
          intent={id:crypto.randomUUID(),owner:c.userId,day:c.id,action:kind,classId:kind==='WITHDRAW'?null:selected,revision:d.mine?.revision??0};
          localStorage.setItem(storage,JSON.stringify(intent));setPending(true);
        }
        if(intent.owner!==c.userId||intent.day!==c.id||!['REGISTER','WITHDRAW','CHANGE_CLASS'].includes(intent.action))throw Error('Invalid saved action.');
        try{
          const r=await rpc('mutate_putting_league_registration_v1',{p_operation_id:intent.id,p_day_id:c.id,p_action:intent.action,p_class_id:intent.classId,p_expected_revision:intent.revision});
          if(r?.day_id!==c.id)throw Error('Registration is not confirmed. Retry your saved action.');
          localStorage.removeItem(storage);setPending(false);
        }catch(e){if(/^(P0001|22|23|42501|40001)/.test((e as {code?:string}).code??'')){localStorage.removeItem(storage);setPending(false);}throw e;}
      }else if(c.kind==='league'){
        if(kind==='WITHDRAW'){
          if(!d.mine?.can_unregister)throw Error('Withdrawal is not allowed for this round.');
          await rpc('unregister_from_league_round_v1',leagueArgs(fresh));
        }else{
          if(Number(fresh.event.entry_fee??0)>0)throw Error('Paid registration is not available on web yet.');
          if(d.flex){
            if(!d.flex.can_save)throw Error('Registration is locked or closed.');
            await rpc('save_league_flex_registration_v1',{...leagueArgs(fresh),p_tournament_class_id:selected,p_group_id:group});
          }else{
            if(d.mine?.registered)throw Error('This round does not support changing class while registered.');
            if(d.window?.availability!=='open'||d.window.full!==false)throw Error('Registration is closed or full.');
            await rpc('register_for_league_round_v1',{...leagueArgs(fresh),p_tournament_class_id:selected});
          }
        }
      }else if(kind==='WITHDRAW'){
        const r=await rpc('withdraw_tournament_player_v1',{p_tournament_id:c.id});
        if((Array.isArray(r)?r[0]:r)?.result_code!=='WITHDRAWN')throw Error('Withdrawal was not confirmed.');
      }else{
        if(Number(fresh.event.entry_fee??0)!==0)throw Error('Paid registration is not available on web yet.');
        if(d.window?.availability!=='open')throw Error('Registration is not open.');
        if(d.pass?.active!==true)throw Error('An active Tournament Pass is required.');
        const option=d.classes.find((v:Row)=>v.code===selected);if(!option||!eligible(fresh,d,option))throw Error('Choose an eligible class. Check your profile details and rating.');
        const number=Number(d.profile.parplay_player_number??NaN);if(!Number.isFinite(number))throw Error('Your ParPlay player number is missing.');
        const r=await rpc('confirm_tournament_player_v1',{p_tournament_id:c.id,p_profile_id:c.userId,p_player_number:number,p_class_code:option.code,p_class_name:option.name,p_parplay_rating_at_signup:null,p_parplay_plus_rating_at_signup:d.profile.parplay_plus_rating_current,p_payment_id:'free-entry'});
        const result=Array.isArray(r)?r[0]:r;
        if(!['REGISTERED','CONFIRMED','ALREADY_REGISTERED','ALREADY_CONFIRMED','WAITLISTED','ALREADY_WAITLISTED'].includes(result?.result_code))throw Error(result?.result_code??'Registration was not confirmed. Refresh before retrying.');
      }
      if(live.current)setReload(v=>v+1);
    }catch(e){if(live.current)setError(fail(e));}
    finally{locked.current=false;if(live.current)setBusy(false);}
  }
  async function changeOptions(){if(locked.current)return;locked.current=true;setBusy(true);setError('');try{await verifyOwner(c);const r=await rpc('get_tournament_class_change_options_v1',{p_event_id:c.id});if(r?.event_id!==c.id||!Array.isArray(r.classes))throw Error('Invalid class options.');setOptions(r);}catch(e){setError(fail(e));}finally{locked.current=false;setBusy(false);}}
  async function changeClass(option:Row){if(locked.current||!options)return;
    const warning=option.allowed_outcome==='waitlisted'?'This will release your existing place or waitlist position and put you at the back of the selected class waitlist. Continue?':'Change your registered class to '+option.class_code+"-";
    if(!window.confirm(warning))return;locked.current=true;setBusy(true);setError('');
    try{await verifyOwner(c);await rpc('change_tournament_player_class_v1',{p_event_id:c.id,p_expected_class_code:options.class_code,p_expected_status:options.status,p_new_class_code:option.class_code,p_desired_outcome:option.allowed_outcome});setReload(v=>v+1);}catch(e){setOptions(null);setError(fail(e));}finally{locked.current=false;setBusy(false);}
  }
  const paid=c.kind!=='putting'&&Number(c.event.entry_fee??0)>0;
  const registered=c.kind==='putting'?data?.mine?.status==='REGISTERED':c.kind==='league'?data?.mine?.registered===true:!!data?.mine;
  const open=c.kind==='putting'?data?.roster?.is_open===true:data?.window?.availability==='open';
  const canWithdraw=c.kind==='league'?data?.mine?.can_unregister===true:c.kind==='putting'?open:registered;
  return <div className="space-y-4">
    {paid&&<p className="rounded-xl border border-amber-500/30 p-4 text-amber-200">Entry fee: {c.event.entry_fee}<br/>Paid registration is not available on web yet.</p>}
    {error&&<p role="alert" className="text-rose-300">{error}</p>}
    {!data?<button className={button} disabled={busy} onClick={()=>setReload(v=>v+1)}>Load registration / Retry</button>:<>
      <p className="text-slate-300">{registered?'Your status: '+(data.mine?.status??'registered'):'You are not registered.'} {data.mine?.class_name??data.mine?.class_code??''}</p>
      <p className="text-slate-400">{open?'Registration open':data.roster?.closed_reason??'Registration '+(data.window?.availability??'closed')}</p>
      {data.roster?.deadline&&<p className="text-sm text-slate-400">Closes: {new Date(data.roster.deadline).toLocaleString()}</p>}
      {c.kind==='tournament'&&!registered&&data.pass?.active!==true&&<p className="text-amber-200">An active Tournament Pass is required. Manage your pass in ParPlay.</p>}
      {(!registered||c.kind!=='tournament')&&<label className="block max-w-md space-y-2">Class<select className={input} value={selected} disabled={busy||pending} onChange={e=>setSelected(e.target.value)}><option value="">Choose class</option>
        {data.classes?.filter((v:Row)=>v.active!==false).map((v:Row)=><option key={v.id??v.code} value={c.kind==='tournament'?v.code:v.id} disabled={!eligible(c,data,v)}>{v.code??v.name}{!eligible(c,data,v)?" - not eligible":''}</option>)}</select></label>}
      {data.flex&&<label className="block max-w-md space-y-2">Start time<select className={input} value={group} disabled={busy} onChange={e=>setGroup(e.target.value)}><option value="">Choose start time</option>{data.flex.groups.map((g:Row)=><option key={g.id} value={g.id} disabled={!g.selectable||g.members.filter((p:Row)=>p.profile_id!==c.userId).length>=g.capacity}>{g.date_label} {g.time_label} ({g.members.length}/{g.capacity})</option>)}</select></label>}
      <div className="flex flex-wrap gap-3">
        {pending?<button className={button} disabled={busy} onClick={()=>void action('RETRY')}>Retry saved registration action</button>:<>
          {!registered&&<button className={button} disabled={busy||!open||paid||!selected||(c.kind==='tournament'&&data.pass?.active!==true)||data.window?.full===true} onClick={()=>void action('REGISTER')}>Register</button>}
          {registered&&c.kind==='tournament'&&<button className={button} disabled={busy} onClick={()=>void changeOptions()}>Change Class</button>}
          {registered&&(c.kind==='putting'||data.flex)&&<button className={button} disabled={busy||!open||!selected||(c.kind==='league'&&(paid||!data.flex.can_save||!group))} onClick={()=>void action('CHANGE_CLASS')}>Save Class / Start Time</button>}
          {registered&&<button className={button} disabled={busy||!canWithdraw} onClick={()=>void action('WITHDRAW')}>Withdraw</button>}
        </>}
        <button className={button} disabled={busy} onClick={()=>setReload(v=>v+1)}>Refresh</button>
      </div>
      {options&&<div className="space-y-3 rounded-xl border border-slate-700 p-4"><p>Select a class. Availability and eligibility are confirmed by the server.</p>{options.classes.map((v:Row)=><button key={v.class_code} className={button+' mr-2 mb-2'} disabled={busy||v.current||!v.eligible||!['registered','waitlisted'].includes(v.allowed_outcome)} onClick={()=>void changeClass(v)}>{v.class_code}  - {v.allowed_outcome??v.reason??'Unavailable'}</button>)}</div>}
    </>}
    {busy&&<p role="status" className="text-blue-200">Confirming with server...</p>}
  </div>;
}
