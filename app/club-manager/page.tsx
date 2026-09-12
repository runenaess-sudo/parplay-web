import Link from "next/link";
import { getServerCourseManager } from "@/lib/course-manager-auth";

export default async function ClubManagerPage({ searchParams }: { searchParams: Promise<{ clubId?: string }> }) {
    const access = await getServerCourseManager();
    if (!access) return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-semibold">Club Manager</h1><p className="mt-3 text-gray-300">You do not have access to this area.</p></main>;
    const requested = (await searchParams).clubId;
    let clubId = access.profile.membership === "admin" ? requested ?? null : access.profile.club_id;
    const { data: clubs } = access.profile.membership === "admin"
        ? await access.supabase.from("clubs").select("id,name").order("name")
        : { data: null };
    if (access.profile.membership === "admin" && !clubId && clubs?.length === 1) clubId = clubs[0].id;
    const club = clubId ? (clubs?.find((item) => item.id === clubId)
        ?? (await access.supabase.from("clubs").select("id,name").eq("id", clubId).maybeSingle()).data) : null;
    const { data: acceptedClaims, error: acceptedClaimsError } = clubId
        ? await access.supabase.from("course_claim_requests").select("course_id")
            .eq("club_id", clubId).eq("status", "accepted")
        : { data: [], error: null };
    if (acceptedClaimsError) throw acceptedClaimsError;
    const acceptedCourseIds = [...new Set((acceptedClaims ?? []).map((claim) => claim.course_id))];
    const { data: courses, error: coursesError } = clubId && acceptedCourseIds.length > 0
        ? await access.supabase.from("courses").select("id,name,is_published,status")
            .eq("club_id", clubId).in("id", acceptedCourseIds).order("name")
        : { data: [], error: null };
    if (coursesError) throw coursesError;

    return <main className="mx-auto w-full max-w-4xl space-y-6 p-6 text-white">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">ParPlay Club Manager</p><h1 className="mt-2 text-3xl font-semibold">{club?.name ?? "Select a club"}</h1></section>
        {access.profile.membership === "admin" && <section className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold">Club</h2><div className="mt-3 flex flex-wrap gap-2">{clubs?.map((item) => <Link key={item.id} href={`/club-manager?clubId=${item.id}`} className={`rounded-full px-3 py-2 text-sm ${item.id === clubId ? "bg-blue-500" : "bg-white/10 hover:bg-white/15"}`}>{item.name}</Link>)}</div></section>}
        {clubId && <section><h2 className="text-xl font-semibold">Courses</h2><div className="mt-3 space-y-3">{courses?.map((course) => <article key={course.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4"><div><h3 className="font-semibold">{course.name}</h3><p className="text-sm text-gray-400">{course.is_published ? "Published" : "Draft"}</p></div><Link className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold" href={`/create-course/editor/${course.id}`}>Manage course</Link></article>)}{courses?.length === 0 && <p className="text-gray-400">No courses belong to this club.</p>}</div></section>}
    </main>;
}
