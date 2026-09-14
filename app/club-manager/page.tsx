import Link from "next/link";
import { getServerCourseManager } from "@/lib/course-manager-auth";
import CourseTransferManager from "./CourseTransferManager";
import ManagedCourseSelector from "./ManagedCourseSelector";

export default async function ClubManagerPage({ searchParams }: { searchParams: Promise<{ clubId?: string; courseId?: string }> }) {
    const access = await getServerCourseManager();
    if (!access) return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-semibold">Club Manager</h1><p className="mt-3 text-gray-300">You do not have access to this area.</p></main>;
    const params = await searchParams;
    const requested = params.clubId;
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
    const courseClubIds = [...new Set(courses.map((course) => course.club_id).filter((id): id is string => Boolean(id)))];
    const managerClubs = access.profile.membership !== "admin" && courseClubIds.length > 0
        ? (await access.supabase.from("clubs").select("id,name").in("id", courseClubIds)).data ?? []
        : [];
    const clubNames = new Map([...(clubs ?? []), ...managerClubs].map((item) => [item.id, item.name]));
    const courseOptions = courses.map((course) => ({
        id: course.id,
        name: course.name,
        clubName: course.club_id ? clubNames.get(course.club_id) ?? null : null,
        isPublished: course.is_published,
    }));
    const selectedCourse = courses.find((course) => course.id === params.courseId) ?? courses[0] ?? null;

    return <main className="mx-auto w-full max-w-4xl space-y-6 p-6 text-white">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">ParPlay Club Manager</p><h1 className="mt-2 text-3xl font-semibold">{access.profile.membership === "admin" ? club?.name ?? "Select a club" : "Your managed courses"}</h1></section>
        {access.profile.membership === "admin" && <section className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold">Club</h2><div className="mt-3 flex flex-wrap gap-2">{clubs?.map((item) => <Link key={item.id} href={`/club-manager?clubId=${item.id}`} className={`rounded-full px-3 py-2 text-sm ${item.id === clubId ? "bg-blue-500" : "bg-white/10 hover:bg-white/15"}`}>{item.name}</Link>)}</div></section>}
        {(access.profile.membership !== "admin" || clubId) && (selectedCourse ? <>
            <ManagedCourseSelector courses={courseOptions} selectedCourseId={selectedCourse.id} clubId={clubId} />
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">Selected course</p>
                        <h2 className="mt-2 text-2xl font-semibold">{selectedCourse.name}</h2>
                        {selectedCourse.club_id && <p className="mt-1 text-sm text-gray-300">{clubNames.get(selectedCourse.club_id) ?? "Club"}</p>}
                        <p className="mt-1 text-sm text-gray-400">{selectedCourse.is_published ? "Published" : "Draft"}</p>
                    </div>
                    <Link className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold" href={`/create-course/editor/${selectedCourse.id}`}>Manage course</Link>
                </div>
                <section className="mt-5 border-t border-white/10 pt-5">
                    <div>
                        <h3 className="font-semibold">Course Tools</h3>
                        <p className="mt-1 text-sm text-gray-400">Available tools for this course.</p>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Link
                            href={`/club-manager/courses/${selectedCourse.id}/details${clubId ? `?clubId=${encodeURIComponent(clubId)}` : ""}`}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-blue-400/40 hover:bg-white/5"
                        >
                            <p className="text-sm font-semibold text-white">Course details</p>
                            <p className="mt-1 text-xs text-gray-400">Edit name, location and description.</p>
                        </Link>
                        <Link
                            href={`/create-course/editor/${selectedCourse.id}`}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-blue-400/40 hover:bg-white/5"
                        >
                            <p className="text-sm font-semibold text-white">Holes &amp; course map</p>
                            <p className="mt-1 text-xs text-gray-400">Edit holes, positions and map features.</p>
                        </Link>
                        <Link
                            href={`/club-manager/courses/${selectedCourse.id}/layouts${clubId ? `?clubId=${encodeURIComponent(clubId)}` : ""}`}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-blue-400/40 hover:bg-white/5"
                        >
                            <p className="text-sm font-semibold text-white">Layouts</p>
                            <p className="mt-1 text-xs text-gray-400">View course layouts and assigned holes.</p>
                        </Link>
                        <Link
                            href={`/club-manager/courses/${selectedCourse.id}/difficulty${clubId ? `?clubId=${encodeURIComponent(clubId)}` : ""}`}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-blue-400/40 hover:bg-white/5"
                        >
                            <p className="text-sm font-semibold text-white">Difficulty</p>
                            <p className="mt-1 text-xs text-gray-400">Review per-layout rating analysis and suggestions.</p>
                        </Link>
                        <Link
                            href={`/club-manager/courses/${selectedCourse.id}/images${clubId ? `?clubId=${encodeURIComponent(clubId)}` : ""}`}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-blue-400/40 hover:bg-white/5"
                        >
                            <p className="text-sm font-semibold text-white">Images</p>
                            <p className="mt-1 text-xs text-gray-400">Manage the course cover and gallery order.</p>
                        </Link>
                        <Link
                            href={`/club-manager/courses/${selectedCourse.id}/facilities${clubId ? `?clubId=${encodeURIComponent(clubId)}` : ""}`}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-blue-400/40 hover:bg-white/5"
                        >
                            <p className="text-sm font-semibold text-white">Facilities</p>
                            <p className="mt-1 text-xs text-gray-400">Update amenities, access and course conditions.</p>
                        </Link>
                        <Link
                            href={`/club-manager/courses/${selectedCourse.id}/directions${clubId ? `?clubId=${encodeURIComponent(clubId)}` : ""}`}
                            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-blue-400/40 hover:bg-white/5"
                        >
                            <p className="text-sm font-semibold text-white">Directions</p>
                            <p className="mt-1 text-xs text-gray-400">Edit parking, access and arrival information.</p>
                        </Link>
                    </div>
                </section>
                <CourseTransferManager courseId={selectedCourse.id} />
            </section>
        </> : <p className="text-gray-400">No managed courses found.</p>)}
    </main>;
}
