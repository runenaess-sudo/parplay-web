import { readContract } from './tournament-live';

// Public reads must not await the signed-in client's auth initialization/refresh.
// A stalled auth callback can block its fetch wrapper before AbortSignal reaches fetch.
export async function readPublicEventRound(eventType: 'tournament' | 'league', eventId: string, roundId: string, signal: AbortSignal) {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!origin || !key) throw new Error('Public scorecard configuration unavailable');
  const rpc = eventType === 'league' ? 'get_public_league_live_scorecard_v1' : 'get_public_tournament_live_scorecard_v1';
  const response = await fetch(`${origin.replace(/\/$/, '')}/rest/v1/rpc/${rpc}`, {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    credentials: 'omit', cache: 'no-store', signal,
    body: JSON.stringify({ p_tournament_id: eventId, p_round_id: roundId }),
  });
  const data: unknown = await response.json();
  if (!response.ok) throw data;
  return readContract(data, eventId, roundId);
}
