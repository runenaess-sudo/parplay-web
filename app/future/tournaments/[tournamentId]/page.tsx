import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eventLabel, eventMetadata, getPublicEventShare } from '@/lib/public-event-share';

type Props = { params: Promise<{ tournamentId: string }>; searchParams: Promise<{ leagueRoundId?: string | string[] }> };
async function resolveEvent({ params, searchParams }: Props) {
  const [{ tournamentId }, query] = await Promise.all([params, searchParams]);
  if (Array.isArray(query.leagueRoundId)) notFound();
  const result = await getPublicEventShare(tournamentId, query.leagueRoundId ?? null);
  if (!result) notFound();
  return result;
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { event, image } = await resolveEvent(props);
  return eventMetadata(event, image);
}
export default async function PublicEventPage(props: Props) {
  const { event, image } = await resolveEvent(props);
  return <main className="mx-auto w-full max-w-3xl px-6 py-12">
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      {/* Public storage/default asset; preserve the uploaded image's proportions. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={image.alt} className="max-h-80 w-full bg-slate-50 object-contain" />
      <div className="space-y-4 p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Follow my event</p>
        <h1 className="text-3xl font-bold">{event.name}</h1>
        <p className="font-semibold">{eventLabel(event)}</p>
        {event.places.length > 0 && <p>Place: {event.places.join(', ')}</p>}
        {event.type === 'league' && event.layout_name && <p>Layout: {event.layout_name}</p>}
        <p className="text-slate-600">Follow this event in ParPlay.</p>
        <Link href="/" className="inline-block font-semibold text-emerald-800 underline">Explore ParPlay</Link>
      </div>
    </article>
  </main>;
}
