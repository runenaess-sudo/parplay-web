'use client';

import { useEffect, useRef, useState } from 'react';

type State = 'PENDING' | 'QUALIFIED' | 'INVALID' | 'DUPLICATE';
type Entry = {
    contribution_id: string; course_name: string | null; creator_name: string;
    contributed_at: string; season_name: string; state: State;
    eligibility_at_publication: boolean | null; contributor_membership_at_publication: string | null;
    publication_verified: boolean; currently_published: boolean;
    decisions: { previous_state: State; resulting_state: State; decided_at: string }[];
};
const tabs = [['PENDING', 'Pending review'], ['QUALIFIED', 'Qualified / approved'], ['REJECTED', 'Rejected'], ['ALL', 'All']] as const;
const button = 'rounded-xl border border-white/15 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40';
const labels: Record<State, string> = { PENDING: 'Pending review', QUALIFIED: 'Qualified', INVALID: 'Rejected: invalid', DUPLICATE: 'Rejected: duplicate' };

export default function FoundationFame() {
    const [tab, setTab] = useState<string>('PENDING');
    const [offset, setOffset] = useState(0);
    const [revision, setRevision] = useState(0);
    const [items, setItems] = useState<Entry[]>([]);
    const [total, setTotal] = useState(0);
    const [more, setMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const locked = useRef(false);
    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            setLoading(true); setError(null);
            try {
                const response = await fetch(`/api/admin/foundation-fame?tab=${tab}&offset=${offset}`, { cache: 'no-store', signal: controller.signal });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Could not load contributions.');
                if (!controller.signal.aborted) { setItems(data.items); setTotal(data.total); setMore(data.has_more); }
            } catch (reason) {
                if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load contributions.');
            } finally { if (!controller.signal.aborted) setLoading(false); }
        }
        void load();
        return () => controller.abort();
    }, [tab, offset, revision]);

    async function decide(item: Entry, state: Exclude<State, 'PENDING'>) {
        if (locked.current || loading) return;
        if (!window.confirm(`${labels[state]}: ${item.course_name || 'Unknown course'} by ${item.creator_name}?${state === 'QUALIFIED' ? ' Confirm course eligibility and that this is not a duplicate.' : ''} This decision will be recorded in the audit history.`)) return;
        locked.current = true; setBusy(true); setError(null); setNotice(null);
        try {
            const response = await fetch('/api/admin/foundation-fame', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.contribution_id, state }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Decision could not be saved.');
            setNotice(`Decision saved: ${labels[state]}.`);
            setOffset(0); setRevision(value => value + 1);
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Decision could not be saved.'); }
        finally { locked.current = false; setBusy(false); }
    }

    return <main className="min-w-0 space-y-5">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-widest text-blue-300">Contribution review</p>
            <h1 className="mt-2 text-2xl font-semibold">Foundation Fame</h1>
            <p className="mt-2 text-sm text-gray-300">Review published course contributions. Only qualified contributions count toward the course ranking.</p>
            <p className="mt-2 text-sm text-gray-400">A publication excluded under a temporary Admin membership must first be reconciled before it appears here.</p>
        </header>
        <div className="flex flex-wrap gap-2" aria-label="Contribution filters">
            {tabs.map(([value, label]) => <button key={value} disabled={busy} aria-pressed={tab === value} className={`${button} ${tab === value ? 'bg-blue-600' : 'bg-white/5'}`} onClick={() => { setTab(value); setOffset(0); setNotice(null); }}>{label}</button>)}
            <button className={button} disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Refresh</button>
        </div>
        {notice && <p role="status" className="text-emerald-300">{notice}</p>}
        {error && <p role="alert" className="text-red-300">{error}</p>}
        {loading ? <p role="status">Loading contributions…</p> : !error && <>
            <p className="text-sm text-gray-400">{total} matching contributions</p>
            {items.length === 0 && <p className="rounded-xl bg-white/5 p-5 text-gray-300">No contributions in this filter.</p>}
            {items.map(item => <article key={item.contribution_id} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><h2 className="wrap-anywhere text-lg font-semibold">{item.course_name || 'Course unavailable'}</h2><p className="wrap-anywhere text-sm text-gray-300">Original creator: {item.creator_name}</p></div>
                    <span className="rounded-full bg-blue-500/15 px-3 py-1 text-sm text-blue-200">{labels[item.state]}</span>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-gray-400">First publication</dt><dd>{new Date(item.contributed_at).toLocaleString()}</dd></div>
                    <div><dt className="text-gray-400">Foundation season</dt><dd>{item.season_name}</dd></div>
                    <div><dt className="text-gray-400">Eligibility at publication</dt><dd>{item.eligibility_at_publication === true ? 'Eligible' : item.eligibility_at_publication === false ? `Excluded at publication (${item.contributor_membership_at_publication || 'unknown membership'}); contribution available for review` : 'Publication eligibility unavailable'}</dd></div>
                    <div><dt className="text-gray-400">Current contribution status</dt><dd>{!item.publication_verified ? 'First-publication history could not be verified' : item.currently_published ? 'Verified publication · course currently published' : 'Historical contribution · course not currently published'}</dd></div>
                </dl>
                {item.state === 'PENDING' && <div className="flex flex-wrap gap-2">
                    <button className={`${button} bg-emerald-700`} disabled={busy || !item.currently_published || !item.publication_verified} onClick={() => void decide(item, 'QUALIFIED')}>Approve</button>
                    <button className={`${button} bg-red-800`} disabled={busy} onClick={() => void decide(item, 'INVALID')}>Reject: invalid</button>
                    <button className={`${button} bg-red-950`} disabled={busy} onClick={() => void decide(item, 'DUPLICATE')}>Reject: duplicate</button>
                </div>}
                {item.decisions.length > 0 && <details className="text-sm text-gray-300"><summary className="cursor-pointer">Decision history</summary><ul className="mt-2 space-y-1">{item.decisions.map((decision, index) => <li key={index}>{new Date(decision.decided_at).toLocaleString()}: {labels[decision.previous_state]} → {labels[decision.resulting_state]}</li>)}</ul></details>}
            </article>)}
            <div className="flex gap-3"><button className={button} disabled={busy || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>Previous</button><button className={button} disabled={busy || !more} onClick={() => setOffset(value => value + 20)}>Next</button></div>
        </>}
        {busy && <p role="status" className="text-blue-200">Saving decision…</p>}
    </main>;
}
