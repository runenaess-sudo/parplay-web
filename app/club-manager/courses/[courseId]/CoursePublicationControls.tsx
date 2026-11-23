"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function CoursePublicationControls({ courseId, published, ready, missing }: {
    courseId: string; published: boolean; ready: boolean; missing: string[];
}) {
    const router = useRouter();
    const busy = useRef(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    async function changeVisibility() {
        if (busy.current) return;
        busy.current = true; setSaving(true); setError("");
        try {
            // Existing RPCs remain authoritative for access, requirements and rewards.
            const result = await supabaseBrowser.rpc(published ? "unpublish_course_v1" : "publish_course_v1", { p_course_id: courseId });
            if (result.error) throw result.error;
            router.refresh();
        } catch (cause) {
            const failure = cause as { code?: string; message?: string };
            setError([failure?.code, failure?.message || "Course visibility could not be updated."].filter(Boolean).join(": "));
        } finally { busy.current = false; setSaving(false); }
    }
    return <div className="space-y-2">
        <button type="button" disabled={saving || (!published && !ready)} onClick={() => void changeVisibility()}
            className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Saving..." : published ? "Unpublish Course" : "Publish Course"}
        </button>
        {!published && missing.length > 0 && <ul className="max-w-lg space-y-1 text-sm text-amber-200">{missing.map(item => <li key={item}>{item}</li>)}</ul>}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>;
}
