import { supabaseServer } from "@/src/lib/supabase-server";

export default async function CoursesPage() {
    const supabase = await supabaseServer();

    const { data: courses, error } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        return <div className="p-6">Failed to load courses.</div>;
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Courses</h1>

            {courses.length === 0 && (
                <p className="text-gray-600">No courses found.</p>
            )}

            <ul className="space-y-3">
                {courses.map((course: any) => (
                    <li
                        key={course.id}
                        className="p-4 rounded-lg bg-white shadow border"
                    >
                        <div className="font-semibold">{course.name}</div>
                        <div className="text-sm text-gray-600">
                            {course.location || "Unknown location"}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
