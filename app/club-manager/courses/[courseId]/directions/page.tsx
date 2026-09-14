import Link from "next/link";
import { canOpenCourseEditor } from "@/lib/course-manager-auth";
import { supabaseServer } from "@/lib/supabase-server";
import DirectionsForm, { type DirectionsValue } from "./DirectionsForm";

const EMPTY: DirectionsValue = { parking_latitude: "", parking_longitude: "", parking_description: "", general_directions: "", public_transport: "", walking_path: "", entrance_description: "" };

export default async function CourseDirectionsPage({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ clubId?: string }> }) {
    const { courseId } = await params;
    const { clubId } = await searchParams;
    const backParams = new URLSearchParams({ courseId });
    if (clubId) backParams.set("clubId", clubId);
    if (!await canOpenCourseEditor(courseId)) return <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-5 py-12 text-white"><section className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6"><h1 className="text-2xl font-semibold">Directions</h1><p className="mt-3 text-gray-300">You do not have access to manage this course.</p><Link href="/club-manager" className="mt-5 inline-block text-sm font-semibold text-blue-300">Back to Club Manager</Link></section></main>;
    const supabase = await supabaseServer();
    const [{ data: course, error: courseError }, { data: directions, error: directionsError }] = await Promise.all([
        supabase.from("courses").select("id,name").eq("id", courseId).maybeSingle(),
        supabase.from("course_directions").select("parking_latitude,parking_longitude,parking_description,general_directions,public_transport,walking_path,entrance_description").eq("course_id", courseId).maybeSingle(),
    ]);
    if (courseError || directionsError || !course) return <main className="mx-auto max-w-3xl px-5 py-12 text-white"><p className="text-gray-300">Directions could not be loaded.</p></main>;
    const initialValue: DirectionsValue = directions ? {
        parking_latitude: directions.parking_latitude?.toString() ?? "", parking_longitude: directions.parking_longitude?.toString() ?? "",
        parking_description: directions.parking_description ?? "", general_directions: directions.general_directions ?? "",
        public_transport: directions.public_transport ?? "", walking_path: directions.walking_path ?? "", entrance_description: directions.entrance_description ?? "",
    } : EMPTY;
    return <main className="mx-auto min-h-[70vh] w-full max-w-4xl px-5 py-10 text-white"><Link href={`/club-manager?${backParams.toString()}`} className="text-sm font-semibold text-blue-300 transition hover:text-blue-200">← Back to Club Manager</Link><section className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-6 shadow-2xl shadow-black/20"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Course management</p><h1 className="mt-2 text-3xl font-semibold">Directions</h1><p className="mt-2 text-gray-300">{course.name}</p><p className="mt-3 text-sm leading-6 text-gray-400">Help visitors find parking, the entrance and the route to the first hole.</p></section><DirectionsForm courseId={courseId} initialValue={initialValue} /></main>;
}
