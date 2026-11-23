'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { COUNTRIES } from './countries';
import { countryCode, distanceKm, loadEvents, type Status } from './events';

type Data = Awaited<ReturnType<typeof loadEvents>>;
const field = 'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-blue-400 focus:outline-none';
const labels = {upcoming: 'Upcoming', ongoing: 'Ongoing', finished: 'Finished'};
export default function EventsOverview({userId, profileCountry}: {userId: string; profileCountry: string | null}) {
  const [data, setData] = useState<Data | null>(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<Status>('upcoming'), [scope, setScope] = useState<'all' | 'my'>('all');
  const [search, setSearch] = useState(''), [month, setMonth] = useState('all'), [radius, setRadius] = useState('9999');
  const [country, setCountry] = useState(countryCode(profileCountry) ?? 'all');
  const [position, setPosition] = useState<{lat: number; lng: number} | null>(null), [locationMessage, setLocationMessage] = useState('');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('parplay:events:country:v1:' + userId);
      if (saved === 'all' || countryCode(saved)) setCountry(saved === 'all' ? saved : countryCode(saved)!);
    } catch { /* Country preference remains usable without storage. */ }
  }, [userId]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void loadEvents(userId).then(result => { if (active) setData(result); })
      .catch(() => { if (active) setError('Events could not be loaded. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, retry]);
  function locate() {
    if (!navigator.geolocation) { setLocationMessage('Location is unavailable. You can still browse all events.'); return; }
    setLocationMessage('Finding your location?');
    navigator.geolocation.getCurrentPosition(p => {
      setPosition({lat: p.coords.latitude, lng: p.coords.longitude}); setLocationMessage('');
    }, () => { setLocationMessage('Location is unavailable. Distance filtering is disabled.'); }, {timeout: 10000, maximumAge: 300000});
  }
  const events = useMemo(() => {
    const year = new Date().getFullYear(), query = search.trim().toLowerCase();
    return (data?.events ?? []).map(event => ({...event, distance: position ? distanceKm(position, event) : null}))
      .filter(event => event.status === status
        && (country === 'all' || event.country === country)
        && (month === 'all' || !!event.date && Number(event.date.slice(0,4)) === year && Number(event.date.slice(5,7)) === Number(month))
        // Mobile My Events scopes finished Tournaments only; League/Putting remain visible.
        && (status !== 'finished' || scope !== 'my' || event.type !== 'tournament' || !data?.membershipError && data?.registered.has(event.id))
        && (!position || radius === '9999' || event.distance !== null && event.distance <= Number(radius))
        && [event.name, event.location, event.courseName, event.type].some(value => value.toLowerCase().includes(query)))
      .sort((a,b) => status === 'finished' ? (b.date ?? '').localeCompare(a.date ?? '') : (a.date ?? '').localeCompare(b.date ?? ''));
  }, [data, status, scope, search, country, month, position, radius]);
  const retryButton = <button type="button" onClick={() => setRetry(n => n + 1)} className="font-semibold text-blue-300 underline">Try again</button>;
  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-blue-300">ParPlay</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Tournaments & Events</h1>
      <p className="mt-2 text-slate-400">Explore tournaments, league rounds and Putting events.</p></header>
    <section aria-label="Event filters" className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex gap-2" role="tablist" aria-label="Event status">
        {(['upcoming','ongoing','finished'] as const).map(value => <button type="button" role="tab" aria-selected={status === value} key={value}
          onClick={() => { setStatus(value); setScope('all'); }}
          className={'flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition sm:flex-none sm:px-6 ' + (status === value ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/50' : 'text-slate-300 hover:bg-white/5')}>{labels[value]}</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs text-slate-400">Search<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Event, course or place" className={field} /></label>
        <label className="space-y-1 text-xs text-slate-400">Country<select value={country} onChange={e => {setCountry(e.target.value); try {localStorage.setItem('parplay:events:country:v1:' + userId, e.target.value);} catch { /* Optional preference. */ }}} className={field}>
          <option value="all">All countries</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-400">Month<select value={month} onChange={e => setMonth(e.target.value)} className={field}>
          <option value="all">All months</option>{Array.from({length:12}, (_,i) => <option key={i} value={i+1}>{new Intl.DateTimeFormat('en', {month:'long'}).format(new Date(2020,i,1))}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-400">Distance<select value={radius} onChange={e => setRadius(e.target.value)} disabled={!position} className={field + ' disabled:opacity-50'}>
          <option value="9999">Any distance</option>{[100,250,500].map(km => <option key={km} value={km}>Within {km} km</option>)}</select></label>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" onClick={locate} className="text-blue-300 hover:underline">{position ? 'Update my location' : 'Use my location for distances'}</button>
        {locationMessage && <span role="status" className="text-slate-400">{locationMessage}</span>}</div>
      {status === 'finished' && <div className="flex gap-2" aria-label="Finished event scope">{(['my','all'] as const).map(value => <button type="button" key={value} aria-pressed={scope === value} onClick={() => setScope(value)}
        className={'rounded-lg px-4 py-2 text-sm font-semibold ' + (scope === value ? 'bg-blue-500/20 text-blue-200' : 'text-slate-400 hover:text-white')}>{value === 'my' ? 'My Events' : 'All Events'}</button>)}</div>}
    </section>
    {(error || data?.errors.length || status === 'finished' && scope === 'my' && data?.membershipError) ? <div role="alert" className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
      {error && <p>{error}</p>}{data?.errors.map((message,i) => <p key={i}>{message}</p>)}
      {status === 'finished' && scope === 'my' && data?.membershipError && <p>Your tournament registrations could not be loaded.</p>}{retryButton}</div> : null}
    {loading ? <p role="status" className="py-12 text-center text-slate-400">Loading events?</p> : <>
      <p aria-live="polite" className="text-sm text-slate-400">{events.length} {events.length === 1 ? 'event' : 'events'}</p>
      {!events.length ? <p className="rounded-2xl border border-slate-800 p-10 text-center text-slate-400">No matching events.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {events.map(event => {
          const content = <><div className="flex items-center justify-between gap-3 text-xs font-semibold"><span className={event.type === 'putting' ? 'text-yellow-300' : event.type === 'league' ? 'text-blue-300' : 'text-emerald-300'}>{event.type === 'putting' ? 'Putting' : event.type === 'league' ? 'League' : 'Tournament'}</span>
            <span className={'rounded-full px-2.5 py-1 ' + (event.status === 'ongoing' ? 'bg-emerald-500/15 text-emerald-300' : event.status === 'finished' ? 'bg-slate-700 text-slate-300' : 'bg-blue-500/15 text-blue-300')}>{labels[event.status as Status]}</span></div>
            <h2 className="mt-4 text-lg font-bold text-white">{event.name}</h2>
            <p className="mt-2 text-sm text-slate-300">{event.date ? new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(event.date.slice(0,10) + 'T12:00:00Z')) : 'Date to be announced'}</p>
            {event.courseName && <p className="mt-2 font-medium text-slate-200">{event.courseName}</p>}
            <p className="mt-1 text-sm text-slate-400">{[event.location, event.country].filter(Boolean).join(' ? ') || 'Location unavailable'}{event.distance !== null ? ' ? ' + Math.round(event.distance) + ' km' : ''}</p>
            <p className="mt-5 text-sm font-semibold text-blue-300">{event.href ? 'View event ?' : 'Open this event in the ParPlay app'}</p></>;
          const card = 'block h-full rounded-2xl border border-slate-700 bg-slate-900/60 p-5';
          return event.href ? <Link key={event.key} href={event.href} className={card + ' transition hover:border-blue-400/60 hover:bg-slate-800/70'}>{content}</Link> : <article key={event.key} className={card}>{content}</article>;
        })}
      </div>}
    </>}
  </div>;
}
