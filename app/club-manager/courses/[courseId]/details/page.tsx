import Link from "next/link";
import { canOpenCourseEditor } from "@/lib/course-manager-auth";
import { supabaseServer } from "@/lib/supabase-server";
import CourseDetailsForm from "./CourseDetailsForm";

export default async function CourseDetailsPage({ params, searchParams }: {
    params: Promise<{ courseId: string }>;
    searchParams: Promise<{ clubId?: string }>;
}) {
    const { courseId } = await params;
    const { clubId } = await searchParams;
    const returnParams = new URLSearchParams({ courseId });
    if (clubId) returnParams.set("clubId", clubId);

    if (!await canOpenCourseEditor(courseId)) {
        return <main className="mx-auto min-h-[70vh] w-full max-w-2xl px-5 py-12 text-white">
            <section className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6">
                <h1 className="text-2xl font-semibold">Course Details</h1>
                <p className="mt-3 text-gray-300">You do not have access to manage this course.</p>
                <Link href="/club-manager" className="mt-5 inline-block text-sm font-semibold text-blue-300 hover:text-blue-200">Back to Club Manager</Link>
            </section>
        </main>;
    }

    const supabase = await supabaseServer();
    const { data: course, error } = await
      supabase
        .from("courses")
        .select("id,name,location,description,timezone,is_published,club_id")
        .eq("id", courseId)
        .maybeSingle();
    if (error || !course) {
        return <main className="mx-auto min-h-[70vh] w-full max-w-2xl px-5 py-12 text-white">
            <p className="text-gray-300">Course details could not be loaded.</p>
        </main>;
    }

    const club = course.club_id
        ? (await supabase.from("clubs").select("name").eq("id", course.club_id).maybeSingle()).data
        : null;

    return <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-5 py-10 text-white">
        <Link href={`/club-manager?${returnParams.toString()}`} className="text-sm font-semibold text-blue-300 transition hover:text-blue-200">← Back to Club Manager</Link>
        <section className="mt-5 mb-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-6 shadow-2xl shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Course management</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-semibold">Course Details</h1>
                    <p className="mt-2 text-gray-300">{course.name}</p>
                    {club?.name && <p className="mt-1 text-sm text-gray-400">{club.name}</p>}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${course.is_published ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-gray-300"}`}>
                    {course.is_published ? "Published" : "Draft"}
                </span>
            </div>
        </section>

        <CourseDetailsForm courseId={course.id} initialDetails={{
            name: course.name ?? "",
            location: course.location ?? "",
            description: course.description ?? "",
            timezone: course.timezone ?? "",
        }} />
    </main>;
}
