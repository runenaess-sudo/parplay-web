import { redirect } from 'next/navigation';
import { getVerifiedServerUser, supabaseServer } from '@/lib/supabase-server';
import EventsOverview from './EventsOverview';

export default async function TournamentsPage() {
  const supabase = await supabaseServer();
  const user = await getVerifiedServerUser(supabase);
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('country').eq('id', user.id).maybeSingle();
  return <EventsOverview userId={user.id} profileCountry={profile?.country ?? null} />;
}
