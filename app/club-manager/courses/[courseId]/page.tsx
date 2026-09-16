import Image from "next/image";
import Link from "next/link";
import { canOpenCourseEditor, getServerCourseManager } from "@/lib/course-manager-auth";

type FacilityRow = Record<string, boolean | string | number | null>;
type DirectionRow = Record<string, string | number | null>;

const facilityFields = [
    "toilets", "water", "parking", "kiosk", "benches", "trashcans", "signage",
    "dog_friendly", "lighting", "wheelchair_friendly",
];

function withClubId(path: string, clubId?: string) {
    return clubId ? `${path}?clubId=${encodeURIComponent(clubId)}` : path;
}

function StatusPill({ children, positive = false }: { children: React.ReactNode; positive?: boolean }) {
    return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${positive
        ? "bg-emerald-500/15 text-emerald-200"
        : "bg-white/[0.08] text-gray-300"
    }`}>{children}</span>;
}

function ToolLink({ href, title, description, status }: {
    href: string; title: string; description: string; status: string;
}) {
    return <Link href={href} className="group flex min-h-28 flex-col justify-between rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-blue-300/50">
        <div><h3 className="font-semibold text-white group-hover:text-blue-200">{title}</h3><p className="mt-1 text-sm leading-5 text-gray-400">{description}</p></div>
        <p className="mt-3 text-xs font-semibold text-blue-300">{status} <span aria-hidden>→</span></p>
    </Link>;
}

export default async function ManageCourseOverview({ params, searchParams }: {
    params: Promise<{ courseId: string }>;
    searchParams: Promise<{ clubId?: string }>;
}) {
    const [{ courseId }, { clubId }, access, editorAllowed] = await Promise.all([
        params, searchParams, getServerCourseManager(),
        params.then(({ courseId: requestedCourseId }) => canOpenCourseEditor(requestedCourseId)),
    ]);

    if (!access || !editorAllowed) {
        return <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-5 py-12 text-white"><section className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6"><h1 className="text-2xl font-semibold">Manage Course</h1><p className="mt-3 text-gray-300">You do not have access to manage this course.</p><Link href="/club-manager" className="mt-5 inline-block text-sm font-semibold text-blue-300">Back to Club Manager</Link></section></main>;
    }

    const { data: course, error: courseError } = await access.supabase.from("courses")
        .select("id,name,location,timezone,is_published,status,club_id,has_facilities,has_images,has_directions")
        .eq("id", courseId).maybeSingle();
    if (courseError || !course) {
        return <main className="mx-auto max-w-3xl px-5 py-12 text-white"><p className="text-gray-300">Course overview could not be loaded.</p></main>;
    }

    if (access.profile.membership !== "admin") {
        const assigned = access.assignments.some((assignment) =>
            assignment.course_id === course.id && assignment.club_id === course.club_id);
        const { data: acceptedClaim } = assigned ? await access.supabase.from("course_claim_requests")
            .select("course_id").eq("course_id", course.id).eq("club_id", course.club_id)
            .eq("status", "accepted").limit(1).maybeSingle() : { data: null };
        if (!assigned || !acceptedClaim) {
            return <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-5 py-12 text-white"><section className="rounded-2xl border border-red-400/20 bg-red-500/10 p-6"><h1 className="text-2xl font-semibold">Manage Course</h1><p className="mt-3 text-gray-300">You do not have authoritative Course Manager access to this course.</p><Link href="/club-manager" className="mt-5 inline-block text-sm font-semibold text-blue-300">Back to Club Manager</Link></section></main>;
        }
    }

    const [holesResult, layoutsResult, imagesResult, facilitiesResult, directionsResult, trafficResult, clubResult] = await Promise.all([
        access.supabase.from("holes").select("id", { count: "exact", head: true }).eq("course_id", course.id),
        access.supabase.from("course_layouts").select("id,difficulty,published").eq("course_id", course.id),
        access.supabase.from("course_images").select("image_url,sort_order", { count: "exact" }).eq("course_id", course.id).order("sort_order").limit(1),
        access.supabase.from("course_facilities").select(facilityFields.join(",")).eq("course_id", course.id).maybeSingle(),
        access.supabase.from("course_directions").select("parking_latitude,parking_longitude,parking_description,general_directions,public_transport,walking_path,entrance_description").eq("course_id", course.id).maybeSingle(),
        course.is_published ? access.supabase.rpc("get_course_traffic_v2", { p_course_id: course.id, p_day_of_week: null }) : Promise.resolve({ data: null, error: null }),
        course.club_id ? access.supabase.from("clubs").select("name").eq("id", course.club_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    const queryError = holesResult.error || layoutsResult.error || imagesResult.error
        || facilitiesResult.error || directionsResult.error || trafficResult.error || clubResult.error;
    if (queryError) throw queryError;

    const holeCount = holesResult.count ?? 0;
    const layouts = layoutsResult.data ?? [];
    const imageCount = imagesResult.count ?? 0;
    const coverUrl = imagesResult.data?.[0]?.image_url ?? null;
    const facilities = facilitiesResult.data as FacilityRow | null;
    const facilityCount = facilities ? facilityFields.filter((field) => facilities[field] === true).length : 0;
    const directions = directionsResult.data as DirectionRow | null;
    const hasDirections = Boolean(directions && Object.values(directions).some((value) =>
        typeof value === "number" || (typeof value === "string" && value.trim().length > 0)));
    const traffic = trafficResult.data as { available?: boolean } | null;
    const layoutDifficulties = layouts.map((layout) => layout.difficulty).filter((value): value is number => value != null);
    const difficultyStatus = layoutDifficulties.length
        ? `${layoutDifficulties.length}/${layouts.length} layouts rated` : "No layout difficulty";
    const attentionItems = [
        holeCount === 0 ? "Add course holes and map positions." : null,
        layouts.length === 0 ? "Create at least one playable layout." : null,
        imageCount === 0 ? "Add a course cover image." : null,
        !course.timezone ? "Set the course timezone for local traffic estimates." : null,
        !facilities ? "Add facilities and practical course information." : null,
        !hasDirections ? "Add parking and arrival directions." : null,
    ].filter((item): item is string => Boolean(item));
    const managerQuery = new URLSearchParams({ courseId: course.id });
    if (clubId) managerQuery.set("clubId", clubId);

    return <main className="mx-auto min-h-[70vh] w-full max-w-6xl px-5 py-10 text-white">
        <Link href={`/club-manager?${managerQuery.toString()}`} className="text-sm font-semibold text-blue-300 transition hover:text-blue-200">← Back to Club Manager</Link>

        <section className="relative mt-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] shadow-2xl shadow-black/25">
            {coverUrl && <div className="absolute inset-y-0 right-0 hidden w-2/5 sm:block"><Image src={coverUrl} alt="" fill sizes="40vw" className="object-cover opacity-45" /><div className="absolute inset-0 bg-gradient-to-r from-[#101725] via-[#101725]/70 to-transparent" /></div>}
            <div className="relative max-w-3xl p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Course Overview</p><div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{course.name}</h1>{course.location && <p className="mt-2 text-gray-300">{course.location}</p>}{clubResult.data?.name && <p className="mt-1 text-sm text-gray-400">{clubResult.data.name}</p>}</div><StatusPill positive={course.is_published}>{course.is_published ? "Published" : "Draft"}</StatusPill></div>
                <div className="mt-6 flex flex-wrap gap-3"><Link href={`/create-course/editor/${course.id}`} className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold transition hover:bg-blue-400">Open holes &amp; map editor</Link>{course.is_published && <Link href={`/courses/${course.id}`} className="rounded-xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold transition hover:bg-white/[0.12]">View public course ↗</Link>}</div>
            </div>
        </section>

        <section aria-label="Course summary" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[["Holes", holeCount], ["Layouts", layouts.length], ["Images", imageCount], ["Facilities", facilityCount], ["Timezone", course.timezone ?? "Missing"], ["Traffic", traffic?.available ? "Available" : "Building data"]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p><p className="mt-2 truncate text-lg font-semibold text-white" title={String(value)}>{value}</p></div>)}
        </section>

        <section className="mt-8"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Management</p><h2 className="mt-2 text-2xl font-semibold">Course tools</h2><p className="mt-1 text-sm text-gray-400">Keep course information, play structure and visitor guidance current.</p></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ToolLink href={withClubId(`/club-manager/courses/${course.id}/details`, clubId)} title="Course Details" description="Name, location, description and timezone." status={course.timezone ? "Timezone set" : "Timezone needed"} />
                <ToolLink href={`/create-course/editor/${course.id}`} title="Holes & Map" description="Course-owned holes, positions and map features." status={`${holeCount} ${holeCount === 1 ? "hole" : "holes"}`} />
                <ToolLink href={withClubId(`/club-manager/courses/${course.id}/layouts`, clubId)} title="Layouts" description="Playing configurations and course-hole order." status={`${layouts.length} ${layouts.length === 1 ? "layout" : "layouts"}`} />
                <ToolLink href={withClubId(`/club-manager/courses/${course.id}/difficulty`, clubId)} title="Difficulty" description="Per-layout statistical analysis and suggestions." status={difficultyStatus} />
                <ToolLink href={withClubId(`/club-manager/courses/${course.id}/images`, clubId)} title="Images" description="Course cover and ordered gallery." status={imageCount ? `${imageCount} added` : "No images"} />
                <ToolLink href={withClubId(`/club-manager/courses/${course.id}/facilities`, clubId)} title="Facilities" description="Amenities, access and playing conditions." status={facilities ? `${facilityCount} amenities` : "Not configured"} />
                <ToolLink href={withClubId(`/club-manager/courses/${course.id}/directions`, clubId)} title="Directions" description="Parking, entrance and arrival guidance." status={hasDirections ? "Directions added" : "Not configured"} />
                {course.is_published
                    ? <ToolLink href={`/courses/${course.id}`} title="Traffic / Time your trip" description="Preview live and typical historical course activity." status={traffic?.available ? "Historical traffic available" : "Collecting history"} />
                    : <div className="flex min-h-28 flex-col justify-between rounded-2xl border border-white/10 bg-black/15 p-4 opacity-70"><div><h3 className="font-semibold">Traffic / Time your trip</h3><p className="mt-1 text-sm leading-5 text-gray-400">Available on the public Course View after publication.</p></div><p className="mt-3 text-xs font-semibold text-gray-500">Draft course</p></div>}
            </div>
        </section>

        <section className={`mt-8 rounded-2xl border p-5 ${attentionItems.length ? "border-amber-400/20 bg-amber-500/[0.07]" : "border-emerald-400/20 bg-emerald-500/[0.07]"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{attentionItems.length ? "Needs attention" : "Core setup complete"}</h2><p className="mt-1 text-sm text-gray-400">{attentionItems.length ? "Straightforward items that are still missing." : "No obvious setup gaps were found."}</p></div><StatusPill positive={!attentionItems.length}>{attentionItems.length ? `${attentionItems.length} items` : "Ready"}</StatusPill></div>{attentionItems.length > 0 && <ul className="mt-4 grid gap-2 text-sm text-amber-100/85 sm:grid-cols-2">{attentionItems.map((item) => <li key={item} className="rounded-xl bg-black/15 px-3 py-2">{item}</li>)}</ul>}</section>
    </main>;
}
