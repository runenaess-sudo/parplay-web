import { supabaseBrowser as supabase } from '@/lib/supabase-browser';
import { COUNTRIES } from './countries';
export type Status = 'upcoming' | 'ongoing' | 'finished';
export type Event = {
  key: string; id: string; name: string; type: 'tournament' | 'league' | 'putting';
  status: string; date: string | null; location: string; courseName: string; country: string | null;
  latitude: number | null; longitude: number | null; href: string | null;
};
export function countryCode(value?: string | null, address?: string | null): string | null {
  if (!value?.trim()) {
    const parts = address?.split(',');
    if (!parts || parts.length < 2) return null;
    const tail = parts[parts.length - 1].trim().toLowerCase();
    return COUNTRIES.find(c => c.name.toLowerCase() === tail)?.code ?? null;
  }
  const key = value.trim().toLowerCase();
  return COUNTRIES.find(c => c.code.toLowerCase() === key || c.name.toLowerCase() === key)?.code ?? null;
}
export function localDate(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const part = (key: string) => parts.find(p => p.type === key)?.value;
  return part('year') + '-' + part('month') + '-' + part('day');
}
export function distanceKm(position: {lat: number; lng: number}, event: Event): number | null {
  if (event.latitude == null || event.longitude == null) return null;
  const rad = Math.PI / 180;
  const a = Math.sin((event.latitude - position.lat) * rad / 2) ** 2
    + Math.cos(position.lat * rad) * Math.cos(event.latitude * rad) * Math.sin((event.longitude - position.lng) * rad / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
export async function loadEvents(userId: string) {
  const events: Event[] = [], errors: string[] = [];
  const [tournaments, putting, membership] = await Promise.allSettled([
    supabase.from('tournaments').select('id,name,location,start_date,end_date,type,status,country,course_id,timezone').eq('is_published', true),
    supabase.rpc('get_public_putting_league_days_v1', { p_day_id: null }),
    supabase.from('tournament_players').select('tournament_id').eq('profile_id', userId).eq('status', 'registered'),
  ]);
  const registered = new Set<string>();
  let membershipError = false;
  if (membership.status === 'fulfilled' && !membership.value.error) {
    for (const row of membership.value.data ?? []) registered.add(row.tournament_id);
  } else membershipError = true;
  if (tournaments.status === 'fulfilled' && !tournaments.value.error) {
    const rows = tournaments.value.data ?? [];
    const places: {courseId: string | null; event: Event}[] = [];
    for (const row of rows.filter(row => row.type !== 'league')) {
      const event: Event = {key: 'tournament:' + row.id, id: row.id, name: row.name, type: 'tournament', status: row.status,
        date: row.start_date, location: row.location ?? '', courseName: '', country: countryCode(row.country),
        latitude: null, longitude: null, href: '/tournaments/' + row.id};
      events.push(event); places.push({courseId: row.course_id, event});
    }
    await Promise.all(rows.filter(row => row.type === 'league').map(async league => {
      try {
        const {data, error} = await supabase.rpc('get_public_league_round_places_v1', {p_tournament_id: league.id});
        if (error || !Array.isArray(data)) throw error ?? new Error('Invalid rounds');
        for (const round of data) {
          if (!round.tournament_round_id) continue;
          const event: Event = {key: 'league:' + league.id + ':' + round.tournament_round_id, id: league.id,
            name: league.name + ' - Round ' + round.round_number, type: 'league', status: round.status,
            date: round.start_time ? localDate(round.start_time, league.timezone || 'UTC') : null,
            location: league.location ?? '', courseName: '', country: countryCode(league.country), latitude: null, longitude: null,
            href: '/tournaments/' + league.id + '?leagueRoundId=' + encodeURIComponent(round.tournament_round_id)};
          events.push(event); places.push({courseId: round.course_id, event});
        }
      } catch { errors.push('Rounds for ' + league.name + ' could not be loaded.'); }
    }));
    const ids = [...new Set(places.flatMap(p => p.courseId ? [p.courseId] : []))];
    if (ids.length) {
      const {data, error} = await supabase.from('courses').select('id,name,location,latitude,longitude').in('id', ids);
      if (error) errors.push('Some course locations could not be loaded.');
      else {
        const courses = new Map((data ?? []).map(c => [c.id, c]));
        for (const item of places) {
          const course = item.courseId ? courses.get(item.courseId) : null;
          if (course) Object.assign(item.event, {courseName: course.name, location: course.location || item.event.location,
            latitude: course.latitude, longitude: course.longitude});
        }
      }
    }
  } else errors.push('Tournaments and leagues could not be loaded.');
  if (putting.status === 'fulfilled' && !putting.value.error && Array.isArray(putting.value.data)) {
    for (const day of putting.value.data) {
      try {
        events.push({key: 'putting:' + day.id, id: day.id, name: day.league_name + ' ? Day ' + day.day_number,
          type: 'putting', status: day.status === 'FINISHED' ? 'finished' : ['IN_PROGRESS', 'READY_TO_FINISH'].includes(day.status) ? 'ongoing' : 'upcoming',
          date: localDate(day.starts_at, day.timezone), location: day.location ?? '', courseName: '',
          country: countryCode(day.country, day.address), latitude: day.latitude, longitude: day.longitude, href: '/tournaments/putting/' + day.id});
      } catch { errors.push('A Putting event could not be displayed.'); }
    }
  } else errors.push('Putting events could not be loaded.');
  return {events, registered, membershipError, errors};
}
