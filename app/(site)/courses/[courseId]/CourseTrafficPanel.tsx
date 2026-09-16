"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useState } from "react";

type Bucket = { hour: number; expected_players: number; expected_sessions: number; traffic_level: number; sample_count: number; confidence: "none" | "low" | "medium" | "high" };
export type CourseTrafficData = { day_of_week: number | null; timezone: string | null; available: boolean; buckets: Bucket[] };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const activityLabel = (level: number) => level < 34 ? "Quiet" : level < 67 ? "Moderate" : "Busy";

export function CourseTrafficPanel({ courseId, initialData }: { courseId: string; initialData: CourseTrafficData | null }) {
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    async function selectDay(day: number) {
        if (loading || data?.day_of_week === day) return;
        setLoading(true); setError(false);
        const result = await supabaseBrowser.rpc("get_course_traffic_v2", { p_course_id: courseId, p_day_of_week: day });
        if (result.error || !result.data) setError(true); else setData(result.data as CourseTrafficData);
        setLoading(false);
    }
    const visible = data?.buckets.filter((bucket) => bucket.hour >= 6 && bucket.hour <= 22) ?? [];
    return <div className="mt-7 border-t border-white/10 pt-5">
        <div className="flex gap-1 overflow-x-auto pb-2" aria-label="Traffic weekday">{DAYS.map((label, day) => <button key={label} type="button" onClick={() => void selectDay(day)} disabled={loading} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${data?.day_of_week === day ? "bg-blue-500 text-white" : "bg-white/[0.07] text-gray-400 hover:bg-white/[0.12] hover:text-white"}`}>{label}</button>)}</div>
        <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs font-semibold text-white/60">Typical activity · {data?.timezone ?? "timezone unavailable"}</p>{loading && <span className="text-xs text-blue-300">Loading…</span>}</div>
        {error ? <p role="alert" className="mt-4 text-sm text-red-300">Historical traffic could not be loaded.</p> : !data?.available ? <p className="mt-4 text-sm text-white/50">Not enough historical activity for this weekday yet.</p> : <div className="mt-5 flex h-20 items-end gap-1" aria-label="Historical hourly course activity">{visible.map((bucket) => <div key={bucket.hour} className="group relative flex min-w-0 flex-1 flex-col items-center justify-end" title={`${bucket.hour}:00 · ${activityLabel(bucket.traffic_level)} · about ${Number(bucket.expected_players).toFixed(1)} players · ${bucket.confidence} confidence · ${bucket.sample_count} weeks observed`}><div className={`w-full rounded-t transition ${bucket.traffic_level < 34 ? "bg-slate-400/60 group-hover:bg-slate-300" : bucket.traffic_level < 67 ? "bg-amber-400/70 group-hover:bg-amber-300" : "bg-rose-400/75 group-hover:bg-rose-300"}`} style={{ height: `${Math.max(5, bucket.traffic_level)}%` }} /><span className="mt-1 text-[9px] text-white/35">{bucket.hour}</span></div>)}</div>}
        <p className="mt-4 text-xs text-white/40">Estimates use completed sessions and actual time spent on the course. Low-sample periods have lower confidence.</p>
    </div>;
}
