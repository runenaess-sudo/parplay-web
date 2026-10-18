'use client';
import { useEffect, useRef, useState } from 'react';
import { copyDiagnose, copyOutbox, diagnosesChanged, type DiagnoseRow, type DiagnoseDetail, type ReviewStatus, type ScoreMap } from '@/lib/diagnoses';

const button = 'rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-40';
const statusLabel = (status: ReviewStatus) => status === 'Resolved' ? 'Finished' : status;
type Cursor = { before: string; before_id: string };
function Scores({ title, scores }: { title: string; scores: ScoreMap }) {
    return <section className="rounded-xl border border-white/10 bg-black/20 p-4">
        <h3 className="mb-3 font-semibold">{title}</h3>
        {!Object.keys(scores).length && <p className="text-gray-400">No recorded scores in this snapshot.</p>}
        {Object.entries(scores).map(([player, holes]) => <div key={player} className="mb-3">
            <p className="break-all text-xs text-gray-400">{player}</p>
            <div className="mt-2 flex flex-wrap gap-2">{Object.entries(holes).sort(([a], [b]) => Number(a) - Number(b)).map(([hole, cell]) =>
                <span key={hole} className="rounded bg-white/5 px-2 py-1 text-sm">H{hole}: {cell.score}</span>)}</div>
        </div>)}
    </section>;
}
export default function Diagnoses() {
    const [rows, setRows] = useState<DiagnoseRow[]>([]), [loading, setLoading] = useState(true);
    const [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [view, setView] = useState<'new' | 'finished'>('new');
    const [cursors, setCursors] = useState<(Cursor | null)[]>([null]);
    const [selected, setSelected] = useState<string | null>(null), [detail, setDetail] = useState<DiagnoseDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
    const locked = useRef(false);
    const cursor = cursors[cursors.length - 1];
    useEffect(() => {
        const controller = new AbortController();
        const query = '?' + new URLSearchParams({ ...cursor, view });
        void fetch('/api/admin/diagnoses' + query, { cache: 'no-store', signal: controller.signal }).then(async response => {
            const data = await response.json();
            if (!response.ok) throw Error(data.error);
            if (!controller.signal.aborted) setRows(data.rows);
        }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [cursor, revision, view]);
    useEffect(() => {
        const controller = new AbortController();
        if (!selected) return;
        void fetch('/api/admin/diagnoses?id=' + encodeURIComponent(selected), { cache: 'no-store', signal: controller.signal }).then(async response => {
            const data = await response.json(); if (!response.ok) throw Error(data.error);
            if (!controller.signal.aborted) setDetail(data);
        }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
            .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
        return () => controller.abort();
    }, [selected, revision]);
    function refresh() {
        setLoading(true); setError('');
        if (selected) { setDetail(null); setDetailLoading(true); }
        setRevision(r => r + 1);
        window.dispatchEvent(new Event(diagnosesChanged));
    }
    function open(id: string | null) {
        setDetail(null); setDetailLoading(id !== null); setError(''); setNotice(''); setSelected(id);
    }
    async function review(status: ReviewStatus) {
        if (!detail || locked.current) return;
        locked.current = true; setBusy(true); setError('');
        try {
            const response = await fetch('/api/admin/diagnoses', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: detail.id, status, expected_status: detail.status }) });
            if (!response.ok) { const data = await response.json(); throw Error(data.error); }
            open(null); setCursors([null]);
            setLoading(true); setRevision(r => r + 1);
            window.dispatchEvent(new Event(diagnosesChanged));
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update report.'); }
        finally { locked.current = false; setBusy(false); }
    }
    async function copy() {
        if (!detail) return;
        try { await navigator.clipboard.writeText(copyDiagnose(detail)); setNotice('Report copied for Codex.'); }
        catch { setNotice('Could not copy. Please allow clipboard access and try again.'); }
    }
    return <main className="space-y-5 rounded-2xl border border-white/10 bg-[#202328] p-5 text-white shadow-xl">
        <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Diagnoses</h1>
            <button className={button} disabled={busy || loading || detailLoading} onClick={refresh}>Refresh</button></div>
        <p className="text-sm text-gray-400">Diagnostic snapshots only. Reports expire after 30 days. Review actions never change scores.</p>
        <nav aria-label="Diagnosis status" className="flex gap-2">{(['new', 'finished'] as const).map(tab =>
            <button key={tab} aria-pressed={view === tab} disabled={busy} className={button + (view === tab ? ' bg-orange-500/20 border-orange-400' : '')}
                onClick={() => { if (view === tab && !selected) return; open(null); setRows([]); setCursors([null]); setLoading(true); setView(tab); setRevision(r => r + 1); }}>
                {tab === 'new' ? 'New' : 'Finished'}
            </button>)}</nav>
        {error && <p role="alert" className="text-orange-300">{error}</p>}
        {notice && <p role="status" className="text-blue-200">{notice}</p>}
        {selected ? <>
            <button className={button} disabled={busy} onClick={() => open(null)}>Back to reports</button>
            {detailLoading && <p>Loading report…</p>}
            {detail && <>
                <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{detail.payload.display_name}</h2>
                    <span className="rounded-full bg-orange-500/15 px-3 py-1 text-orange-200">{statusLabel(detail.status)}</span>
                    <button className={button} onClick={() => void copy()} aria-label="Copy diagnostic report for Codex">⧉ Copy for Codex</button></div>
                <dl className="grid gap-2 break-all text-sm text-gray-300 md:grid-cols-2">
                    {Object.entries({ Player: detail.payload.submitter_id, Round: detail.payload.round_id, Mode: detail.payload.mode,
                        Course: detail.payload.course_id, Layout: detail.payload.layout_id, Submitted: detail.created_at,
                        'Local snapshot': detail.payload.client_captured_at, 'Server snapshot': detail.payload.server_captured_at,
                        App: `${detail.payload.app_version} (${detail.payload.app_build})`, Device: `${detail.payload.platform} ${detail.payload.os_version}`,
                        Expires: detail.expires_at }).map(([key, value]) => <div key={key}><dt className="text-gray-500">{key}</dt><dd>{value}</dd></div>)}
                </dl>
                <p className="rounded-lg bg-orange-500/10 p-3 text-sm text-orange-200">{detail.payload.sync_state}<br />
                    Registered scores differ: {detail.payload.scores_differ == null ? 'Not compared' : detail.payload.scores_differ ? 'Yes' : 'No'}. Guest scores differ: {detail.payload.guest_scores_differ == null ? 'Not compared' : detail.payload.guest_scores_differ ? 'Yes' : 'No'}.<br />
                    Error: {detail.payload.error.reason ?? detail.payload.error.code ?? 'Unknown'}. Raw error text omitted; this is the last available outbox error and may not belong to this round.</p>
                {detail.payload.mode !== 'outbox' && <div className="grid gap-4 lg:grid-cols-2">
                    <Scores title="Locally recorded — not server confirmation" scores={detail.payload.local_scores} />
                    <Scores title="Server confirmed at submission" scores={detail.payload.server_scores} />
                    <Scores title="Guest scores in local snapshot" scores={detail.payload.guest_scores} />
                    <Scores title="Guest scores confirmed by server" scores={detail.payload.server_guest_scores} />
                </div>}
                {detail.payload.outbox && <section className="space-y-3">
                    <h3 className="font-semibold">Full score outbox ({detail.payload.outbox.total_pending} pending)</h3>
                    <p className="text-sm text-orange-200">First queued operation: {detail.payload.outbox.blocking_operation?.id ?? 'None'}. Later operations wait behind this head, even across game modes. The last error is not tied to a specific operation and may be unavailable after an app restart.</p>
                    <pre className="max-h-96 overflow-auto rounded-xl bg-black/30 p-4 text-xs">{JSON.stringify(copyOutbox(detail.payload.outbox), null, 2)}</pre>
                </section>}
                <h3 className="font-semibold">Pending synchronization — failed or waiting, not confirmed saved</h3>
                <pre className="max-h-96 overflow-auto rounded-xl bg-black/30 p-4 text-xs">{JSON.stringify(detail.payload.operations, null, 2)}</pre>
                <div className="flex flex-wrap gap-2">{(['New', 'Resolved'] as const).map(status =>
                    <button key={status} className={button} disabled={busy || status === detail.status} onClick={() => void review(status)}>{statusLabel(status)}</button>)}</div>
                <h3 className="font-semibold">Review history</h3>
                {detail.review_history.map(item => <p className="break-all text-sm text-gray-400" key={item.id}>{item.changed_at} — {item.status} — {item.admin_id}</p>)}
            </>}
        </> : <>
            {loading ? <p>Loading reports…</p> : rows.length === 0 ? <p className="text-gray-400">No reports on this page.</p> :
                <ul className="space-y-2">{rows.map(row => <li key={row.id}><button onClick={() => open(row.id)} className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10">
                    <div className="flex justify-between gap-3"><strong>{row.display_name}</strong><span className="text-orange-200">{statusLabel(row.status)}</span></div>
                    <p className="mt-1 text-sm text-gray-400">{row.mode} · {row.live_id?.slice(0, 8) ?? 'All rounds'} · {new Date(row.created_at).toLocaleString()}</p>
                    <p className="mt-1 text-sm text-gray-300">{row.summary}</p>
                </button></li>)}</ul>}
            <div className="flex gap-2"><button className={button} disabled={loading || cursors.length === 1} onClick={() => { setLoading(true); setError(''); setCursors(c => c.slice(0, -1)); }}>Previous</button>
                <button className={button} disabled={loading || rows.length < 25} onClick={() => { const last = rows[rows.length - 1]; if (last) { setLoading(true); setError(''); setCursors(c => [...c, { before: last.created_at, before_id: last.id }]); } }}>Next</button></div>
        </>}
    </main>;
}
