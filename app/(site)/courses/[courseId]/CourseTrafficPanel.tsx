"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useState } from "react";

type Bucket = { hour: number; expected_players: number; expected_sessions: number; traffic_level: number; sample_count: number; confidence: "none" | "low" | "medium" | "high" };
export type CourseTrafficData = { day_of_week: number | null; timezone: string | null; available: boolean; buckets: Bucket[] };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const activityLabel = (level: number) => level <= 15 ? "Quiet" : level <= 40 ? "Moderate" : level <= 65 ? "High" : "Busy";
const activityColor = (level: number) => level <= 15 ? "#86EFAC" : level <= 40 ? "#FACC15" : level <= 65 ? "#F59E0B" : "#FB7185";
function trafficValue(bucket: Bucket | undefined): number | null {
    return bucket && bucket.sample_count > 0 && bucket.confidence !== "none" && typeof bucket.traffic_level === "number"
        && Number.isFinite(bucket.traffic_level) && bucket.traffic_level >= 0 && bucket.traffic_level <= 100 ? bucket.traffic_level : null;
}

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
    const visible = Array.from({ length: 17 }, (_, index) => ({ hour: index + 6, bucket: data?.buckets.find(bucket => bucket.hour === index + 6) }));
    return <div className="mt-7 border-t border-white/10 pt-5">
        <div className="flex gap-1 overflow-x-auto pb-2" aria-label="Traffic weekday">{DAYS.map((label, day) => <button key={label} type="button" onClick={() => void selectDay(day)} disabled={loading} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${data?.day_of_week === day ? "bg-blue-500 text-white" : "bg-white/[0.07] text-gray-400 hover:bg-white/[0.12] hover:text-white"}`}>{label}</button>)}</div>
        <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs font-semibold text-white/60">Typical activity · {data?.timezone ?? "timezone unavailable"}</p>{loading && <span className="text-xs text-blue-300">Loading…</span>}</div>
        {error ? <p role="alert" className="mt-4 text-sm text-red-300">Historical traffic could not be loaded.</p> : !data?.available ? <p className="mt-4 text-sm text-white/50">Not enough historical activity for this weekday yet.</p> : <div className="mt-5 flex items-end gap-1" aria-label="Historical hourly course activity">{visible.map(({hour,bucket}) => {
            const level = trafficValue(bucket);
            return <div key={hour} className="group min-w-0 flex-1 text-center" title={level === null ? hour+":00 - No data" : hour+":00 - "+activityLabel(level)+" - about "+Number(bucket!.expected_players).toFixed(1)+" players - "+bucket!.confidence+" confidence - "+bucket!.sample_count+" observations"}>
                <div className="relative h-20 w-full">{level === null ? <span className="absolute inset-x-0 bottom-0 text-xs text-gray-500" aria-label="No data">-</span> : <div className="absolute inset-x-0 bottom-0 rounded-t" style={{height:level+"%",backgroundColor:activityColor(level)}} />}</div>
                <span className="mt-1 block text-[9px] text-white/35">{hour}</span>
            </div>;
        })}</div>}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400">{[["Quiet",0],["Moderate",16],["High",41],["Busy",66]].map(([label,level])=><span key={label} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{backgroundColor:activityColor(Number(level))}}/>{label}</span>)}<span>No data: -</span></div>
        <p className="mt-4 text-xs text-white/40">Estimates use completed sessions and actual time spent on the course. Low-sample periods have lower confidence.</p>
    </div>;
}
