import { supabaseServer } from "@/src/lib/supabase-server";
import Link from "next/link";

export default async function CoursesPage() {
    const supabase = await supabaseServer();

    // 1. Hent alle publiserte baner
    const { data: courses } = await supabase
        .from("courses")
        .select("id, name, location")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

    if (!courses) return <div className="p-6">No courses found.</div>;

    // 2. Hent alle bilder
    const { data: images } = await supabase
        .from("course_images")
        .select("course_id, image_url, sort_order");

    // 3. Hent alle layouts
    const { data: layouts } = await supabase
        .from("course_layouts")
        .select("course_id, name, hole_count, par_total, color, is_default, published, par_rating");

    // 4. Kombiner data
    const enriched = courses.map((course) => {
        // Finn primærbilde
        const courseImages = images?.filter((img) => img.course_id === course.id) || [];
        const primaryImage = courseImages.sort((a, b) => a.sort_order - b.sort_order)[0];

        // Finn riktig layout
        const courseLayouts = layouts?.filter((l) => l.course_id === course.id) || [];

        let layout =
            courseLayouts.find((l) => l.is_default) ||
            courseLayouts.find((l) => l.published) ||
            courseLayouts[0];

        return {
            ...course,
            image: primaryImage?.image_url ?? null,
            layoutName: layout?.name ?? null,
            holes: layout?.hole_count ?? null,
            par: layout?.par_total ?? null,
            color: layout?.color ?? null,
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
                        className="block bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden"
                    >
                        {/* Bilde */}
                        <div className="h-40 bg-gray-200">
                            {course.image ? (
                                <img
                                    src={course.image}
                                    alt={course.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                    No image
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="p-4">
                            <div className="text-lg font-semibold">
                                {course.name}
                            </div>

                            <div className="text-sm text-gray-600">
                                {course.location || "Unknown location"}
                            </div>

                            <div className="mt-2 flex gap-4 text-sm text-gray-700">
                                <span>🕳 {course.holes ?? "?"} holes</span>
                                <span>⛳ Par {course.par ?? "?"}</span>
                            </div>

                            <div className="mt-1 text-sm text-gray-500">
                                Layout: {course.layoutName ?? "Unknown"}
                            </div>

                            <div className="mt-1 text-sm text-gray-500">
                                Rating: {course.rating ?? "?"}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
