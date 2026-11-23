import type {Matches} from './puttingTypes';
export function leagueDayResults(data:Matches,selection:number|'total') {
 const rows=new Map<string,{player_id:string;class_id:string;match:number;hits:number;finished:number;pending:number;bye:number;unpaired:number;place:number}>();
 const seenRounds=new Set<string>(),seenDuels=new Set<string>();
 for(const round of data.rounds) {
  if(round.status!=='PUBLISHED'||(selection!=='total'&&round.round_number!==selection)||seenRounds.has(round.id))continue;
  seenRounds.add(round.id);
  for(const duel of round.duels) {
   if(seenDuels.has(duel.id))continue;seenDuels.add(duel.id);
   const ids=new Set(duel.players.map(p=>p.player_id));
   const complete=duel.kind==='DUEL'&&duel.duel_status==='FINISHED'&&duel.result?.length===2&&new Set(duel.result.map(r=>r.player_id)).size===2&&duel.result.every(r=>ids.has(r.player_id));
   for(const p of duel.players) {
    const key=duel.class_id+':'+p.player_id;
    const row=rows.get(key)??{player_id:p.player_id,class_id:duel.class_id,match:0,hits:0,finished:0,pending:0,bye:0,unpaired:0,place:0};
    if(duel.kind==='BYE')row.bye++;
    else if(duel.kind==='UNPAIRED')row.unpaired++;
    else if(complete) {
     const score=duel.result!.find(r=>r.player_id===p.player_id)!;
     row.match+=Number.isFinite(score.match_points)?score.match_points:0;
     row.hits+=typeof score.hit_points==='number'&&Number.isFinite(score.hit_points)?score.hit_points:0;
     row.finished++;
    } else row.pending++;
    rows.set(key,row);
   }
  }
 }
 const sorted=[...rows.values()].sort((a,b)=>a.class_id.localeCompare(b.class_id)||b.match-a.match||b.hits-a.hits||a.player_id.localeCompare(b.player_id));
 let index=0,previous:typeof sorted[number]|undefined;
 for(const row of sorted) {
  if(previous?.class_id!==row.class_id){index=0;previous=undefined;}index++;
  row.place=previous&&previous.match===row.match&&previous.hits===row.hits?previous.place:index;previous=row;
 }
 return sorted;
}
export function publishedLeagueDays<T extends {id:string;league_id:string;status:string;starts_at:string}>(days:T[],leagueId:string) {
 return [...new Map(days.filter(d=>d.league_id===leagueId&&d.status!=='DRAFT').map(d=>[d.id,d])).values()].sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
}
