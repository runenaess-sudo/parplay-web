import { supabaseServer } from "@/lib/supabase-server";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseLocationMap } from "./CourseLocationMap";
import { CourseLeaderboard, type LeaderboardData } from "./CourseLeaderboard";

type Layout = { id: string; name: string | null; description: string | null; hole_count: number | null; par_total: number | null; length_total: number | null; walk_length: number | null; difficulty: number | null; color: string | null; is_default: boolean | null; par_rating: number | null };
type FacilityValue = string | boolean | number | null;
type CourseMetrics = {
    completed_rounds: number;
    unique_players: number;
    average_score: number | null;
    matchplay_sessions: number;
    battle_sessions: number;
    traffic: Array<{ hour: number; percent: number; is_live: boolean }>;
};
type CourseActivity = {
    players_now: number;
    active_sessions: number;
    traffic_label: "light" | "moderate" | "busy";
};

const facilityLabels: Record<string, string> = {
    toilets: "Restrooms", trashcans: "Trash cans", signage: "Course signage",
    water: "Water", parking: "Parking", benches: "Benches", kiosk: "Kiosk or shop",
    dog_friendly: "Dog friendly", lighting: "Lighting", wheelchair_friendly: "Wheelchair friendly",
};

function meaningfulNumber(value: number | null | undefined) {
    return value != null && Number.isFinite(Number(value)) && Number(value) > 0;
}

function difficultyLabel(value: number | null | undefined) {
    return ({ 1: "Easy", 2: "Moderate", 3: "Challenging", 4: "Hard", 5: "Very challenging" } as Record<number, string>)[Number(value)] ?? null;
}

function average(values: Array<number | null>) {
    const valid = values.map(Number).filter(Number.isFinite);
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function ratingPercentage(value: unknown) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.min(10, Math.max(0, numeric)) * 10;
}

function formatDate(value: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en", {
        day: "numeric", month: "short", year: "numeric",
    }).format(date);
}

export default async function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
    const { courseId } = await params;
    const supabase = await supabaseServer();
    const [courseResult, imagesResult, layoutsResult, facilitiesResult, ratingsResult, eventsResult, metricsResult, activityResult, leaderboardResult] = await Promise.all([
        supabase.from("courses")
            .select("id,name,location,description,country,country_code,latitude,longitude,is_published")
            .eq("id", courseId).eq("is_published", true).maybeSingle(),
        supabase.from("course_images").select("id,image_url,sort_order")
            .eq("course_id", courseId).order("sort_order", { ascending: true }),
        supabase.from("course_layouts")
            .select("id,name,description,hole_count,par_total,length_total,walk_length,difficulty,color,is_default,par_rating")
            .eq("course_id", courseId).order("created_at", { ascending: true }),
        supabase.from("course_facilities")
            .select("toilets,trashcans,signage,water,parking,benches,kiosk,terrain,surface,opening_hours,tee_type,basket_type,dog_friendly,lighting,wheelchair_friendly,description")
            .eq("course_id", courseId).maybeSingle(),
        supabase.from("course_rating")
            .select("average,course_experience,variety,maintenance,location,accessibility")
            .eq("course_id", courseId).not("average", "is", null),
        supabase.from("tournaments").select("id,name,start_date,end_date,type,game_mode")
            .eq("course_id", courseId).eq("status", "published")
            .order("start_date", { ascending: true }).limit(3),
        supabase.rpc("get_public_course_profile_metrics_v1", { p_course_id: courseId }),
        supabase.rpc("get_course_activity_v1", { p_course_id: courseId }),
        supabase.rpc("get_public_course_leaderboard_v1", {
            p_course_id: courseId, p_period: "total", p_timezone: "UTC", p_offset: 0, p_limit: 20,
        }),
    ]);

    if (courseResult.error || !courseResult.data) notFound();
    const course = courseResult.data;
    const images = imagesResult.data ?? [];
    const layouts = ((layoutsResult.data ?? []) as Layout[])
        .sort((a, b) => Number(b.is_default) - Number(a.is_default));
    const facilities = facilitiesResult.data as Record<string, FacilityValue> | null;
    const ratings = ratingsResult.data ?? [];
    const rating = average(ratings.map((row) => row.average));
    const metrics = (!metricsResult.error && metricsResult.data
        ? metricsResult.data as CourseMetrics : null);
    const activity = (!activityResult.error && activityResult.data
        ? activityResult.data as CourseActivity : null);
    const leaderboard = (!leaderboardResult.error && leaderboardResult.data
        ? leaderboardResult.data as LeaderboardData
        : { rows: [], has_more: false, my_position: null });
    const primaryLayout = layouts.find((layout) => layout.is_default) ?? layouts[0];
    const largestHoleCount = Math.max(0, ...layouts.map((layout) => Number(layout.hole_count) || 0));
    const locationLine = [course.location, course.country].filter(Boolean).join(", ");
    const directionsUrl = course.latitude != null && course.longitude != null
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${course.latitude},${course.longitude}`)}`
        : null;
    const positiveFacilities = facilities
        ? Object.entries(facilities).filter(([key, value]) => facilityLabels[key] && value === true) : [];
    const detailFacts = facilities ? [
        ["Terrain", facilities.terrain], ["Surface", facilities.surface],
        ["Tee type", facilities.tee_type], ["Basket type", facilities.basket_type],
        ["Opening hours", facilities.opening_hours],
    ].filter((entry): entry is [string, string | number] =>
        typeof entry[1] === "string" ? entry[1].trim().length > 0 : typeof entry[1] === "number") : [];
    const hasCourseInformation = positiveFacilities.length > 0 || detailFacts.length > 0;
    const quickFacts = [
        largestHoleCount > 0 ? { label: "Holes", value: String(largestHoleCount) } : null,
        layouts.length > 0 ? { label: "Layouts", value: String(layouts.length) } : null,
        rating != null ? { label: "Course rating", value: rating.toFixed(1), note: `${ratings.length} ${ratings.length === 1 ? "rating" : "ratings"}` } : null,
        meaningfulNumber(primaryLayout?.par_total) ? { label: "Par", value: String(primaryLayout.par_total) } : null,
        meaningfulNumber(primaryLayout?.length_total) ? { label: "Course length", value: `${primaryLayout.length_total} m` } : null,
        difficultyLabel(primaryLayout?.difficulty) ? { label: "Difficulty", value: difficultyLabel(primaryLayout?.difficulty)! } : null,
    ].filter((fact): fact is { label: string; value: string; note?: string } => fact !== null);

    return <main className="mx-auto max-w-[90rem] px-4 pb-20 pt-2 sm:px-6 lg:px-10">
        <Link href="/courses" className="mb-5 inline-flex text-sm font-semibold text-blue-300 transition hover:text-blue-200">← All courses</Link>

        <section className="relative min-h-[25rem] overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-800 via-slate-950 to-black shadow-2xl shadow-black/30 sm:min-h-[32rem]">
            {images[0]?.image_url ? <Image src={images[0].image_url} alt={course.name} fill priority
                sizes="(max-width: 1200px) 100vw, 1152px" className="object-cover" />
                : <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_20%_20%,rgba(45,108,223,0.5),transparent_32%),radial-gradient(circle_at_80%_75%,rgba(34,197,94,0.24),transparent_30%)]" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5" />
            <div className="absolute inset-x-0 bottom-0 max-w-4xl p-6 sm:p-10">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-blue-300">ParPlay Course</p>
                <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">{course.name}</h1>
                {locationLine && <p className="mt-3 text-base text-white/80 sm:text-lg">{locationLine}</p>}
            </div>
        </section>

        {quickFacts.length > 0 && <section aria-label="Course facts" className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-3 lg:grid-cols-6">
            {quickFacts.map((fact) => <div key={fact.label} className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-white/20 bg-white/20 p-4 text-center shadow-sm backdrop-blur-md">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">{fact.label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{fact.value}</p>
                {fact.note && <p className="mt-1 text-xs text-white/60">{fact.note}</p>}
            </div>)}
        </section>}

        <section className="grid gap-4 py-8 md:grid-cols-2 xl:grid-cols-3">
            <DashboardCard eyebrow="Community" title="Course rating">
                {rating != null ? <><div className="flex items-end gap-3"><strong className="text-5xl font-black">{rating.toFixed(1)}</strong><span className="pb-1 text-sm text-white/55">{ratings.length} {ratings.length === 1 ? "rating" : "ratings"}</span></div>
                    <div className="mt-6 space-y-3">{[["Course", average(ratings.map((row) => row.course_experience))], ["Variety", average(ratings.map((row) => row.variety))], ["Maintenance", average(ratings.map((row) => row.maintenance))], ["Location", average(ratings.map((row) => row.location))], ["Accessibility", average(ratings.map((row) => row.accessibility))]].filter((entry) => entry[1] != null).map(([label, value]) => <div key={String(label)}><div className="mb-1 flex justify-between text-xs text-white/65"><span>{label}</span><span>{Number(value).toFixed(1)}</span></div><div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-blue-400 transition-[width] duration-300 ease-out" style={{ width: `${ratingPercentage(value)}%` }} /></div></div>)}</div></>
                    : <p className="text-sm text-white/55">Ratings will appear as players review this course.</p>}
            </DashboardCard>

            <DashboardCard eyebrow="Right now" title="Live traffic">
                {activity && metrics ? <><div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><strong className="text-4xl font-black">{activity.players_now}</strong><span className="text-sm text-white/55">live players</span><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-bold capitalize text-emerald-300">{activity.traffic_label}</span></div>
                    <p className="mt-2 text-xs text-white/45">{activity.active_sessions} active {activity.active_sessions === 1 ? "session" : "sessions"} across all game modes</p>
                    {metrics.traffic.length > 0 && <div className="mt-7 flex h-16 items-end gap-1" aria-label="Hourly course activity">{metrics.traffic.filter((point) => point.hour >= 6 && point.hour <= 22).map((point) => <div key={point.hour} title={`${point.hour}:00 · ${point.percent}%`} className={`min-w-0 flex-1 rounded-t ${point.is_live ? "bg-emerald-400" : "bg-blue-400/70"}`} style={{ height: `${Math.max(8, point.percent)}%` }} />)}</div>}
                    <p className="mt-4 text-xs text-white/45">Typical hourly activity from 06:00 to 22:00</p></>
                    : <p className="text-sm text-white/55">Trip activity is not available for this course yet.</p>}
            </DashboardCard>

            <DashboardCard eyebrow="Find your way" title="Location" flush>
                {course.latitude != null && course.longitude != null && <CourseLocationMap latitude={course.latitude} longitude={course.longitude} name={course.name} />}
                <div className="p-5">{locationLine && <p className="text-sm text-white/65">{locationLine}</p>}{directionsUrl && <a href={directionsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-500">Open in maps ↗</a>}</div>
            </DashboardCard>
        </section>

        <div className="mt-14 grid gap-16 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 space-y-16">
                {layouts.length > 0 && <section>
                    <SectionHeading eyebrow="Play" title="Course layouts" />
                    <div className="grid gap-4 sm:grid-cols-2">
                        {layouts.map((layout) => <article key={layout.id} className="group relative overflow-hidden rounded-2xl bg-white/[0.055] p-5 transition hover:bg-white/[0.08]">
                            <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: layout.color ?? "#2D6CDF" }} />
                            <div className="flex items-start justify-between gap-4"><div>
                                <h3 className="text-lg font-bold text-white">{layout.name?.trim() || "Course layout"}</h3>
                                {layout.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-400">{layout.description}</p>}
                            </div>{layout.is_default && <span className="shrink-0 rounded-full bg-blue-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-300">Default</span>}</div>
                            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-300">
                                {meaningfulNumber(layout.hole_count) && <span>{layout.hole_count} holes</span>}
                                {meaningfulNumber(layout.par_total) && <span>Par {layout.par_total}</span>}
                                {meaningfulNumber(layout.length_total) && <span>{layout.length_total} m</span>}
                                {meaningfulNumber(layout.walk_length) && <span>{layout.walk_length} m walk</span>}
                                {meaningfulNumber(layout.par_rating) && <span>Rating {layout.par_rating}</span>}
                            </div>
                        </article>)}
                    </div>
                </section>}

                {metrics && <section>
                    <SectionHeading eyebrow="Activity" title="Course stats" />
                    <div className="grid grid-cols-2 gap-x-8 gap-y-7 border-y border-white/10 py-7 sm:grid-cols-3">
                        {[
                            ["Completed rounds", metrics.completed_rounds],
                            ["Unique players", metrics.unique_players],
                            ["Average score", metrics.average_score],
                            ["MatchPlay", metrics.matchplay_sessions],
                            ["Battles", metrics.battle_sessions],
                        ].filter(([, value]) => value != null && Number(value) > 0).map(([label, value]) => <div key={String(label)}>
                            <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
                            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
                        </div>)}
                    </div>
                </section>}

                <section>
                    <SectionHeading eyebrow="Players" title="Leaderboard" />
                    <CourseLeaderboard courseId={courseId} initialData={leaderboard}
                        initialError={leaderboardResult.error != null} />
                </section>

                {(course.description || facilities?.description) && <section>
                    <SectionHeading eyebrow="Overview" title="About the course" />
                    <div className="max-w-3xl space-y-4 whitespace-pre-line text-base leading-8 text-gray-300">
                        {course.description && <p>{course.description}</p>}
                        {facilities?.description && facilities.description !== course.description && <p>{String(facilities.description)}</p>}
                    </div>
                </section>}
            </div>

            <aside className="space-y-10 lg:sticky lg:top-24 lg:self-start">
                {hasCourseInformation && <section><h2 className="text-lg font-bold text-white">Course information</h2>
                    {detailFacts.length > 0 && <dl className="mt-4 space-y-4">{detailFacts.map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-white/10 pb-3 text-sm">
                        <dt className="text-gray-500">{label}</dt><dd className="text-right font-medium text-gray-200">{value}</dd>
                    </div>)}</dl>}
                    {positiveFacilities.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{positiveFacilities.map(([key]) => <span key={key} className="rounded-full bg-white/[0.07] px-3 py-1.5 text-xs text-gray-300">{facilityLabels[key]}</span>)}</div>}
                </section>}

                {(locationLine || directionsUrl) && <section><h2 className="text-lg font-bold text-white">Location</h2>
                    {locationLine && <p className="mt-3 text-sm leading-6 text-gray-400">{locationLine}</p>}
                    {directionsUrl && <a href={directionsUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500">Get directions ↗</a>}
                </section>}
            </aside>
        </div>

        {images.length > 1 && <section className="mt-16"><SectionHeading eyebrow="Course gallery" title="See the course" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{images.slice(1, 7).map((image, index) => <div key={image.id} className={`relative overflow-hidden rounded-2xl ${index === 0 ? "aspect-[16/10] sm:col-span-2" : "aspect-[4/3]"}`}>
                <Image src={image.image_url} alt={`${course.name} course view ${index + 2}`} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover transition duration-500 hover:scale-[1.03]" />
            </div>)}</div>
        </section>}

        <section className="mt-16">
            <SectionHeading eyebrow="At the course" title="Upcoming events" />
            {(eventsResult.data?.length ?? 0) > 0 ? <div className="divide-y divide-white/10 border-y border-white/10">
                {eventsResult.data?.map((event) => <article key={event.id} className="flex flex-col justify-between gap-2 py-5 sm:flex-row sm:items-center">
                    <div><h3 className="font-semibold text-white">{event.name}</h3>
                        {[event.type, event.game_mode].filter(Boolean).length > 0 && <p className="mt-1 text-sm capitalize text-gray-400">{[event.type, event.game_mode].filter(Boolean).join(" · ")}</p>}</div>
                    {formatDate(event.start_date) && <p className="text-sm font-semibold text-blue-300">{formatDate(event.start_date)}</p>}
                </article>)}
            </div> : <div className="rounded-2xl bg-white/[0.04] p-6"><p className="font-semibold text-white">No upcoming events yet</p><p className="mt-1 text-sm text-gray-500">Tournaments and events at this course will appear here.</p></div>}
        </section>
    </main>;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
    return <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2></div>;
}

function DashboardCard({ eyebrow, title, children, flush = false }: {
    eyebrow: string; title: string; children: React.ReactNode; flush?: boolean;
}) {
    return <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055]">
        <div className={flush ? "p-5 pb-4" : "p-5 pb-0"}>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300">{eyebrow}</p>
            <h2 className="mt-1 text-xl font-bold text-white">{title}</h2>
        </div>
        <div className={flush ? "" : "p-5 pt-6"}>{children}</div>
    </article>;
}
