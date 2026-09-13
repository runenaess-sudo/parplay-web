"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useState } from "react";

export type LeaderboardRow = { rank: number; username: string; score: number };
export type LeaderboardData = { rows: LeaderboardRow[]; has_more: boolean; my_position: LeaderboardRow | null };
type Period = "day" | "week" | "year" | "total";

const PAGE_SIZE = 20;
const MAX_ROWS = 100;
const periods: Array<{ value: Period; label: string }> = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "year", label: "Year" },
    { value: "total", label: "Total" },
];
const emptyData = (): LeaderboardData => ({ rows: [], has_more: false, my_position: null });

export function CourseLeaderboard({ courseId, initialData, initialError = false }: {
    courseId: string;
    initialData: LeaderboardData;
    initialError?: boolean;
}) {
    const [period, setPeriod] = useState<Period>("total");
    const [data, setData] = useState(initialData);
    const [pending, setPending] = useState<"period" | "more" | null>(null);
    const [error, setError] = useState(initialError);

    async function fetchPage(nextPeriod: Period, offset: number) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        return supabaseBrowser.rpc("get_public_course_leaderboard_v1", {
            p_course_id: courseId, p_period: nextPeriod, p_timezone: timezone,
            p_offset: offset, p_limit: PAGE_SIZE,
        });
    }

    async function selectPeriod(nextPeriod: Period) {
        if (nextPeriod === period || pending) return;
        setPeriod(nextPeriod);
        setPending("period");
        setError(false);
        const result = await fetchPage(nextPeriod, 0);
        if (result.error) {
            setData(emptyData());
            setError(true);
        } else setData((result.data ?? emptyData()) as LeaderboardData);
        setPending(null);
    }

    async function seeMore() {
        if (pending || !data.has_more || data.rows.length >= MAX_ROWS) return;
        setPending("more");
        setError(false);
        const result = await fetchPage(period, data.rows.length);
        if (result.error) setError(true);
        else {
            const next = (result.data ?? emptyData()) as LeaderboardData;
            setData((current) => ({
                rows: [...current.rows, ...next.rows].slice(0, MAX_ROWS),
                has_more: next.has_more,
                my_position: next.my_position,
            }));
        }
        setPending(null);
    }

    const myPositionIsLoaded = data.my_position != null
        && data.rows.some((row) => row.rank === data.my_position?.rank);
    const showPinnedPosition = data.my_position != null && !myPositionIsLoaded;

    return <>
        <div className="mb-4 grid grid-cols-4 rounded-xl bg-white/[0.05] p-1" aria-label="Leaderboard period">
            {periods.map((item) => <button key={item.value} type="button"
                onClick={() => void selectPeriod(item.value)} disabled={pending !== null}
                className={`rounded-lg px-2 py-2 text-sm font-semibold transition disabled:cursor-wait ${period === item.value ? "bg-blue-600 text-white shadow" : "text-white/55 hover:text-white"}`}>
                {item.label}
            </button>)}
        </div>
        {pending === "period" ? <div className="rounded-2xl bg-white/[0.04] p-6 text-sm text-gray-400">Loading leaderboard...</div>
            : error && data.rows.length === 0 ? <div className="rounded-2xl bg-white/[0.04] p-6 text-sm text-red-300">Unable to load leaderboard.</div>
                : data.rows.length > 0 || showPinnedPosition ? <div className="overflow-hidden rounded-2xl bg-white/[0.045]">
                    {data.rows.map((leader) => <LeaderboardEntry key={`${leader.rank}-${leader.username}`} leader={leader} />)}
                    {showPinnedPosition && data.my_position && <div className="sticky bottom-0 flex items-center gap-4 border-t border-blue-300/30 bg-blue-500/15 px-5 py-4 backdrop-blur-md">
                        <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-blue-400/20 px-2 text-sm font-black text-blue-200">#{data.my_position.rank}</span>
                        <span className="text-xs font-black uppercase tracking-[0.16em] text-blue-200">You</span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-white">@{data.my_position.username}</span>
                        <span className="text-lg font-black text-blue-300">{data.my_position.score}</span>
                    </div>}
                    {error && <p className="border-t border-white/10 px-5 py-3 text-sm text-red-300">Unable to load more results.</p>}
                    {data.has_more && data.rows.length < MAX_ROWS && <div className="border-t border-white/10 p-3 text-center">
                        <button type="button" onClick={() => void seeMore()} disabled={pending !== null}
                            className="rounded-full bg-white/10 px-5 py-2 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60">
                            {pending === "more" ? "Loading..." : "See more"}
                        </button>
                    </div>}
                </div> : <div className="rounded-2xl bg-white/[0.04] p-6 text-sm text-gray-400">No leaderboard results yet</div>}
    </>;
}

function LeaderboardEntry({ leader }: { leader: LeaderboardRow }) {
    return <div className="flex items-center gap-4 border-b border-white/10 px-5 py-4 last:border-0">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${leader.rank === 1 ? "bg-amber-400 text-black" : leader.rank === 2 ? "bg-slate-300 text-slate-900" : leader.rank === 3 ? "bg-amber-700 text-white" : "bg-white/10 text-white"}`}>{leader.rank}</span>
        <span className="min-w-0 flex-1 truncate font-semibold text-white">@{leader.username}</span>
        <span className="text-lg font-black text-blue-300">{leader.score}</span>
    </div>;
}
