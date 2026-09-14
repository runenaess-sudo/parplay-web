"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function ApplyDifficultyButton({ courseId, layoutId }: { courseId: string; layoutId: string }) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    async function applySuggestion() {
        if (saving) return;
        setSaving(true);
        setError(null);
        setSaved(false);
        const { error: rpcError } = await supabaseBrowser.rpc("apply_layout_difficulty_suggestion_v1", {
            p_course_id: courseId,
            p_layout_id: layoutId,
        });
        if (rpcError) {
            setError("The suggestion could not be applied. Refresh the page and try again.");
            setSaving(false);
            return;
        }
        setSaved(true);
        setSaving(false);
        router.refresh();
    }

    return <div className="mt-5">
        <button type="button" onClick={applySuggestion} disabled={saving}
            className="rounded-lg bg-blue-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300/50 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "Applying..." : "Apply suggestion"}
        </button>
        {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
        {saved && <p role="status" className="mt-2 text-sm text-emerald-300">Suggestion applied.</p>}
    </div>;
}
