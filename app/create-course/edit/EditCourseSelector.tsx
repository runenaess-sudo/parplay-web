"use client";

import type { CourseBuild } from "@/lib/course-manager-auth";
import Link from "next/link";
import { useMemo, useState } from "react";

export function EditCourseSelector({ courses }: { courses: CourseBuild[] }) {
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

        {filtered.length === 0 && <div className="text-gray-500">No matching course builds.</div>}

        {[true, false].map(manageable => <section key={String(manageable)} className="mb-8 space-y-3">
            <h2 className="text-xl font-semibold">{manageable ? 'Courses I can manage' : 'Courses I have built previously'}</h2>
            {!filtered.some(course => course.canManage === manageable) && <p className="text-sm text-gray-400">No matching courses.</p>}
            <div className="flex flex-col gap-3">
            {filtered.filter(course => course.canManage === manageable).map((course) => <article key={course.id}
                className={`rounded-lg border p-4 ${course.is_published
                    ? "border-yellow-700/40 bg-yellow-900/20"
                    : "border-red-700/40 bg-red-900/20"
                }`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="font-semibold">{course.name}</div>
                        {course.location && <div className="text-sm text-gray-400">{course.location}</div>}
                        <div className="mt-1 text-xs text-gray-400">
                            {course.is_published ? "Published" : "Draft"}
                            {!course.canManage && " · Historical contribution - Read Only"}
                        </div>
                    </div>
                    {course.canManage
                        ? <Link href={`/club-manager/courses/${course.id}`}
                            className="shrink-0 rounded-lg bg-blue-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                            Manage Course
                        </Link>
                        : course.is_published
                            ? <Link href={`/courses/${course.id}`}
                                className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-center text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
                                View course
                            </Link>
                            : <span className="shrink-0 text-sm text-gray-400">Read Only</span>}
                </div>
            </article>)}
        </div>
        </section>)}
    </>;
}
