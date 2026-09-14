import Link from "next/link";
import { canOpenCourseEditor } from "@/lib/course-manager-auth";
import { supabaseServer } from "@/lib/supabase-server";

export default async function CourseLayoutsPage({ params, searchParams }: {
    params: Promise<{ courseId: string }>;
    searchParams: Promise<{ clubId?: string }>;
}) {
    const { courseId } = await params;
    const { clubId } = await searchParams;
    const managerParams = new URLSearchParams({ courseId });
    if (clubId) managerParams.set("clubId", clubId);
    const childQuery = clubId ? `?clubId=${encodeURIComponent(clubId)}` : "";

    if (!await canOpenCourseEditor(courseId)) {
        return <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-5 py-12 text-white">
            <section className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6">
                <h1 className="text-2xl font-semibold">Layouts</h1>
                <p className="mt-3 text-gray-300">You do not have access to manage this course.</p>
                <Link href="/club-manager" className="mt-5 inline-block text-sm font-semibold text-blue-300 transition hover:text-blue-200">Back to Club Manager</Link>
            </section>
        </main>;
    }

    const supabase = await supabaseServer();
    const [{ data: course, error: courseError }, { data: layouts, error: layoutsError }] = await Promise.all([
        supabase.from("courses").select("id,name,club_id").eq("id", courseId).maybeSingle(),
        supabase.from("course_layouts")
            .select("id,name,description,difficulty,published,hole_count")
            .eq("course_id", courseId)
            .order("created_at", { ascending: true }),
    ]);

    if (courseError || layoutsError || !course) {
        return <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-5 py-12 text-white">
            <p className="text-gray-300">Layouts could not be loaded.</p>
        </main>;
    }

    const layoutIds = (layouts ?? []).map((layout) => layout.id);
    const { data: layoutHoles, error: layoutHolesError } = layoutIds.length > 0
        ? await supabase.from("layout_holes").select("layout_id").in("layout_id", layoutIds)
        : { data: [], error: null };
    if (layoutHolesError) throw layoutHolesError;

    const assignedHoleCounts = new Map<string, number>();
    for (const row of layoutHoles ?? []) {
        assignedHoleCounts.set(row.layout_id, (assignedHoleCounts.get(row.layout_id) ?? 0) + 1);
    }

    return <main className="mx-auto min-h-[70vh] w-full max-w-4xl px-5 py-10 text-white">
        <Link href={`/club-manager?${managerParams.toString()}`} className="text-sm font-semibold text-blue-300 transition hover:text-blue-200">← Back to Club Manager</Link>

        <section className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-6 shadow-2xl shadow-black/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Course management</p>
                    <h1 className="mt-2 text-3xl font-semibold">Layouts</h1>
                    <p className="mt-2 text-gray-300">{course.name}</p>
                </div>
                <Link href={`/club-manager/courses/${courseId}/layouts/new${childQuery}`} className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300/50">+ Add Layout</Link>
            </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold">Course layouts</h2>
                    <p className="mt-1 text-sm text-gray-400">Layouts reuse the course&apos;s holes and define their playing order.</p>
                </div>
                <span className="text-sm text-gray-400">{layouts?.length ?? 0}</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(layouts ?? []).map((layout) => {
                    const assignedCount = assignedHoleCounts.get(layout.id) ?? 0;
                    return <article key={layout.id} className="rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20 hover:bg-white/[0.04]">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="truncate font-semibold text-white">{layout.name || "Unnamed layout"}</h3>
                                {layout.description && <p className="mt-1 line-clamp-2 text-sm text-gray-400">{layout.description}</p>}
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${layout.published ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-gray-300"}`}>{layout.published ? "Published" : "Draft"}</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-300">
                            <span className="rounded-full bg-white/[0.07] px-2.5 py-1">{assignedCount} {assignedCount === 1 ? "hole" : "holes"}</span>
                            {layout.difficulty != null && <span className="rounded-full bg-white/[0.07] px-2.5 py-1">Difficulty {layout.difficulty}</span>}
                        </div>
                        {layout.published
                            ? <p className="mt-4 text-xs text-gray-500">Published layouts are managed through the course publication flow.</p>
                            : <Link href={`/club-manager/courses/${courseId}/layouts/${layout.id}/edit${childQuery}`} className="mt-4 inline-flex rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 transition hover:border-blue-300/50 hover:bg-blue-500/20">Edit layout</Link>}
                    </article>;
                })}
            </div>

            {(layouts ?? []).length === 0 && <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-black/15 px-5 py-8 text-center">
                <p className="font-semibold text-white">No layouts yet</p>
                <p className="mt-2 text-sm text-gray-400">Add a layout to prepare a playing order from this course&apos;s holes.</p>
            </div>}
        </section>
    </main>;
}
