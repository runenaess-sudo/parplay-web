import Link from "next/link";
import { canOpenCourseEditor } from "@/lib/course-manager-auth";
import { supabaseServer } from "@/lib/supabase-server";
import FacilitiesForm, { type FacilitiesValue } from "./FacilitiesForm";

const EMPTY_FACILITIES: FacilitiesValue = {
    toilets: false, water: false, parking: false, kiosk: false, benches: false,
    trashcans: false, signage: false, dog_friendly: false, lighting: false, wheelchair_friendly: false,
    terrain: "", surface: "", opening_hours: "", description: "", tee_type: "", basket_type: "",
};

export default async function CourseFacilitiesPage({ params, searchParams }: {
    params: Promise<{ courseId: string }>;
    searchParams: Promise<{ clubId?: string }>;
}) {
    const { courseId } = await params;
    const { clubId } = await searchParams;
    const backParams = new URLSearchParams({ courseId });
    if (clubId) backParams.set("clubId", clubId);
    if (!await canOpenCourseEditor(courseId)) {
        return <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-5 py-12 text-white"><section className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6"><h1 className="text-2xl font-semibold">Facilities</h1><p className="mt-3 text-gray-300">You do not have access to manage this course.</p><Link href="/club-manager" className="mt-5 inline-block text-sm font-semibold text-blue-300 hover:text-blue-200">Back to Club Manager</Link></section></main>;
    }
    const supabase = await supabaseServer();
    const [{ data: course, error: courseError }, { data: facilities, error: facilitiesError }] = await Promise.all([
        supabase.from("courses").select("id,name").eq("id", courseId).maybeSingle(),
        supabase.from("course_facilities").select("toilets,water,parking,kiosk,benches,trashcans,signage,dog_friendly,lighting,wheelchair_friendly,terrain,surface,opening_hours,description,tee_type,basket_type").eq("course_id", courseId).maybeSingle(),
    ]);
    if (courseError || facilitiesError || !course) return <main className="mx-auto max-w-3xl px-5 py-12 text-white"><p className="text-gray-300">Facilities could not be loaded.</p></main>;

    const initialValue: FacilitiesValue = facilities ? {
        toilets: facilities.toilets === true, water: facilities.water === true, parking: facilities.parking === true,
        kiosk: facilities.kiosk === true, benches: facilities.benches === true, trashcans: facilities.trashcans === true,
        signage: facilities.signage === true, dog_friendly: facilities.dog_friendly === true,
        lighting: facilities.lighting === true, wheelchair_friendly: facilities.wheelchair_friendly === true,
        terrain: facilities.terrain ?? "", surface: facilities.surface ?? "", opening_hours: facilities.opening_hours ?? "",
        description: facilities.description ?? "", tee_type: facilities.tee_type ?? "", basket_type: facilities.basket_type ?? "",
    } : EMPTY_FACILITIES;

    return <main className="mx-auto min-h-[70vh] w-full max-w-5xl px-5 py-10 text-white">
        <Link href={`/club-manager?${backParams.toString()}`} className="text-sm font-semibold text-blue-300 transition hover:text-blue-200">← Back to Club Manager</Link>
        <section className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.03] p-6 shadow-2xl shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Course management</p><h1 className="mt-2 text-3xl font-semibold">Facilities</h1><p className="mt-2 text-gray-300">{course.name}</p><p className="mt-3 text-sm leading-6 text-gray-400">Keep practical course amenities and playing conditions clear for visitors.</p>
        </section>
        <FacilitiesForm courseId={courseId} initialValue={initialValue} />
    </main>;
}
