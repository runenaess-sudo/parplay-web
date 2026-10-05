import { readPublicEventRound } from './public-event-round';
export type TotalPlayer = { player_id: string; display_name: string; relative_to_par: number | null; place: number | null;
  completed_hole_count: number; rounds_played: number; rounds_finished: number; has_conflict: boolean; provisional: boolean };
export type Overview = { version: 1; tournament: { id: string; name: string };
  rounds: { id: string; round_number: number; status: string }[];
  classes: { id: string; code: string; name: string; players: TotalPlayer[] }[] };
export function readOverview(value: unknown, eventId: string): Overview {
  const d = value as Overview;
  if (!d || d.version !== 1 || d.tournament?.id !== eventId || typeof d.tournament.name !== 'string'
    || !Array.isArray(d.rounds) || !Array.isArray(d.classes)
    || d.rounds.some(r => typeof r.id !== 'string' || !Number.isInteger(r.round_number))
    || new Set(d.rounds.map(r => r.id)).size !== d.rounds.length
    || d.classes.some(c => typeof c.id !== 'string' || typeof c.code !== 'string' || !Array.isArray(c.players)
      || c.players.some(p => typeof p.player_id !== 'string' || typeof p.display_name !== 'string'
        || (p.relative_to_par !== null && !Number.isFinite(p.relative_to_par))
        || (p.place !== null && !Number.isInteger(p.place))))) throw new Error('Invalid Tournament overview');
  return d;
}
export async function readTournamentView(eventId: string, requested: string, signal: AbortSignal) {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!origin || !key) throw new Error('Public scorecard configuration unavailable');
  const response = await fetch(origin.replace(/\/$/, '') + '/rest/v1/rpc/get_public_tournament_live_overview_v1', {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, credentials: 'omit', cache: 'no-store', signal,
    body: JSON.stringify({ p_tournament_id: eventId }),
  });
  const raw: unknown = await response.json();
  if (!response.ok) throw raw;
  const overview = readOverview(raw, eventId);
  const view = overview.rounds.length === 1 ? overview.rounds[0].id
    : requested !== 'total' && overview.rounds.some(r => r.id === requested) ? requested : 'total';
  const round = view === 'total' ? null : await readPublicEventRound('tournament', eventId, view, signal);
  return { overview, round, view, requested };
}
