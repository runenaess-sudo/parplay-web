import {redirect} from 'next/navigation';
import {getVerifiedServerUser,supabaseServer} from '@/lib/supabase-server';
import EventDetails from '../../details/EventDetails';
export default async function PuttingEventPage({params}:{params:Promise<{dayId:string}>}){
 const db=await supabaseServer(),user=await getVerifiedServerUser(db);if(!user)redirect('/login');
 const {dayId}=await params;return <EventDetails key={dayId} id={dayId} putting userId={user.id}/>;
}
