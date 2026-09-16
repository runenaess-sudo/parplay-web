"use client";
/* eslint-disable @next/next/no-img-element -- Canonical public profile/course/video image URLs. */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser as db } from '@/lib/supabase-browser';
import { communityCategories, type CommunityCategory } from '@/lib/community-admin';
import CommunityModal from './CommunityModal';
import ShareExperience from './ShareExperience';

type Post = { id: string; title: string; body: string; category: CommunityCategory; author_name: string; author_avatar: string | null; published_at: string; context_type: string | null; context_id: string | null; context_name: string | null; up_count: number; down_count: number; own_reaction: 'UP' | 'DOWN' | null };
type Builder = { user_id: string; display_name: string; avatar_url: string | null; rank: number; qualifying_course_count: number };
type Course = { id: string; name: string; builder_name: string; image_url: string | null; first_published_at: string };
type Video = { id: string; caption: string | null; thumbnail_url: string | null; video_url: string | null; transcoded_url: string | null; transcoded_filename: string | null; raw_filename: string | null; transcoded_ready: boolean; processing_status: string; duration_seconds?: number; author_name: string; author_avatar: string | null; created_at: string };
const glass = 'rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg';
const button = 'rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50';
function date(value: string) { return value ? new Date(value).toLocaleDateString() : ''; }
function Avatar({ url, name }: { url: string | null; name: string }) { return url ? <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-xs">{name.slice(0, 2).toUpperCase()}</span>; }
function playback(v: Video) {
    const stored = (bucket: string, key: string) => db.storage.from(bucket).getPublicUrl(key).data.publicUrl;
    const ready = v.transcoded_ready || v.processing_status === 'ready';
    if (ready && v.transcoded_url) return v.transcoded_url;
    if (ready && v.transcoded_filename) return stored('playtv-transcoded', v.transcoded_filename);
    return v.video_url || v.transcoded_url || (v.transcoded_filename ? stored('playtv-transcoded', v.transcoded_filename) : v.raw_filename ? stored('playtv-raw', v.raw_filename) : '');
}
function useWidget<T>(rpc: string) {
    const [state, setState] = useState<{ items: T[]; loading: boolean; error: boolean }>({ items: [], loading: true, error: false });
    const [retry, setRetry] = useState(0);
    useEffect(() => { let live = true; void (async () => {
        try { const { data, error } = await db.rpc(rpc); if (error) throw error; if (live) setState({ items: data ?? [], loading: false, error: false }); }
        catch { if (live) setState({ items: [], loading: false, error: true }); }
    })(); return () => { live = false; }; }, [rpc, retry]);
    return { ...state, retry: () => { setState({ items: [], loading: true, error: false }); setRetry(n => n + 1); } };
}
function WidgetState({ loading, error, empty, retry }: { loading: boolean; error: boolean; empty: boolean; retry: () => void }) { return loading ? <p role="status" className="py-4 text-sm text-slate-400">Loading…</p> : error ? <div role="alert" className="py-3 text-sm">Could not load this section. <button className={button} onClick={retry}>Retry</button></div> : empty ? <p className="py-4 text-sm text-slate-400">Nothing published yet.</p> : null; }

export default function Community() {
    const router = useRouter();
    const [user, setUser] = useState<string | null>(null);
    const [category, setCategory] = useState<CommunityCategory | ''>('');
    const [sort, setSort] = useState('newest');
    const [offset, setOffset] = useState(0);
    const [posts, setPosts] = useState<Post[]>([]);
    const [more, setMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const [share, setShare] = useState(false);
    const [report, setReport] = useState<Post | null>(null);
    const [reason, setReason] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const lock = useRef(false);
    const videos = useWidget<Video>('get_community_videos_v1');
    const builders = useWidget<Builder>('get_community_builders_v1');
    const courses = useWidget<Course>('get_community_latest_courses_v1');
    const [video, setVideo] = useState<Video | null>(null);
    useEffect(() => {
        const { data } = db.auth.onAuthStateChange((_event, session) => setUser(session?.user.id ?? null));
        return () => data.subscription.unsubscribe();
    }, []);
    useEffect(() => { let live = true; void (async () => {
        try { const { data, error } = await db.rpc('get_community_feed_v2', { p_category: category || null, p_sort: sort, p_limit: 20, p_offset: offset }); if (error) throw error;
            if (live) { setPosts(data.items); setMore(data.has_more); setLoading(false); }
        } catch { if (live) { setError('Could not load experiences. Please try again.'); setLoading(false); } }
    })(); return () => { live = false; }; }, [category, sort, offset, refresh, user]);
    function auth() { if (user) return true; router.push('/login?returnTo=%2Fcommunity'); return false; }
    function reload() { setLoading(true); setError(''); setRefresh(n => n + 1); }
    async function react(post: Post, reaction: 'UP' | 'DOWN') {
        if (!auth() || lock.current) return;
        lock.current = true; setBusy(post.id); setNotice('');
        try { const { error } = await db.rpc('react_community_post_v1', { p_post_id: post.id, p_reaction: post.own_reaction === reaction ? null : reaction }); if (error) throw error; reload(); }
        catch { setNotice('Reaction could not be saved. Please try again.'); }
        finally { lock.current = false; setBusy(null); }
    }
    async function sendReport() {
        if (!report || lock.current || !reason.trim()) return;
        lock.current = true; setBusy(report.id); setNotice('');
        try { const { error } = await db.rpc('report_community_post_v1', { p_post_id: report.id, p_reason: reason.trim() }); if (error) throw error; setReport(null); setNotice('Thanks. Your report is recorded for review. Repeated reports are recorded only once.'); }
        catch { setNotice('Report could not be saved. Please try again.'); }
        finally { lock.current = false; setBusy(null); }
    }
    return <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 px-3 pb-12 text-white md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)_300px] [&_button]:cursor-pointer [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-emerald-300">
        <aside className={`${glass} self-start`}><h1 className="text-2xl font-semibold">Community</h1><p className="mt-2 text-sm leading-6 text-slate-300">Share experiences. Inspire others.<br />Together we make disc golf better.</p>
            <label className="mt-4 block md:hidden">Topic<select aria-label="Filter community topic" value={category} onChange={e => { setCategory(e.target.value as CommunityCategory | ''); setOffset(0); setLoading(true); setError(''); }} className="mt-2 w-full rounded-lg bg-[#173129] p-3"><option value="">All posts</option>{Object.entries(communityCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <nav aria-label="Community categories" className="my-4 hidden space-y-1 md:block">{[['', 'All posts'], ...Object.entries(communityCategories)].map(([key, label]) => <button key={key} aria-pressed={category === key} onClick={() => { setCategory(key as CommunityCategory | ''); setOffset(0); setLoading(true); setError(''); }} className={`block w-full rounded-lg border px-3 py-3 text-left text-sm ${category === key ? 'border-emerald-400/30 bg-emerald-400/10 font-semibold text-emerald-200' : 'border-transparent text-slate-300 hover:bg-white/5'}`}>{label}</button>)}</nav>
            <button onClick={() => { if (auth()) setShare(true); }} className="mt-4 w-full rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-3 py-3 text-sm font-semibold text-emerald-100">+ Share your experience</button>
        </aside>
        <section className="min-w-0 space-y-5" aria-label="Community feed">
            <section className={glass}><h2 className="font-semibold">Play-TV</h2><p className="mb-3 text-sm text-slate-400">Latest videos from the community</p><WidgetState {...videos} empty={!videos.items.length} />
                <div className="flex gap-3 overflow-x-auto pb-2">{videos.items.map(v => <button key={v.id} onClick={() => setVideo(v)} className="w-32 shrink-0 text-left xl:w-[calc((100%-3rem)/5)] xl:min-w-24"><div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-black/40">{v.thumbnail_url && <img alt="" src={v.thumbnail_url} className="h-full w-full object-cover" loading="lazy" />}<span className="absolute inset-0 flex items-center justify-center text-2xl" aria-hidden="true">▶</span>{!!v.duration_seconds && <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-xs">{Math.floor(v.duration_seconds / 60)}:{String(v.duration_seconds % 60).padStart(2, '0')}</span>}</div><p className="mt-2 line-clamp-2 break-words text-xs">{v.caption || 'Play video'}</p><div className="mt-2 flex items-center gap-1"><Avatar url={v.author_avatar} name={v.author_name} /><span className="min-w-0 truncate text-xs text-slate-300">{v.author_name}</span></div><p className="mt-1 text-xs text-slate-400">{date(v.created_at)}</p></button>)}</div>
            </section>
            <div className="flex gap-2">{['newest', 'helpful'].map(s => <button key={s} aria-pressed={sort === s} onClick={() => { setSort(s); setOffset(0); setLoading(true); setError(''); }} className={`${button} ${sort === s ? 'bg-emerald-400/15 font-semibold text-emerald-200' : ''}`}>{s === 'newest' ? 'Newest' : 'Most helpful'}</button>)}</div>
            {notice && !report && <p role="status" className={glass}>{notice}</p>}
            {loading ? <p role="status" className={glass}>Loading experiences…</p> : error ? <div role="alert" className={glass}>{error} <button className={button} onClick={reload}>Retry</button></div> : <>
                {!posts.length && <p className={glass}>No experiences here yet. Share yours for review.</p>}
                {posts.map(p => <article key={p.id} className={`${glass} [overflow-wrap:anywhere]`}><div className="flex items-center gap-2"><Avatar url={p.author_avatar} name={p.author_name} /><div className="min-w-0 flex-1"><p className="font-semibold">{p.author_name}</p><time className="text-xs text-slate-400" dateTime={p.published_at}>{date(p.published_at)}</time></div><span className="rounded-full border border-emerald-400/20 px-2 py-1 text-xs text-emerald-200">{communityCategories[p.category]}</span></div>
                    {p.context_type === 'course' && p.context_id && p.context_name && <Link className="mt-3 block text-sm text-cyan-200 hover:underline" href={`/courses/${p.context_id}`}>{p.context_name} →</Link>}
                    <h3 className="mt-3 font-semibold">{p.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{p.body}</p><div className="mt-4 flex flex-wrap items-center gap-2">{(['UP', 'DOWN'] as const).map(r => <button key={r} aria-pressed={p.own_reaction === r} disabled={busy !== null} onClick={() => void react(p, r)} className={`${button} ${p.own_reaction === r ? 'bg-emerald-400/15 text-emerald-200' : ''}`}>{r === 'UP' ? '👍 Helpful' : '👎 Not helpful'} {r === 'UP' ? p.up_count : p.down_count}</button>)}<button className={`${button} ml-auto`} onClick={() => { if (auth()) { setReport(p); setReason(''); setNotice(''); } }}>Report</button></div>
                </article>)}
                <div className="flex justify-between"><button className={button} disabled={offset === 0} onClick={() => { setOffset(n => Math.max(0, n - 20)); setLoading(true); }}>Previous</button><span className="py-2 text-sm text-slate-400">Page {offset / 20 + 1}</span><button className={button} disabled={!more || offset >= 10000} onClick={() => { setOffset(n => n + 20); setLoading(true); }}>Next</button></div>
            </>}
        </section>
        <aside className="min-w-0 space-y-5 md:col-start-2 xl:col-start-3"><section className={glass}><h2 className="font-semibold">Top 10 course builders</h2><p className="mt-1 text-xs text-slate-400">Qualified courses · current Foundation season</p><WidgetState {...builders} empty={!builders.items.length} /><ol className="mt-3 space-y-3">{builders.items.map(b => <li key={b.user_id} className={`flex items-center gap-2 rounded-lg p-1 ${b.user_id === user ? 'bg-emerald-400/10 ring-1 ring-emerald-400/30' : ''}`}><span className={`w-5 text-sm ${b.rank === 1 ? 'text-amber-300' : b.rank === 2 ? 'text-slate-200' : b.rank === 3 ? 'text-orange-300' : 'text-slate-400'}`}>{b.rank}</span><Avatar url={b.avatar_url} name={b.display_name} /><span className="min-w-0 flex-1 break-words text-sm">{b.display_name}{b.user_id === user ? ' (you)' : ''}</span><span className="text-sm text-emerald-200" title="Qualifying courses">{b.qualifying_course_count}</span></li>)}</ol></section>
            <section className={glass}><h2 className="font-semibold">Latest 10 built courses</h2><WidgetState {...courses} empty={!courses.items.length} /><div className="mt-3 space-y-4">{courses.items.map(c => <Link href={`/courses/${c.id}`} key={c.id} className="flex gap-2 hover:text-emerald-200">{c.image_url && <img src={c.image_url} alt="" loading="lazy" className="h-12 w-14 shrink-0 rounded-lg object-cover" />}<div className="min-w-0"><p className="break-words text-sm font-semibold">{c.name}</p><p className="break-words text-xs text-slate-400">{c.builder_name}</p><p className="text-xs text-slate-400">{date(c.first_published_at)}</p></div></Link>)}</div><Link href="/courses" className="mt-4 block text-sm text-emerald-200">See all →</Link></section>
        </aside>
        {share && <ShareExperience category={category || 'other'} onClose={() => setShare(false)} />}
        {report && <CommunityModal title="Report experience" onClose={() => { if (!lock.current) setReport(null); }}><form onSubmit={e => { e.preventDefault(); void sendReport(); }} className="space-y-4"><p className="text-sm text-slate-300">Tell the moderators why this experience needs review.</p><label className="block">Reason<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} rows={4} className="mt-2 block w-full rounded-lg border border-white/20 bg-white/5 p-3" /></label>{notice && <p role="alert">{notice}</p>}<button disabled={busy !== null || !reason.trim()} className={button}>Send report</button></form></CommunityModal>}
        {video && <CommunityModal title={video.caption || 'Play-TV'} onClose={() => setVideo(null)}>{playback(video) ? <video controls playsInline autoPlay poster={video.thumbnail_url || undefined} src={playback(video)} className="max-h-[65dvh] w-full" /> : <p>This video is not available for playback yet.</p>}</CommunityModal>}
    </div>;
}
