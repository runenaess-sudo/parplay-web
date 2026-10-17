'use client';
import { useEffect, useRef, useState } from 'react';
import { momentRegistry, type MomentType } from '@/lib/moments/registry.generated';
import MomentPreview from './MomentPreview';

type Control = { type: string; enabled: boolean; revision: number };
const types = Object.keys(momentRegistry) as MomentType[];
const button = 'rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-40';
export default function Moments() {
    const [controls, setControls] = useState<Control[] | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [search, setSearch] = useState('');
    const [negative, setNegative] = useState(false);
    const [challenge, setChallenge] = useState(true);
    const [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState<string | null>(null);
    const locked = useRef(false);
    useEffect(() => {
        const controller = new AbortController();
        setControls(null); setError('');
        void fetch('/api/admin/moments', { cache: 'no-store', signal: controller.signal })
            .then(async response => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Could not load Moment controls.');
                if (!Array.isArray(data) || data.some(c => typeof c.type !== 'string' || typeof c.enabled !== 'boolean' || !Number.isInteger(c.revision)))
                    throw new Error('Invalid Moment controls.');
                if (!controller.signal.aborted) setControls(data);
            }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
        return () => controller.abort();
    }, [revision]);
    async function toggle(control: Control) {
        if (locked.current) return;
        if (!window.confirm(control.enabled
            ? `Deactivate ${control.type} for everyone? It will be hidden on their next online app launch. History is kept.`
            : `Reactivate ${control.type}? Existing undismissed messages can appear again.`)) return;
        locked.current = true; setBusy(control.type); setError(''); setNotice('');
        try {
            const response = await fetch('/api/admin/moments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: control.type, enabled: !control.enabled, revision: control.revision }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not save Moment control.');
            setControls(current => current?.map(c => c.type === control.type ? data : c) ?? null);
            setNotice(`${control.type} ${data.enabled ? 'activated' : 'deactivated'}.`);
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save. Refresh before retrying.'); }
        finally { locked.current = false; setBusy(null); }
    }
    const shown = types.filter(type => type.replaceAll('_', ' ').includes(search.trim().toLowerCase()));
    return <main className="space-y-6">
        <header>
            <p className="text-xs uppercase tracking-widest text-blue-300">App experiences</p>
            <h1 className="mt-2 text-3xl font-semibold">Moments</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Preview all {types.length} Moment types with sample data. Text, colors and icons come from the app. Device fonts and emoji may differ slightly.</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Deactivation hides a type for everyone on their next online app launch. Messages and history are retained. Reactivating can show undismissed messages again.</p>
        </header>
        <div className="flex flex-wrap items-center gap-3">
            <input aria-label="Search Moment types" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Moments…" className="min-w-0 rounded-xl border border-white/20 bg-white/5 px-4 py-3" />
            <button className={button} disabled={busy !== null} onClick={() => setRevision(n => n + 1)}>Refresh status</button>
            <span className="text-sm text-slate-400">{shown.length} types</span>
        </div>
        {error && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">{error} Previews remain available.</p>}
        {notice && <p role="status" className="text-emerald-300">{notice}</p>}
        {!shown.length && <p>No matching Moment types.</p>}
        <div className="grid items-start gap-5 xl:grid-cols-2">
            {shown.map(type => {
                const control = controls?.find(c => c.type === type);
                return <section key={type} className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><h2 className="text-sm font-semibold">{type.replaceAll('_', ' ')}</h2>
                            <p className={`mt-1 text-xs ${control?.enabled ? 'text-emerald-300' : 'text-slate-400'}`}>{control ? control.enabled ? 'Delivery enabled' : 'Deactivated' : 'Status unavailable'}</p>
                            {!momentRegistry[type].automaticTriggerEnabled && <p className="mt-1 text-xs text-amber-200">No automatic trigger</p>}
                        </div>
                        <button className={button} disabled={!control || busy !== null} onClick={() => control && void toggle(control)}>
                            {busy === type ? 'Saving…' : control?.enabled ? 'Deactivate' : 'Activate'}
                        </button>
                    </div>
                    {type === 'weekly_rating_update' && <div className="mt-3 flex gap-2" aria-label="Rating preview">
                        <button className={button} aria-pressed={!negative} onClick={() => setNegative(false)}>Increase +12</button>
                        <button className={button} aria-pressed={negative} onClick={() => setNegative(true)}>Decrease −8</button>
                    </div>}
                    {type === 'course_record_broken' && <label className="mt-3 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={challenge} onChange={e => setChallenge(e.target.checked)} />Show Challenge example</label>}
                    <MomentPreview type={type} negative={type === 'weekly_rating_update' && negative} challenge={challenge} />
                </section>;
            })}
        </div>
    </main>;
}
