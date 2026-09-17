"use client";
/* eslint-disable @next/next/no-img-element -- Existing public avatar URLs. */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser as db } from '@/lib/supabase-browser';
import { courseCommunityHref, courseFeedArgs } from '@/lib/community-course';
import ShareExperience from './ShareExperience';
import CommunityModal from './CommunityModal';

type Post = { id: string; title: string; body: string; author_name: string; author_avatar: string | null; published_at: string; context_id: string; context_name: string; up_count: number; down_count: number; own_reaction: 'UP' | 'DOWN' | null };
const button = 'rounded-lg border border-white/20 px-3 py-3 text-sm hover:bg-white/10 disabled:opacity-50';
let locationAttempt: Promise<{ lat: number; lon: number } | null> | undefined;
function locate() {
    locationAttempt ??= new Promise(resolve => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }), () => resolve(null), { timeout: 10000, maximumAge: 60000 });
    });
    return locationAttempt;
}
export default function CourseFeed({ courseId, courseName, preview = false }: { courseId?: string; courseName?: string; preview?: boolean }) {
    const [scope, setScope] = useState('nearby');
    const [country, setCountry] = useState('');
    const [countries, setCountries] = useState<{ value: string; label: string }[]>([]);
    const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null);
    const [locationReady, setLocationReady] = useState(!!courseId);
    const [locationMessage, setLocationMessage] = useState('');
    const [sort, setSort] = useState('newest');
    const [offset, setOffset] = useState(0);
    const [result, setResult] = useState<{ items: Post[]; has_more: boolean; course_name: string | null } | null>(null);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const [user, setUser] = useState<string | null>(null);
    const [share, setShare] = useState(false);
    const [report, setReport] = useState<Post | null>(null);
    const [reason, setReason] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const scopeChanged = useRef(false);
    useEffect(() => { const { data } = db.auth.onAuthStateChange((_e, s) => setUser(s?.user.id ?? null)); return () => data.subscription.unsubscribe(); }, []);
    useEffect(() => {
        if (courseId) return;
        let live = true;
        void db.rpc('get_community_course_countries_v1').then(({ data, error }) => { if (live) { if (error) setLocationMessage('Country list unavailable. Nearby and All remain available.'); else setCountries(data ?? []); } });
        void locate().then(p => { if (!live) return; setPosition(p); setLocationReady(true); if (!p) { if (!scopeChanged.current) setScope('all'); setLocationMessage('Location unavailable. Showing All unless you select a country.'); } });
        return () => { live = false; };
    }, [courseId]);
    useEffect(() => {
        if (!courseId && ((!locationReady && scope === 'nearby') || (scope === 'country' && !country) || (scope === 'nearby' && !position))) return;
        let live = true;
        void (async () => {
            try { const { data, error } = await db.rpc('get_community_course_feed_v1', courseFeedArgs(courseId, scope, country, position, sort, preview, offset)); if (error) throw error; if (live) setResult(data); }
            catch { if (live) setError('Could not load course experiences. Please try again.'); }
        })();
        return () => { live = false; };
    }, [courseId, scope, country, position, sort, preview, offset, revision, user, locationReady]);
    function reset() { setResult(null); setError(''); setOffset(0); }
    function auth() { if (user) return true; window.location.assign(`/login?returnTo=${encodeURIComponent(courseId ? courseCommunityHref(courseId) : '/community')}`); return false; }
    async function react(post: Post, reaction: 'UP' | 'DOWN') {
        if (!auth() || lock.current) return;
        lock.current = true; setBusy(true); setNotice('');
        try { const { error } = await db.rpc('react_community_post_v1', { p_post_id: post.id, p_reaction: post.own_reaction === reaction ? null : reaction }); if (error) throw error; setResult(null); setRevision(n => n + 1); }
        catch { setNotice('Reaction could not be saved. Try again.'); }
        finally { lock.current = false; setBusy(false); }
    }
    async function sendReport() {
        if (!report || lock.current) return;
        lock.current = true; setBusy(true);
        try { const { error } = await db.rpc('report_community_post_v1', { p_post_id: report.id, p_reason: reason.trim() }); if (error) throw error; setReport(null); setNotice('Your report is recorded for review.'); }
        catch { setNotice('Could not send report. Try again.'); }
        finally { lock.current = false; setBusy(false); }
    }
    const name = courseName || result?.course_name;
    const posts = preview ? result?.items.slice(0, 3) : result?.items;
    return <section className="space-y-4 text-white [overflow-wrap:anywhere]">
        <h2 className="text-xl font-semibold">{preview ? 'Player experiences' : 'Courses'}</h2>
        {courseId ? <div><p className="text-emerald-200">{name || 'Course experiences'}</p>{!preview && <Link href="/community?category=course" className="mt-2 inline-block text-sm text-cyan-200">Browse all Courses experiences →</Link>}</div> : <div className="space-y-3"><div className="flex flex-wrap gap-2">{[['nearby', 'Nearby · 250 km'], ['country', 'Country'], ['all', 'All']].map(([value, label]) => <button key={value} disabled={value === 'nearby' && locationReady && !position} aria-pressed={scope === value} className={`${button} ${scope === value ? 'bg-emerald-500/15' : ''}`} onClick={() => { scopeChanged.current = true; reset(); setScope(value); }}>{label}</button>)}</div>{scope === 'country' && <label className="block text-sm">Country<select value={country} onChange={e => { reset(); setCountry(e.target.value); }} className="ml-2 max-w-full rounded-lg bg-[#172b25] p-3"><option value="">Select a country</option>{countries.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>}{locationMessage && <p role="status" className="text-sm text-slate-400">{locationMessage}</p>}</div>}
        {!preview && <div className="flex gap-2">{['newest', 'helpful'].map(s => <button className={button} key={s} aria-pressed={sort === s} onClick={() => { reset(); setSort(s); }}>{s === 'newest' ? 'Newest' : 'Most helpful'}</button>)}</div>}
        {notice && !report && <p role="status">{notice}</p>}
        {error ? <p role="alert">{error} <button className={button} onClick={() => { reset(); setRevision(n => n + 1); }}>Retry</button></p> : !courseId && scope === 'country' && !country ? <p>Select a country to see experiences.</p> : !result ? <p role="status">Loading course experiences…</p> : <>
            {!posts?.length && <p className="text-slate-400">No approved experiences for this course or scope yet.</p>}
            {posts?.map(p => <article key={p.id} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2">{p.author_avatar && <img src={p.author_avatar} alt="" className="h-8 w-8 rounded-full object-cover" />}<div className="min-w-0"><p className="font-semibold">{p.author_name}</p><time className="text-xs text-slate-400" dateTime={p.published_at}>{new Date(p.published_at).toLocaleDateString()}</time></div></div>{!courseId && <Link className="text-sm text-cyan-200" href={`/courses/${p.context_id}`}>{p.context_name}</Link>}<h3 className="font-semibold">{p.title}</h3><p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{p.body}</p><div className="flex flex-wrap gap-2">{(['UP', 'DOWN'] as const).map(r => <button key={r} className={button} disabled={busy} aria-pressed={p.own_reaction === r} onClick={() => void react(p, r)}>{r === 'UP' ? '👍 Helpful' : '👎 Not helpful'} {r === 'UP' ? p.up_count : p.down_count}</button>)}{!preview && <button className={button} onClick={() => { if (auth()) { setReason(''); setNotice(''); setReport(p); } }}>Report</button>}</div></article>)}
            {preview ? courseId && (result.items.length > 3 || result.has_more) && <Link className="inline-block text-emerald-200" href={courseCommunityHref(courseId)}>View more →</Link> : <div className="flex gap-3"><button className={button} disabled={!offset} onClick={() => { setResult(null); setOffset(n => n - 20); }}>Previous</button><button className={button} disabled={!result.has_more || offset >= 10000} onClick={() => { setResult(null); setOffset(n => n + 20); }}>Next</button></div>}
        </>}
        {courseId && name && <button className={`${button} bg-emerald-500/10`} onClick={() => { if (auth()) setShare(true); }}>Share your experience</button>}
        {share && <ShareExperience category="course" contextType="course" contextId={courseId} contextName={name ?? undefined} onClose={() => setShare(false)} />}
        {report && <CommunityModal title="Report experience" onClose={() => { if (!lock.current) setReport(null); }}><form onSubmit={e => { e.preventDefault(); void sendReport(); }}><label>Reason<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="my-3 block w-full rounded-lg bg-white/10 p-3" /></label>{notice && <p role="alert">{notice}</p>}<button className={button} disabled={busy || !reason.trim()}>Send report</button></form></CommunityModal>}
    </section>;
}
