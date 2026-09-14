"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ManagedCourseOption = {
    id: string;
    name: string;
    clubName: string | null;
    isPublished: boolean;
};

export default function ManagedCourseSelector({
    courses,
    selectedCourseId,
    clubId,
}: {
    courses: ManagedCourseOption[];
    selectedCourseId: string;
    clubId: string | null;
}) {
    const [search, setSearch] = useState("");
    const filteredCourses = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        if (!query) return courses;
        return courses.filter((course) => course.name.toLocaleLowerCase().includes(query));
    }, [courses, search]);

    function courseHref(courseId: string) {
        const params = new URLSearchParams({ courseId });
        if (clubId) params.set("clubId", clubId);
        return `/club-manager?${params.toString()}`;
    }

    return <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <div className="flex items-end justify-between gap-4">
            <div>
                <h2 className="text-lg font-semibold">Managed courses</h2>
                <p className="mt-1 text-sm text-gray-400">Select a course to manage.</p>
            </div>
            <span className="text-sm text-gray-400">{courses.length}</span>
        </div>
        <label className="sr-only" htmlFor="managed-course-search">Search managed courses</label>
        <input
            id="managed-course-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search courses..."
            className="mt-4 w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-400"
        />
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {filteredCourses.map((course) => {
                const selected = course.id === selectedCourseId;
                return <Link
                    key={course.id}
                    href={courseHref(course.id)}
                    aria-current={selected ? "page" : undefined}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition ${selected
                        ? "border-blue-400/60 bg-blue-500/15"
                        : "border-white/10 bg-black/15 hover:border-white/20 hover:bg-white/5"
                    }`}
                >
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{course.name}</p>
                        {course.clubName && <p className="truncate text-xs text-gray-400">{course.clubName}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${course.isPublished
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-white/10 text-gray-300"
                    }`}>{course.isPublished ? "Published" : "Draft"}</span>
                </Link>;
            })}
            {filteredCourses.length === 0 && <p className="py-4 text-center text-sm text-gray-400">No matching managed courses.</p>}
        </div>
    </section>;
}
