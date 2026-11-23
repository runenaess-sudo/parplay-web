"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useState } from "react";

type Bucket = { hour: number; average_sessions: number | null; observed_days: number };
export type CourseTrafficData = {
    day_of_week: number | null; timezone: string | null; available: boolean;
    reason: string; registered_sessions?: number; limited_data?: boolean; buckets: Bucket[];
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const activityLabel = (value: number) => value <= 15 ? "Quiet" : value <= 40 ? "Moderate" : value <= 65 ? "High" : "Busy";
const activityColor = (value: number) => value <= 15 ? "#86EFAC" : value <= 40 ? "#FACC15" : value <= 65 ? "#F59E0B" : "#FB7185";
function trafficValue(bucket: Bucket | undefined): number | null {
    return bucket?.observed_days === 4 && typeof bucket.average_sessions === "number"
        && Number.isFinite(bucket.average_sessions) && bucket.average_sessions >= 0 ? bucket.average_sessions : null;
}
function unavailable(reason?: string) {
    return reason === "no_registered_activity" ? "Ingen registrert aktivitet i perioden"
        : reason === "insufficient_history" ? "For lite historikk for 28-dagersestimat"
        : reason === "missing_timezone" ? "Banens tidssone mangler." : "Historisk aktivitet kunne ikke lastes.";
}

export function CourseTrafficPanel({ courseId, initialData }: { courseId: string; initialData: CourseTrafficData | null }) {
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    async function selectDay(day: number) {
        if (loading || data?.day_of_week === day) return;
        setLoading(true); setError(false);
        try {
            const result = await supabaseBrowser.rpc("get_course_traffic_v3", { p_course_id: courseId, p_day_of_week: day });
            if (result.error || !result.data) setError(true); else setData(result.data as CourseTrafficData);
        } catch { setError(true); } finally { setLoading(false); }
    }
    const visible = Array.from({ length: 17 }, (_, index) => ({ hour: index + 6, value: trafficValue(data?.buckets.find(bucket => bucket.hour === index + 6)) }));
    const maximum = Math.max(1, Math.ceil(Math.max(0, ...visible.map(point => point.value ?? 0))));
    return <div className="mt-7 border-t border-white/10 pt-5">
        <div className="flex gap-1 overflow-x-auto pb-2" aria-label="Traffic weekday">{DAYS.map((label, day) => <button key={label} type="button" onClick={() => void selectDay(day)} disabled={loading} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${data?.day_of_week === day ? "bg-blue-500 text-white" : "bg-white/[0.07] text-gray-400 hover:bg-white/[0.12] hover:text-white"}`}>{label}</button>)}</div>
        <p className="mt-3 text-xs font-semibold text-white/60">Average active sessions - {data?.timezone ?? "timezone unavailable"}{loading && " - Loading..."}</p>
        {error || !data?.available ? <p role={error ? "alert" : "status"} className="mt-4 text-sm text-white/50">{unavailable(error ? undefined : data?.reason)}</p> : <>
            
            <div className="mt-2 flex items-end gap-1" aria-label="Average recorded active sessions by local hour">{visible.map(({hour,value}) => <div key={hour} className="group min-w-0 flex-1 text-center" title={value === null ? hour+":00 - No data" : hour+":00 - "+value.toFixed(1)+" average active sessions - "+activityLabel(value)}>
                <div className="relative h-20 w-full">{value === null ? <span className="absolute inset-x-0 bottom-0 text-xs text-gray-500" aria-label="No data">-</span> : <div className="absolute inset-x-0 bottom-0 rounded-t" style={{height:(value/maximum*100)+"%",backgroundColor:activityColor(value)}} />}</div>
                <span className="mt-1 block text-[9px] text-white/35">{hour}</span>
            </div>)}</div>
            {data.limited_data && <p className="mt-3 text-xs text-gray-400">Begrenset datagrunnlag</p>}
        </>}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400">{[["Quiet",0],["Moderate",16],["High",41],["Busy",66]].map(([label,value])=><span key={label} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{backgroundColor:activityColor(Number(value))}}/>{label}</span>)}<span>No data: -</span></div>
        
    </div>;
}
