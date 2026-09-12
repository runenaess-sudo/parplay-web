import { supabaseServer } from "@/lib/supabase-server";
import Image from "next/image";
import { notFound } from "next/navigation";

export default async function CourseDetailPage({
    params,
}: {
    params: Promise<{ courseId: string }>;
}) {
    const { courseId } = await params;
    const supabase = await supabaseServer();
    const [courseResult, imagesResult, layoutsResult] = await Promise.all([
        supabase
            .from("courses")
            .select("id,name,location,is_published")
            .eq("id", courseId)
            .eq("is_published", true)
            .maybeSingle(),
        supabase
            .from("course_images")
            .select("image_url,sort_order")
            .eq("course_id", courseId)
            .order("sort_order", { ascending: true }),
        supabase
            .from("course_layouts")
            .select("id,name,hole_count,par_total,color,is_default,par_rating")
            .eq("course_id", courseId),
    ]);

    if (courseResult.error || !courseResult.data) notFound();

    const course = courseResult.data;
    const primaryImage = imagesResult.data?.[0]?.image_url ?? null;
    const layouts = [...(layoutsResult.data ?? [])].sort(
        (a, b) => Number(b.is_default) - Number(a.is_default)
    );

    return (
        <main className="mx-auto max-w-5xl space-y-8 p-6">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/70">
                {primaryImage && (
                    <div className="relative h-64 w-full sm:h-96">
                        <Image
                            src={primaryImage}
                            alt={course.name}
                            fill
                            priority
                            sizes="(max-width: 1024px) 100vw, 1024px"
                            className="object-cover"
                        />
                    </div>
                )}
                <div className="space-y-2 p-6">
                    <h1 className="text-3xl font-bold text-white">{course.name}</h1>
                    {course.location && <p className="text-gray-300">{course.location}</p>}
                </div>
            </section>

            <section>
                <h2 className="mb-4 text-2xl font-semibold text-white">Layouts</h2>
                {layouts.length === 0 ? (
                    <p className="text-gray-400">No layouts are available.</p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {layouts.map((layout) => (
                            <article
                                key={layout.id}
                                className="rounded-xl border border-white/10 bg-neutral-900/70 p-5 text-white"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-lg font-semibold">{layout.name}</h3>
                                    {layout.is_default && (
                                        <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold">
                                            Default
                                        </span>
                                    )}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-300">
                                    {layout.hole_count != null && <span>{layout.hole_count} holes</span>}
                                    {layout.par_total != null && <span>Par {layout.par_total}</span>}
                                    {layout.par_rating != null && <span>Rating {layout.par_rating}</span>}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}
