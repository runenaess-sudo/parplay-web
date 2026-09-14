import Link from "next/link";
import { canOpenCourseEditor } from "@/lib/course-manager-auth";
import { supabaseServer } from "@/lib/supabase-server";
import { DIFFICULTY_READY_ROUNDS, difficultyLabel, evaluateLayoutDifficulty } from "@/lib/layout-difficulty";
import ApplyDifficultyButton from "./ApplyDifficultyButton";

type RatingStats = {
    layout_id: string;
    rounds_count: number | null;
    avg_diff_to_par: number | null;
    pct_under_par: number | null;
    pct_over_par: number | null;
    pct_within_par: number | null;
    locked: boolean | null;
};

export default async function CourseDifficultyPage({ params, searchParams }: {
    params: Promise<{ courseId: string }>;
    searchParams: Promise<{ clubId?: string }>;
}) {
    const { courseId } = await params;
    const { clubId } = await searchParams;
    const managerParams = new URLSearchParams({ courseId });
    if (clubId) managerParams.set("clubId", clubId);

    if (!await canOpenCourseEditor(courseId)) {
        return <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-5 py-12 text-white"><section className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6"><h1 className="text-2xl font-semibold">Difficulty</h1><p className="mt-3 text-gray-300">You do not have access to manage this course.</p><Link href="/club-manager" className="mt-5 inline-block text-sm font-semibold text-blue-300 hover:text-blue-200">Back to Club Manager</Link></section></main>;
    }

    const supabase = await supabaseServer();
    const [{ data: course, error: courseError }, { data: layouts, error: layoutsError }] = await Promise.all([
        supabase.from("courses").select("id,name").eq("id", courseId).maybeSingle(),
        supabase.from("course_layouts").select("id,name,difficulty,par_rating,published").eq("course_id", courseId).order("created_at"),
    ]);
    if (courseError || layoutsError || !course) return <main className="mx-auto max-w-3xl px-5 py-12 text-white"><p className="text-gray-300">Difficulty data could not be loaded.</p></main>;

    const layoutIds = (layouts ?? []).map((layout) => layout.id);
    const [{ data: statsRows, error: statsError }, { data: memberships, error: membershipsError }] = layoutIds.length
        ? await Promise.all([
            supabase.from("layout_rating_stats").select("layout_id,rounds_count,avg_diff_to_par,pct_under_par,pct_over_par,pct_within_par,locked").in("layout_id", layoutIds),
            supabase.from("layout_holes").select("layout_id,locked").in("layout_id", layoutIds).eq("locked", true),
        ])
        : [{ data: [], error: null }, { data: [], error: null }];
    if (statsError || membershipsError) return <main className="mx-auto max-w-3xl px-5 py-12 text-white"><p className="text-gray-300">Layout rating statistics could not be loaded.</p></main>;

    const statsByLayout = new Map(((statsRows ?? []) as RatingStats[]).map((row) => [row.layout_id, row]));
    const membershipLocked = new Set((memberships ?? []).map((row) => row.layout_id));

    return <main className="mx-auto min-h-[70vh] w-full max-w-5xl px-5 py-10 text-white">
        <Link href={`/club-manager?${managerParams.toString()}`} className="text-sm font-semibold text-blue-300 transition hover:text-blue-200">← Back to Club Manager</Link>
        <section className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-6 shadow-2xl shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Course management</p>
            <h1 className="mt-2 text-3xl font-semibold">Difficulty</h1>
            <p className="mt-2 text-gray-300">{course.name}</p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">Per-layout analysis based on completed rounds. Suggestions become ready after {DIFFICULTY_READY_ROUNDS} rounds.</p>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {(layouts ?? []).map((layout) => {
                const stats = statsByLayout.get(layout.id);
                const rounds = stats?.rounds_count ?? 0;
                const locked = Boolean(layout.published || stats?.locked || membershipLocked.has(layout.id));
                const ready = Boolean(stats && rounds >= DIFFICULTY_READY_ROUNDS);
                const analysis = stats ? evaluateLayoutDifficulty({
                    roundsCount: rounds,
                    avgDiffToPar: stats.avg_diff_to_par ?? 0,
                    pctUnderPar: stats.pct_under_par ?? 0,
                    pctOverPar: stats.pct_over_par ?? 0,
                    pctWithinPar: stats.pct_within_par ?? 0,
                }) : null;
                const readiness = locked ? "Read-only" : ready ? "Ready" : stats ? `${DIFFICULTY_READY_ROUNDS - rounds} rounds remaining` : "No rating data";

                return <article key={layout.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10">
                    <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{layout.name || "Unnamed layout"}</h2><p className="mt-1 text-xs text-gray-500">{rounds} completed rounds</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${locked ? "bg-amber-500/15 text-amber-200" : ready ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-gray-300"}`}>{readiness}</span></div>
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Metric label="Current" value={`${layout.difficulty ?? "–"} · ${difficultyLabel(layout.difficulty)}`} />
                        <Metric label="Current rating" value={String(layout.par_rating ?? "–")} />
                        <Metric label="Suggested" value={analysis ? `${analysis.suggestedDifficulty} · ${difficultyLabel(analysis.suggestedDifficulty)}` : "–"} />
                        <Metric label="Suggested rating" value={analysis ? String(analysis.suggestedParRating) : "–"} />
                    </div>
                    {analysis && <>
                        <div className="mt-5"><div className="flex justify-between text-xs text-gray-400"><span>Difficulty score</span><span>{analysis.score.toFixed(1)} / 100</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-blue-500" style={{ width: `${analysis.score}%` }} /></div></div>
                        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-4">
                            <Stat label="Avg. to par" value={formatSigned(stats?.avg_diff_to_par)} />
                            <Stat label="Under par" value={formatPercent(stats?.pct_under_par)} />
                            <Stat label="Within par" value={formatPercent(stats?.pct_within_par)} />
                            <Stat label="Over par" value={formatPercent(stats?.pct_over_par)} />
                        </div>
                    </>}
                    {!analysis && <p className="mt-5 rounded-xl border border-dashed border-white/15 bg-black/15 p-4 text-sm text-gray-400">No completed-round analysis is available for this layout yet.</p>}
                    {locked ? <p className="mt-5 text-xs leading-5 text-amber-200/80">Published or locked layouts are read-only. Difficulty and par rating cannot be changed here.</p>
                        : ready ? <ApplyDifficultyButton courseId={courseId} layoutId={layout.id} />
                            : <p className="mt-5 text-xs leading-5 text-gray-500">Apply becomes available when the layout reaches {DIFFICULTY_READY_ROUNDS} completed rounds.</p>}
                </article>;
            })}
        </section>
        {(layouts ?? []).length === 0 && <section className="mt-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center"><h2 className="font-semibold">No layouts yet</h2><p className="mt-2 text-sm text-gray-400">Create a layout before difficulty can be analysed.</p></section>}
    </main>;
}

function Metric({ label, value }: { label: string; value: string }) {
    return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p><p className="mt-1 text-sm font-semibold text-white">{value}</p></div>;
}
function Stat({ label, value }: { label: string; value: string }) {
    return <div><p className="text-xs text-gray-500">{label}</p><p className="mt-1 font-semibold text-gray-200">{value}</p></div>;
}
function formatSigned(value: number | null | undefined) {
    if (value == null) return "–";
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}
function formatPercent(value: number | null | undefined) {
    return value == null ? "–" : `${Math.round(value * 100)}%`;
}
