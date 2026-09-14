import Link from "next/link";
import { canOpenCourseEditor } from "@/lib/course-manager-auth";
import { supabaseServer } from "@/lib/supabase-server";
import AddLayoutForm from "./AddLayoutForm";

export default async function AddCourseLayoutPage({ params, searchParams }: {
    params: Promise<{ courseId: string }>;
    searchParams: Promise<{ clubId?: string }>;
}) {
    const { courseId } = await params;
    const { clubId } = await searchParams;
    const query = clubId ? `?clubId=${encodeURIComponent(clubId)}` : "";

    if (!await canOpenCourseEditor(courseId)) {
        return <main className="mx-auto min-h-[70vh] w-full max-w-2xl px-5 py-12 text-white">
            <section className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6">
                <h1 className="text-2xl font-semibold">Add Layout</h1>
                <p className="mt-3 text-gray-300">You do not have access to manage this course.</p>
                <Link href="/club-manager" className="mt-5 inline-block text-sm font-semibold text-blue-300 hover:text-blue-200">Back to Club Manager</Link>
            </section>
        </main>;
    }

    const supabase = await supabaseServer();
    const [{ data: course, error: courseError }, { data: holes, error: holesError }] = await Promise.all([
        supabase.from("courses").select("id,name").eq("id", courseId).maybeSingle(),
        supabase.from("holes")
            .select("id,number,par,distance")
            .eq("course_id", courseId)
            .order("number", { ascending: true }),
    ]);
    if (courseError || holesError || !course) return <main className="mx-auto max-w-2xl px-5 py-12 text-white"><p className="text-gray-300">Course holes could not be loaded.</p></main>;

    return <main className="mx-auto min-h-[70vh] w-full max-w-4xl px-5 py-10 text-white">
        <Link href={`/club-manager/courses/${courseId}/layouts${query}`} className="text-sm font-semibold text-blue-300 transition hover:text-blue-200">← Back to Layouts</Link>
        <section className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-6 shadow-2xl shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">{course.name}</p>
            <h1 className="mt-2 text-3xl font-semibold">Add Layout</h1>
            <p className="mt-3 leading-6 text-gray-300">Create a playing order from this course&apos;s existing holes.</p>
        </section>
        <AddLayoutForm courseId={course.id} holes={holes ?? []} clubId={clubId ?? null} />
    </main>;
}
