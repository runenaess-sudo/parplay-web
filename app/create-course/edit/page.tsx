"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function EditCoursePage() {
    const [courses, setCourses] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const supabase = supabaseBrowser;

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            const { data, error } = await supabase
                .from("courses")
                .select("*")
                .eq("created_by", session.user.id)
                .order("created_at", { ascending: false });

            if (!error && data) {
                const sorted = [
                    ...data.filter((c) => !c.is_published),
                    ...data.filter((c) => c.is_published),
                ];
                setCourses(sorted);
            }

            setLoading(false);
        }

        load();
    }, []);

    const filtered = courses.filter((c) =>
        c.name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-6 max-w-2xl mx-auto text-white">
            <h1 className="text-3xl font-bold mb-6">Edit Existing Course</h1>

            <p className="text-gray-400 mb-6">
                Select one of your courses to continue editing.
            </p>

            {/* SEARCH */}
            <input
                type="text"
                placeholder="Search your courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 rounded-md bg-gray-900 border border-gray-700 text-white mb-6"
            />

            {/* LIST */}
            {loading && <div className="text-gray-400">Loading courses...</div>}

            {!loading && filtered.length === 0 && (
                <div className="text-gray-500">No courses found.</div>
            )}

            <div className="flex flex-col gap-3">
                {filtered.map((course) => {
                    const isDraft = !course.is_published;

                    return (
                        <Link
                            key={course.id}
                            href={`/create-course/editor/${course.id}`}
                            className={`p-4 rounded-lg border transition ${isDraft
                                ? "bg-red-900/20 border-red-700/40 hover:bg-red-900/30"
                                : "bg-yellow-900/20 border-yellow-700/40 hover:bg-yellow-900/30"
                                }`}
                        >
                            <div className="font-semibold">{course.name}</div>

                            {course.location && (
                                <div className="text-sm text-gray-400">
                                    {course.location}
                                </div>
                            )}

                            <div className="text-xs mt-1 opacity-70">
                                {isDraft ? "Draft" : "Published"}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
