import 'server-only';
import { cache } from 'react';
import type { Metadata } from 'next';

export const PUBLIC_EVENT_ORIGIN = 'https://www.parplay.no';
export type PublicEventShare = {
  event_id: string; name: string; type: 'tournament' | 'league'; image_url: string | null;
  places: string[]; layout_name: string | null; league_round_id: string | null; round_number: number | null;
};
export type ShareImage = { url: string; alt: string; width?: number; height?: number; type?: string };
const uuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const eventLabel = (e: PublicEventShare) => e.type === 'tournament' ? 'Tournament'
  : e.round_number === null ? 'League' : 'League · Round ' + e.round_number;
export const eventCanonical = (e: PublicEventShare) => PUBLIC_EVENT_ORIGIN + '/future/tournaments/' + e.event_id
  + (e.type === 'league' && e.league_round_id ? '?leagueRoundId=' + e.league_round_id : '');
export function eventMetadata(e: PublicEventShare, image: ShareImage): Metadata {
  const title = 'Follow my event: ' + e.name;
  const description = eventLabel(e) + (e.places.length ? '. Place: ' + e.places.join(', ') : '');
  const url = eventCanonical(e);
  return { title, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'ParPlay', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [{ url: image.url, alt: image.alt }] } };
}
export function readEventShare(value: unknown, eventId: string, roundId: string | null): PublicEventShare | null {
  if (value === null) return null;
  const e = value as PublicEventShare;
  if (!e || e.event_id !== eventId || typeof e.name !== 'string' || !['tournament','league'].includes(e.type)
    || !Array.isArray(e.places) || !e.places.every(p => typeof p === 'string')
    || (e.image_url !== null && typeof e.image_url !== 'string')
    || (e.layout_name !== null && typeof e.layout_name !== 'string')
    || (e.type === 'tournament' && (e.league_round_id !== null || e.round_number !== null))
    || (e.type === 'league' && (e.league_round_id !== roundId
      || (roundId !== null ? !Number.isInteger(e.round_number) || e.round_number! < 1 : e.round_number !== null))))
    throw new Error('Invalid public event response');
  return { event_id: e.event_id, name: e.name, type: e.type, image_url: e.image_url, places: e.places,
    layout_name: e.layout_name, league_round_id: e.league_round_id, round_number: e.round_number };
}
export async function publicShareImage(e: PublicEventShare, storageOrigin: string): Promise<ShareImage> {
  const fallback = { url: PUBLIC_EVENT_ORIGIN + '/og/parplay-horizontal.png', alt: 'ParPlay', width: 578, height: 348, type: 'image/png' };
  if (!e.image_url) return fallback;
  try {
    const url = new URL(e.image_url);
    if (url.protocol !== 'https:' || url.origin !== new URL(storageOrigin).origin || url.username || url.password
      || url.search || url.hash || !url.pathname.startsWith('/storage/v1/object/public/course-images/')) return fallback;
    // No cookies, signed URLs, redirects or arbitrary-host fetches.
    const response = await fetch(url, { method: 'HEAD', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(4000) });
    const type = response.headers.get('content-type')?.split(';')[0];
    if (response.ok && type && ['image/jpeg','image/png','image/webp'].includes(type)) return { url: url.href, alt: e.name, type };
  } catch { /* Missing/unavailable optional image uses the official fallback. */ }
  return fallback;
}
// Request-local memoization shares exactly one public read between page and metadata.
export const getPublicEventShare = cache(async (eventId: string, roundId: string | null) => {
  if (!uuid(eventId) || (roundId !== null && !uuid(roundId))) return null;
  eventId = eventId.toLowerCase();
  roundId = roundId?.toLowerCase() ?? null;
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!origin || !key) throw new Error('Public event configuration unavailable');
  const response = await fetch(origin.replace(/\/$/,'') + '/rest/v1/rpc/get_public_event_share_v1', {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, credentials: 'omit', cache: 'no-store',
    signal: AbortSignal.timeout(10000), body: JSON.stringify({ p_event_id: eventId, p_league_round_id: roundId }),
  });
  if (!response.ok) throw new Error('Public event unavailable');
  const event = readEventShare(await response.json(), eventId, roundId);
  return event ? { event, image: await publicShareImage(event, origin) } : null;
});
