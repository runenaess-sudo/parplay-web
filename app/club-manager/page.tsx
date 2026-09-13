import Link from "next/link";
import { getServerCourseManager } from "@/lib/course-manager-auth";
import CourseTransferManager from "./CourseTransferManager";

export default async function ClubManagerPage({ searchParams }: { searchParams: Promise<{ clubId?: string }> }) {
    const access = await getServerCourseManager();
    if (!access) return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-semibold">Club Manager</h1><p className="mt-3 text-gray-300">You do not have access to this area.</p></main>;
    const requested = (await searchParams).clubId;
    let clubId = access.profile.membership === "admin" ? requested ?? null : null;
    const { data: clubs } = access.profile.membership === "admin"
        ? await access.supabase.from("clubs").select("id,name").order("name")
        : { data: null };
    if (access.profile.membership === "admin" && !clubId && clubs?.length === 1) clubId = clubs[0].id;
    const club = clubId ? (clubs?.find((item) => item.id === clubId)
        ?? (await access.supabase.from("clubs").select("id,name").eq("id", clubId).maybeSingle()).data) : null;
    const assignmentPairs = access.profile.membership === "admin"
        ? [] : access.assignments;
    const candidateCourseIds = access.profile.membership === "admin"
        ? [] : [...new Set(assignmentPairs.map((assignment) => assignment.course_id))];
    const { data: acceptedClaims, error: acceptedClaimsError } = access.profile.membership === "admin"
        ? (clubId ? await access.supabase.from("course_claim_requests").select("course_id,club_id")
            .eq("club_id", clubId).eq("status", "accepted") : { data: [], error: null })
        : (candidateCourseIds.length > 0
            ? await access.supabase.from("course_claim_requests").select("course_id,club_id")
                .in("course_id", candidateCourseIds).eq("status", "accepted")
            : { data: [], error: null });
    if (acceptedClaimsError) throw acceptedClaimsError;
    const acceptedCourseIds = [...new Set((acceptedClaims ?? []).filter((claim) =>
        access.profile.membership === "admin"
        || assignmentPairs.some((assignment) => assignment.course_id === claim.course_id
            && assignment.club_id === claim.club_id),
    ).map((claim) => claim.course_id))];
    const { data: courseRows, error: coursesError } = acceptedCourseIds.length > 0
        ? await access.supabase.from("courses").select("id,name,is_published,status,club_id")
            .in("id", acceptedCourseIds).order("name")
        : { data: [], error: null };
    if (coursesError) throw coursesError;
    const courses = (courseRows ?? []).filter((course) =>
        access.profile.membership === "admin"
            ? course.club_id === clubId
            : assignmentPairs.some((assignment) => assignment.course_id === course.id
                && assignment.club_id === course.club_id),
    );

    return <main className="mx-auto w-full max-w-4xl space-y-6 p-6 text-white">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">ParPlay Club Manager</p><h1 className="mt-2 text-3xl font-semibold">{access.profile.membership === "admin" ? club?.name ?? "Select a club" : "Your managed courses"}</h1></section>
        {access.profile.membership === "admin" && <section className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold">Club</h2><div className="mt-3 flex flex-wrap gap-2">{clubs?.map((item) => <Link key={item.id} href={`/club-manager?clubId=${item.id}`} className={`rounded-full px-3 py-2 text-sm ${item.id === clubId ? "bg-blue-500" : "bg-white/10 hover:bg-white/15"}`}>{item.name}</Link>)}</div></section>}
        {(access.profile.membership !== "admin" || clubId) && <section><h2 className="text-xl font-semibold">Courses</h2><div className="mt-3 space-y-3">{courses?.map((course) => <article key={course.id} className="rounded-xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold">{course.name}</h3><p className="text-sm text-gray-400">{course.is_published ? "Published" : "Draft"}</p></div><Link className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold" href={`/create-course/editor/${course.id}`}>Manage course</Link></div><CourseTransferManager courseId={course.id} /></article>)}{courses?.length === 0 && <p className="text-gray-400">No managed courses found.</p>}</div></section>}
    </main>;
}
