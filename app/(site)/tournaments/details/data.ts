import { supabaseBrowser as db } from '@/lib/supabase-browser';
// Payload fields are projections of existing mobile RPCs; no admin/preview reads.
export type Row = Record<string, any>;
export type Context = {id: string; kind: 'tournament'|'league'|'putting'; event: Row; round: Row|null; userId: string};
export async function rpc(name: string, args: Row): Promise<any> {
  const {data,error} = await db.rpc(name,args); if(error)throw error; return data;
}
export function fail(error: unknown): string {
  const e=error as {code?:string;message?:string};return (e?.code ? '['+e.code+'] ' : '')+(e?.message ?? 'Could not load this section. Please retry.');
}
export const leagueArgs=(c:Context)=>({p_tournament_id:c.id,p_tournament_round_id:c.round?.tournament_round_id});
export async function context(id:string,putting:boolean,roundId:string|undefined,userId:string):Promise<Context> {
  if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid event.');
  if(putting){
    const days=await rpc('get_public_putting_league_days_v1',{p_day_id:id});
    const day=Array.isArray(days)?days.find(d=>d.id===id):null;
    if(!day||day.status==='DRAFT')throw Error('This event is not published or is unavailable.');
    return {id,kind:'putting',event:day,round:null,userId};
  }
  const result=await db.from('tournaments').select('id,name,type,status,is_published,description,location,country,start_date,end_date,entry_fee,timezone,registration_open_at,registration_close_at').eq('id',id).eq('is_published',true).single();
  if(result.error)throw result.error;
  const event=result.data; if(!['tournament','league'].includes(event.type))throw Error('Unsupported event type.');
  let round:Row|null=null;
  if(event.type==='league'){
    round=await rpc(roundId?'get_public_league_round_by_id_v1':'get_public_league_round_v1',roundId?{p_tournament_id:id,p_tournament_round_id:roundId}:{p_tournament_id:id});
    if(!round||round.tournament_id!==id||!round.tournament_round_id||(roundId&&round.tournament_round_id!==roundId))throw Error('This League round is not published or is unavailable.');
  }
  return {id,kind:event.type,event,round,userId};
}
export async function players(c:Context){
  if(c.kind==='putting'){
    const roster=await rpc('get_putting_league_registration_v1',{p_day_id:c.id});
    if(roster?.day_id!==c.id||!Array.isArray(roster.players)||!Array.isArray(roster.classes))throw Error('Invalid registration response.');
    const ids=roster.players.map((p:Row)=>p.player_id),profiles:Row[]=[];
    for(let i=0;i<ids.length;i+=100){const r=await db.from('profiles').select('id,full_name,username').in('id',ids.slice(i,i+100));if(r.error)throw r.error;profiles.push(...r.data??[]);}
    return {classes:roster.classes,mine:roster.mine,roster,players:roster.players.map((p:Row)=>({...p,display_name:profiles.find(v=>v.id===p.player_id)?.full_name||profiles.find(v=>v.id===p.player_id)?.username||'ParPlay player',class_name:roster.classes.find((v:Row)=>v.id===p.class_id)?.name}))};
  }
  if(c.kind==='league'){
    const data=await rpc('get_public_league_round_players_v1',leagueArgs(c));
    const rows=Array.isArray(data)?data:data?.players;
    if(!Array.isArray(rows))throw Error('Invalid player roster.');
    return {players:rows};
  }
  const r=await db.from('tournament_players').select('id,profile_id,status,class_code,class_name,profiles(username,full_name)').eq('tournament_id',c.id).in('status',['registered','waitlisted']).order('registered_at');
  if(r.error)throw r.error;
  return {players:(r.data??[]).map((p:Row)=>({...p,display_name:p.profiles?.full_name||p.profiles?.username||'ParPlay player'}))};
}
export async function registration(c:Context):Promise<Row>{
  if(c.kind==='putting')return players(c);
  const classes=await db.from('tournament_classes').select('id,code,name').eq('tournament_id',c.id).order('code');if(classes.error)throw classes.error;
  if(c.kind==='league'){
    const window=await rpc('get_public_league_round_registration_v2',leagueArgs(c));
    const mine=await rpc('get_my_league_round_registration_v1',leagueArgs(c));
    const flex=window?.start_format==='FLEX_START'?await rpc('get_league_flex_registration_v1',leagueArgs(c)):null;
    return {classes:classes.data,window,mine,flex};
  }
  const [window,profileResult,mineResult]=await Promise.all([
    rpc('get_public_tournament_registration_v1',{p_tournament_id:c.id}),
    db.from('profiles').select('parplay_player_number,parplay_plus_rating_current,birth_year,gender').eq('id',c.userId).single(),
    db.from('tournament_players').select('class_code,class_name,status').eq('tournament_id',c.id).eq('profile_id',c.userId).in('status',['registered','waitlisted']).maybeSingle(),
  ]);if(profileResult.error)throw profileResult.error;if(mineResult.error)throw mineResult.error;
  const codes=(classes.data??[]).map(v=>v.code);
  const defs=codes.length?await db.from('tournament_class_definitions').select('code,gender_eligibility,min_age,max_age,min_rating,max_rating').in('code',codes):{data:[],error:null};if(defs.error)throw defs.error;
  const passRaw=await rpc('get_tournament_pass_status_v1',{p_year:Number(c.event.start_date?.slice(0,4))});const pass=Array.isArray(passRaw)?passRaw[0]:passRaw;
  return {classes:classes.data,definitions:defs.data,profile:profileResult.data,mine:mineResult.data,window,pass};
}
export function eligible(c:Context,data:Row,option:Row){
  if(c.kind!=='tournament')return true;
  const d=data.definitions.find((v:Row)=>v.code===option.code),p=data.profile;if(!d)return false;
  const age=Number.isInteger(p.birth_year)?Number(c.event.start_date.slice(0,4))-p.birth_year:null;
  const rating=p.parplay_plus_rating_current;
  return !(d.min_age!=null&&(age==null||age<d.min_age)||d.max_age!=null&&(age==null||age>d.max_age)||d.min_rating!=null&&(rating==null||rating<d.min_rating)||d.max_rating!=null&&(rating==null||rating>d.max_rating)||d.gender_eligibility==='female'&&p.gender!=='female');
}
export async function groups(c:Context){
  if(c.kind==='putting'){
    const data=await rpc('get_putting_league_matches_v1',{p_day_id:c.id});
    if(data?.day_id!==c.id||!Array.isArray(data.rounds))throw Error('Invalid match response.');
    return data.rounds.filter((r:Row)=>r.status==='PUBLISHED');
  }
  const data=await rpc(c.kind==='league'?'get_public_league_round_groups_v1':'get_public_tournament_groups_v1',c.kind==='league'?leagueArgs(c):{p_tournament_id:c.id});
  if(!Array.isArray(data))throw Error('Invalid groups response.');return data;
}
export async function results(c:Context){
  if(c.kind==='putting')return {rounds:await groups(c)};
  if(c.kind==='league')return rpc('get_public_league_results_v1',{p_tournament_id:c.id});
  return rpc('get_public_tournament_live_overview_v1',{p_tournament_id:c.id});
}
export async function information(c:Context){
  if(c.kind==='putting')return {messages:c.event.messages??[],schedule:c.event.schedule??[]};
  const messages=await rpc('get_public_tournament_messages_v1',{p_tournament_id:c.id});
  const schedule=c.kind==='league'?await rpc('get_public_league_round_schedule_v1',leagueArgs(c)):[];
  return {messages:Array.isArray(messages)?messages:[],schedule};
}
export async function verifyOwner(c:Context){const r=await db.auth.getUser();if(r.error||r.data.user?.id!==c.userId)throw Error('Your session changed. Reload this page before continuing.');}
export {db};
