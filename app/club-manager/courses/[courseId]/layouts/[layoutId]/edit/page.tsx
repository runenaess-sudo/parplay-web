import Link from "next/link";
import { canOpenCourseEditor } from "@/lib/course-manager-auth";
import { supabaseServer } from "@/lib/supabase-server";
import AddLayoutForm from "../../new/AddLayoutForm";

export default async function EditCourseLayoutPage({ params, searchParams }: {
    params: Promise<{ courseId: string; layoutId: string }>;
    searchParams: Promise<{ clubId?: string }>;
}) {
    const { courseId, layoutId } = await params;
    const { clubId } = await searchParams;
    const query = clubId ? `?clubId=${encodeURIComponent(clubId)}` : "";

    if (!await canOpenCourseEditor(courseId)) {
        return <main className="mx-auto min-h-[70vh] w-full max-w-2xl px-5 py-12 text-white"><section className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6"><h1 className="text-2xl font-semibold">Edit Layout</h1><p className="mt-3 text-gray-300">You do not have access to manage this course.</p><Link href="/club-manager" className="mt-5 inline-block text-sm font-semibold text-blue-300">Back to Club Manager</Link></section></main>;
    }

    const supabase = await supabaseServer();
    const [{ data: course }, { data: layout, error: layoutError }, { data: holes, error: holesError }] = await Promise.all([
        supabase.from("courses").select("id,name").eq("id", courseId).maybeSingle(),
        supabase.from("course_layouts").select("id,name,description,difficulty,published").eq("id", layoutId).eq("course_id", courseId).maybeSingle(),
        supabase.from("holes").select("id,number,par,distance").eq("course_id", courseId).order("number", { ascending: true }),
    ]);

    if (!course || layoutError || holesError || !layout) {
        return <main className="mx-auto min-h-[70vh] w-full max-w-2xl px-5 py-12 text-white"><p className="text-gray-300">Layout could not be loaded for this course.</p></main>;
    }
    const { data: memberships, error: membershipsError } = await supabase
        .from("layout_holes").select("hole_id,order_index,locked")
        .eq("layout_id", layout.id).order("order_index", { ascending: true });
    if (membershipsError) {
        return <main className="mx-auto min-h-[70vh] w-full max-w-2xl px-5 py-12 text-white"><p className="text-gray-300">Layout holes could not be loaded.</p></main>;
    }
    if (layout.published || (memberships ?? []).some((row) => row.locked)) {
        return <main className="mx-auto min-h-[70vh] w-full max-w-2xl px-5 py-12 text-white"><Link href={`/club-manager/courses/${courseId}/layouts${query}`} className="text-sm font-semibold text-blue-300">← Back to Layouts</Link><section className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-6"><h1 className="text-2xl font-semibold">Published layout</h1><p className="mt-3 text-gray-300">This layout is locked by the course publication flow and cannot be edited here.</p></section></main>;
    }

    return <main className="mx-auto min-h-[70vh] w-full max-w-4xl px-5 py-10 text-white">
        <Link href={`/club-manager/courses/${courseId}/layouts${query}`} className="text-sm font-semibold text-blue-300 transition hover:text-blue-200">← Back to Layouts</Link>
        <section className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-6 shadow-2xl shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">{course.name}</p>
            <h1 className="mt-2 text-3xl font-semibold">Edit Layout</h1>
            <p className="mt-3 leading-6 text-gray-300">Update layout details and reorder existing course holes.</p>
        </section>
        <AddLayoutForm courseId={courseId} layoutId={layoutId} holes={holes ?? []} clubId={clubId ?? null} initialLayout={{
            name: layout.name ?? "",
            description: layout.description ?? "",
            difficulty: layout.difficulty ?? 1,
            selectedHoleIds: (memberships ?? []).map((row) => row.hole_id),
        }} />
    </main>;
}
