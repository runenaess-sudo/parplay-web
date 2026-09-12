"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useState } from "react";

export type LeaderboardRow = { rank: number; username: string; score: number };
type Period = "day" | "week" | "year" | "total";

const periods: Array<{ value: Period; label: string }> = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "year", label: "Year" },
    { value: "total", label: "Total" },
];

export function CourseLeaderboard({ courseId, initialRows }: {
    courseId: string;
    initialRows: LeaderboardRow[];
}) {
    const [period, setPeriod] = useState<Period>("total");
    const [rows, setRows] = useState(initialRows);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    async function selectPeriod(nextPeriod: Period) {
        if (nextPeriod === period || loading) return;
        setPeriod(nextPeriod);
        setLoading(true);
        setError(false);
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const result = await supabaseBrowser.rpc("get_public_course_leaderboard_v1", {
            p_course_id: courseId,
            p_period: nextPeriod,
            p_timezone: timezone,
            p_limit: 5,
        });
        if (result.error) {
            setError(true);
        } else {
            setRows((result.data ?? []) as LeaderboardRow[]);
        }
        setLoading(false);
    }

    return <>
        <div className="mb-4 grid grid-cols-4 rounded-xl bg-white/[0.05] p-1" aria-label="Leaderboard period">
            {periods.map((item) => <button key={item.value} type="button"
                onClick={() => void selectPeriod(item.value)}
                className={`rounded-lg px-2 py-2 text-sm font-semibold transition ${period === item.value ? "bg-blue-600 text-white shadow" : "text-white/55 hover:text-white"}`}>
                {item.label}
            </button>)}
        </div>
        {loading ? <div className="rounded-2xl bg-white/[0.04] p-6 text-sm text-gray-400">Loading leaderboard...</div>
            : error ? <div className="rounded-2xl bg-white/[0.04] p-6 text-sm text-red-300">Unable to load leaderboard.</div>
                : rows.length > 0 ? <div className="overflow-hidden rounded-2xl bg-white/[0.045]">
                    {rows.map((leader) => <div key={`${leader.rank}-${leader.username}`} className="flex items-center gap-4 border-b border-white/10 px-5 py-4 last:border-0">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${leader.rank === 1 ? "bg-amber-400 text-black" : leader.rank === 2 ? "bg-slate-300 text-slate-900" : leader.rank === 3 ? "bg-amber-700 text-white" : "bg-white/10 text-white"}`}>{leader.rank}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-white">@{leader.username}</span>
                        <span className="text-lg font-black text-blue-300">{leader.score}</span>
                    </div>)}
                </div> : <div className="rounded-2xl bg-white/[0.04] p-6 text-sm text-gray-400">No leaderboard results yet</div>}
    </>;
}
