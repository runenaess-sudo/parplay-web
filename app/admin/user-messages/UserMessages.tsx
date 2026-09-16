'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { communityCategories, communityTabs, type CommunityTab, type ModerationItem } from '@/lib/community-admin';

const button = 'rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed';
function date(value: string | null) { return value ? new Date(value).toLocaleString() : ''; }
function Avatar({ uri, name }: { uri: string | null; name: string }) {
    const [failed, setFailed] = useState(false);
    return uri && !failed
        // Public profile URLs can come from existing external avatar providers.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={uri} alt="" onError={() => setFailed(true)} className="h-10 w-10 shrink-0 rounded-full object-cover" />
        : <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">{name.slice(0, 1).toUpperCase()}</span>;
}

export default function UserMessages() {
    const [tab, setTab] = useState<CommunityTab>('PENDING');
    const [category, setCategory] = useState('');
    const [offset, setOffset] = useState(0);
    const [revision, setRevision] = useState(0);
    const [items, setItems] = useState<ModerationItem[]>([]);
    const [more, setMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const locked = useRef(false);

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            setLoading(true); setError(null); setItems([]); setMore(false);
            try {
                const query = new URLSearchParams({ tab, category: tab === 'REPORTS' ? '' : category, offset: String(offset) });
                const response = await fetch(`/api/admin/user-messages?${query}`, { cache: 'no-store', signal: controller.signal });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Could not load messages.');
                if (!controller.signal.aborted) { setItems(data.items); setMore(data.has_more); }
            } catch (reason) {
                if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load messages.');
            } finally { if (!controller.signal.aborted) setLoading(false); }
        }
        void load();
        return () => controller.abort();
    }, [tab, category, offset, revision]);

    async function moderate(id: string, decision: 'APPROVED' | 'DECLINED') {
        if (locked.current) return;
        if (decision === 'DECLINED' && !window.confirm('Decline this submission? It will not be public.')) return;
        locked.current = true; setBusy(true); setError(null); setNotice(null);
        try {
            const response = await fetch('/api/admin/user-messages', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, decision }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Moderation failed.');
            setNotice(decision === 'APPROVED' ? 'Post approved.' : 'Post declined.');
            setItems(previous => previous.filter(item => item.id !== id));
            setOffset(0); setRevision(value => value + 1);
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Moderation failed.'); }
        finally { locked.current = false; setBusy(false); }
    }

    return <main className="min-w-0 space-y-5">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-widest text-blue-300">Community moderation</p>
            <h1 className="mt-2 text-2xl font-semibold">User Messages</h1>
            <p className="mt-2 text-sm text-gray-300">Review submissions before publication.</p>
        </header>
        <div className="flex flex-wrap gap-2" aria-label="Message queues">
            {communityTabs.map(value => <button key={value} disabled={busy} aria-pressed={tab === value}
                className={`${button} ${tab === value ? 'bg-blue-600' : 'bg-white/5'}`}
                onClick={() => { setTab(value); setOffset(0); setNotice(null); }}>
                {value[0] + value.slice(1).toLowerCase()}
            </button>)}
        </div>
        {tab !== 'REPORTS' && <label className="flex flex-wrap items-center gap-3 text-sm">Category
            <select value={category} disabled={busy} onChange={event => { setCategory(event.target.value); setOffset(0); }} className="max-w-full rounded-xl border border-white/20 bg-gray-900 p-2">
                <option value="">All</option>
                {Object.entries(communityCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
        </label>}
        {tab === 'REPORTS' && <p className="text-sm text-gray-300">Reports are available for investigation. Review/resolution actions are not available yet; reporting does not unpublish a post.</p>}
        {notice && <p role="status" className="text-emerald-300">{notice}</p>}
        {error && <div role="alert" className="text-red-300">{error} <button className={button} disabled={busy} onClick={() => setRevision(value => value + 1)}>Retry loading</button></div>}
        {loading ? <p role="status">Loading messages...</p> : !error && !items.length ? <p className="text-gray-300">{tab === 'PENDING' ? 'No posts waiting for review.' : tab === 'REPORTS' ? 'No Community reports.' : 'No posts in this queue.'}</p> : null}
        {!loading && items.map(item => <article key={item.report_id ?? item.id} className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 [overflow-wrap:anywhere]">
            <div className="flex items-center gap-3">
                <Avatar key={item.author_avatar} uri={item.author_avatar} name={item.author_name} />
                <div className="min-w-0"><h2 className="font-semibold">{item.author_name}</h2><p className="text-xs text-gray-400">Submitted {date(item.submitted_at)}</p></div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-blue-400/10 px-3 py-1 text-blue-200">{communityCategories[item.category]}</span><span className="rounded-full bg-white/10 px-3 py-1">{item.status}</span></div>
            {item.context_id && <p className="text-sm text-gray-300">Context: {item.context_name || item.context_type}
                {item.context_type === 'course' && item.context_name && <Link className="ml-3 text-blue-300 underline" href={`/courses/${item.context_id}`}>View context</Link>}
            </p>}
            <h3 className="font-semibold">{item.title}</h3>
            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-200">{item.body}</p>
            {item.moderated_at && <p className="text-xs text-gray-400">Moderated {date(item.moderated_at)}{item.published_at && ` · Published ${date(item.published_at)}`}</p>}
            {item.report_id && <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm"><p className="text-amber-200">Reported by {item.reporter_name} · {date(item.reported_at)}</p><p className="mt-2 whitespace-pre-wrap">{item.report_reason}</p></div>}
            {tab === 'PENDING' && <div className="flex flex-wrap gap-3">
                <button disabled={busy} onClick={() => void moderate(item.id, 'APPROVED')} className={`${button} bg-emerald-700`}>Approve</button>
                <button disabled={busy} onClick={() => void moderate(item.id, 'DECLINED')} className={`${button} border-red-300/30 text-red-200`}>Decline</button>
            </div>}
        </article>)}
        <div className="flex flex-wrap items-center gap-3">
            <button className={button} disabled={busy || loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>Previous</button>
            <span className="text-sm text-gray-400">Page {offset / 20 + 1}</span>
            <button className={button} disabled={busy || loading || !more || offset >= 10000} onClick={() => setOffset(value => value + 20)}>Next</button>
        </div>
    </main>;
}
