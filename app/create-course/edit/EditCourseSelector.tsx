"use client";

import type { ManageableCourse } from "@/lib/course-manager-auth";
import Link from "next/link";
import { useMemo, useState } from "react";

export function EditCourseSelector({ courses }: { courses: ManageableCourse[] }) {
    const [search, setSearch] = useState("");
    const filtered = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        if (!query) return courses;
        return courses.filter((course) => course.name.toLocaleLowerCase().includes(query));
    }, [courses, search]);

    return <>
        <input type="text" placeholder="Search your courses..." value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mb-6 w-full rounded-md border border-gray-700 bg-gray-900 px-4 py-2 text-white" />

        {filtered.length === 0 && <div className="text-gray-500">No courses found.</div>}

        <div className="flex flex-col gap-3">
            {filtered.map((course) => {
                const isDraft = !course.is_published;
                return <Link key={course.id} href={`/create-course/editor/${course.id}`}
                    className={`rounded-lg border p-4 transition ${isDraft
                        ? "border-red-700/40 bg-red-900/20 hover:bg-red-900/30"
                        : "border-yellow-700/40 bg-yellow-900/20 hover:bg-yellow-900/30"
                    }`}>
                    <div className="font-semibold">{course.name}</div>
                    {course.location && <div className="text-sm text-gray-400">{course.location}</div>}
                    <div className="mt-1 text-xs opacity-70">{isDraft ? "Draft" : "Published"}</div>
                </Link>;
            })}
        </div>
    </>;
}
