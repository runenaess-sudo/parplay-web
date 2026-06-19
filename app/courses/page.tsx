import { supabaseServer } from "@/src/lib/supabase-server";
import Image from "next/image";
import Link from "next/link";

export default async function CoursesPage() {
    const supabase = await supabaseServer();

    // 1. Hent baner
    const { data: courses } = await supabase
        .from("courses")
        .select("id, name, location")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

    if (!courses) return <div className="p-6">No courses found.</div>;

    // 2. Hent bilder
    const { data: images } = await supabase
        .from("course_images")
        .select("course_id, image_url, sort_order");

    // 3. Hent layouts
    const { data: layouts } = await supabase
        .from("course_layouts")
        .select("course_id, name, hole_count, par_total, color, is_default, par_rating");

    // 4. Kombiner data
    const enriched = courses.map((course) => {
        const courseImages = images?.filter((i) => i.course_id === course.id) || [];
        const primaryImage = courseImages.sort((a, b) => a.sort_order - b.sort_order)[0];

        const courseLayouts = layouts?.filter((l) => l.course_id === course.id) || [];
        const layout =
            courseLayouts.find((l) => l.is_default) ||
            courseLayouts[0];

        return {
            ...course,
            image: primaryImage?.image_url ?? null,
            layoutName: layout?.name ?? null,
            holes: layout?.hole_count ?? null,
            par: layout?.par_total ?? null,
            color: layout?.color ?? "#333",
            rating: layout?.par_rating ?? null,
        };
    });

    return (
        <div className="p-6">
            <h1 className="text-3xl font-semibold mb-6">Courses</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {enriched.map((course) => (
                    <Link
                        key={course.id}
                        href={`/courses/${course.id}`}
                        className="group block rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 bg-white"
                    >
                        {/* IMAGE */}
                        <div className="relative h-56 w-full">
                            {course.image && (
                                <Image
                                    src={course.image}
                                    alt={course.name}
                                    fill
                                    sizes="100vw"
                                    className="object-cover group-hover:scale-105 transition duration-500"
                                />
                            )}

                            {/* DARK OVERLAY */}
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition" />

                            {/* LAYOUT BADGE */}
                            <div
                                className="absolute top-3 left-3 px-3 py-1 rounded-full text-white text-xs font-semibold shadow"
                                style={{ backgroundColor: course.color }}
                            >
                                {course.layoutName}
                            </div>

                            {/* RATING BADGE */}
                            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-white/90 text-black text-xs font-semibold shadow">
                                ⭐ {course.rating}
                            </div>

                            {/* TITLE + LOCATION ON IMAGE */}
                            <div className="absolute bottom-3 left-3 text-white drop-shadow">
                                <div className="text-lg font-bold">{course.name}</div>
                                <div className="text-sm opacity-80">{course.location}</div>
                            </div>
                        </div>

                        {/* INFO SECTION */}
                        <div className="p-4">
                            <div className="flex gap-6 text-sm text-gray-700">
                                <span className="flex items-center gap-1">
                                    🕳 {course.holes}
                                </span>
                                <span className="flex items-center gap-1">
                                    ⛳ Par {course.par}
                                </span>
                            </div>

                            {/* CTA */}
                            <div className="mt-4 text-blue-600 font-semibold group-hover:underline">
                                View course →
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
