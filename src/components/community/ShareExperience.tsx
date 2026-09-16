"use client";
import { useRef, useState, type FormEvent } from 'react';
import { communityCategories, type CommunityCategory } from '@/lib/community-admin';
import { supabaseBrowser } from '@/lib/supabase-browser';
import CommunityModal from './CommunityModal';

export type ShareContext = { category?: CommunityCategory; contextType?: string; contextId?: string; contextName?: string };
export default function ShareExperience({ onClose, category = 'other', contextType, contextId, contextName }: ShareContext & { onClose: () => void }) {
    const [topic, setTopic] = useState(category);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);
    const lock = useRef(false);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (lock.current) return;
        lock.current = true; setBusy(true); setError('');
        try {
            const { error } = await supabaseBrowser.rpc('submit_community_post_v1', {
                p_category: topic, p_title: title.trim(), p_body: body.trim(),
                p_context_type: topic === category ? contextType ?? null : null,
                p_context_id: topic === category ? contextId ?? null : null,
            });
            if (error) throw error;
            setSent(true);
        } catch { setError('Could not submit your experience. Please try again.'); }
        finally { lock.current = false; setBusy(false); }
    }
    return <CommunityModal title="Share your experience" onClose={() => { if (!lock.current) onClose(); }}>
        {sent ? <div role="status"><h3 className="text-lg text-emerald-300">Thanks!</h3><p>Your post has been submitted for review.</p><button className="mt-4 rounded-lg border border-white/20 px-4 py-3" onClick={onClose}>Done</button></div> : <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-slate-300">Share a tip, experience or something you&apos;re proud of. Submissions are reviewed before publication.</p>
            <label className="block">Topic *<select value={topic} onChange={(e) => setTopic(e.target.value as CommunityCategory)} className="mt-1 block w-full rounded-lg border border-white/20 bg-[#152923] p-3">{Object.entries(communityCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            {contextName && topic === category && <p className="text-sm text-emerald-200">{contextName}</p>}
            <label className="block">Title *<input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded-lg border border-white/20 bg-white/5 p-3" /></label>
            <label className="block">Your experience *<textarea required maxLength={500} rows={6} value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 block w-full resize-y rounded-lg border border-white/20 bg-white/5 p-3" /></label>
            <p className="text-right text-sm text-slate-300">{body.length}/500</p>{error && <p role="alert" className="text-orange-300">{error}</p>}
            <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-white/20 px-4 py-3">Cancel</button><button disabled={busy || !title.trim() || !body.trim()} className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 disabled:opacity-50">{busy ? 'Sending…' : 'Send for review'}</button></div>
        </form>}
    </CommunityModal>;
}
