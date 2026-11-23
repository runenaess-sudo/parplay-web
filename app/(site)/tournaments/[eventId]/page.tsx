import {redirect} from 'next/navigation';
import {getVerifiedServerUser,supabaseServer} from '@/lib/supabase-server';
import EventDetails from '../details/EventDetails';
export default async function EventPage({params,searchParams}:{params:Promise<{eventId:string}>;searchParams:Promise<{leagueRoundId?:string|string[]}>}){
 const db=await supabaseServer(),user=await getVerifiedServerUser(db);if(!user)redirect('/login');
 const [{eventId},query]=await Promise.all([params,searchParams]);
 if(Array.isArray(query.leagueRoundId))throw Error('Invalid League round.');
 return <EventDetails key={eventId+':'+(query.leagueRoundId??'')} id={eventId} roundId={query.leagueRoundId} userId={user.id}/>;
}
