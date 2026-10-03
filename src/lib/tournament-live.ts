import { compareEventClasses } from './event-class-order';

export type Hole = { hole_id: string; display_order: number; par: number; distance: number | null };
export type Score = { hole_id: string; strokes: number | null; score_source: string | null; has_conflict: boolean;
  session_hole_state: 'not_started' | 'matched' | 'awaiting_scorers' | 'discrepancy' };
export type Player = {
  player_id: string; display_name: string; started: boolean; scores: Score[];
  total_hole_count: number; completed_hole_count: number; relative_to_par: number | null;
  authoritative_total_strokes: number | null; played_total_strokes: number | null;
  is_finished: boolean; has_conflict: boolean; is_display_complete: boolean;
  round_rating: number | null; rating_state: 'unavailable' | 'evolving' | 'final';
};
export type LiveClass = { id: string; code: string; name: string;
  course: { id: string; name: string }; layout: { id: string; name: string }; holes: Hole[]; players: Player[] };
export type TournamentLive = { version: 1; tournament: { id: string; name: string };
  round: { id: string; round_number: number; status: string }; classes: LiveClass[] };

export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const orderedClasses = (classes: LiveClass[]) => [...classes].sort((a, b) => compareEventClasses(a.code, b.code, a.id, b.id));
export const selectedClass = (classes: LiveClass[], id: string | null) => classes.find(c => c.id === id) ?? orderedClasses(classes)[0];
// Same placementScore/resultPlace semantics as Tournament Results: no Regular Thru/Rd tie-breaker.
export const total = (player: Player) => player.authoritative_total_strokes ?? player.played_total_strokes;
export function rankedPlayers(players: Player[]) {
  return [...players].sort((a, b) => {
    const left = total(a), right = total(b);
    return left === null ? right === null ? 0 : 1 : right === null ? -1 : left - right;
  }).map(player => ({ player, place: total(player) === null ? null
    : 1 + players.filter(other => total(other) !== null && total(other)! < total(player)!).length }));
}
export const relative = (value: number | null) => value === null ? '—' : value === 0 ? 'E' : value > 0 ? `+${value}` : `${value}`;
export const thru = (player: Player) => !player.started ? '—' : player.is_finished ? 'F' : `${player.completed_hole_count}`;
export const rating = (player: Player) => player.rating_state === 'unavailable' || player.round_rating === null ? '—' : `${Math.round(player.round_rating)}`;
export function scoreState(score: Score | undefined) {
  if (score?.has_conflict) return 'conflict';
  if (score?.strokes == null) return 'empty';
  if (score.score_source === 'CONFIRMED_BY_GROUP_EXCEPTION') return 'confirmed';
  if (score.session_hole_state !== 'matched' || score.score_source === 'OTHER_SCORER_PROVISIONAL') return 'provisional';
  return 'confirmed';
}

export type Failure = { permanent: boolean; message: string };
export function publicFailure(error: unknown): Failure {
  const e = error as { code?: string; message?: string } | null;
  if (e?.message?.includes('INCONSISTENT')) return { permanent: true, message: 'This round’s course or scorecard setup is unavailable. Please try again later.' };
  if (e?.code === '42501' || e?.code === '22023' || e?.code === '22P02') return { permanent: true, message: 'This Tournament round is unavailable or is not public.' };
  return { permanent: false, message: 'Unable to refresh right now. Retrying automatically.' };
}

export function readContract(value: unknown, tournamentId: string, roundId: string): TournamentLive {
  // Validate the route identity and render-critical collections, without interpreting scores.
  const data = value as TournamentLive | null;
  if (!data || data.version !== 1 || data.tournament?.id !== tournamentId || data.round?.id !== roundId
    || typeof data.tournament.name !== 'string' || !Array.isArray(data.classes)
    || data.classes.some(c => !c || typeof c.id !== 'string' || typeof c.code !== 'string'
      || typeof c.course?.name !== 'string' || typeof c.layout?.name !== 'string'
      || !Array.isArray(c.holes) || c.holes.some(h => !h || typeof h.hole_id !== 'string' || !Number.isFinite(h.display_order))
      || !Array.isArray(c.players) || c.players.some(p => !p || typeof p.player_id !== 'string'
        || typeof p.display_name !== 'string' || !Array.isArray(p.scores)))) throw new Error('Invalid spectator response');
  return data;
}

// Schedule AFTER settlement: even a slow request cannot overlap the next poll.
export function pollTournament<T>(load: (signal: AbortSignal) => Promise<T>, receive: (value: T) => void,
  failed: (error: unknown) => void, interval = 4000) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const run = async () => {
    try { const value = await load(controller.signal); if (!stopped) receive(value); }
    catch (error) { if (!stopped) failed(error); }
    finally { if (!stopped) timer = setTimeout(run, interval); }
  };
  void run();
  return () => { stopped = true; clearTimeout(timer); controller.abort(); };
}
