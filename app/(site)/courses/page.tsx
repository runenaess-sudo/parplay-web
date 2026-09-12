"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 6;

type CourseSummary = {
    id: string;
    name: string;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    is_published: boolean;
    distance?: number;
};

type CourseCardData = CourseSummary & {
    image: string | null;
    layoutName: string | null;
    holes: number | null;
    par: number | null;
    color: string;
    rating: number | null;
};

type UserPosition = { lat: number; lon: number } | null;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const radius = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
        * Math.sin(dLon / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CoursesPage() {
    const [courses, setCourses] = useState<CourseSummary[]>([]);
    const [details, setDetails] = useState<Record<string, CourseCardData>>({});
    const [search, setSearch] = useState("");
    const [userPosition, setUserPosition] = useState<UserPosition>(null);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        async function loadSummaries() {
            const { data, error: loadError } = await supabaseBrowser
                .from("courses")
                .select("id,name,location,latitude,longitude,is_published")
                .eq("is_published", true);
            if (!active) return;
            if (loadError) {
                setError("Unable to load courses.");
                setCourses([]);
            } else {
                setCourses((data ?? []) as CourseSummary[]);
            }
            setLoading(false);
        }
        void loadSummaries();
        return () => { active = false; };
    }, []);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => setUserPosition({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
            }),
            () => setUserPosition(null)
        );
    }, []);

    const orderedCourses = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        if (query) {
            return courses.filter((course) =>
                course.name.toLocaleLowerCase().includes(query)
                || course.location?.toLocaleLowerCase().includes(query)
            );
        }
        if (!userPosition) return [];
        return courses.map((course) => ({
            ...course,
            distance: course.latitude == null || course.longitude == null
                ? Number.POSITIVE_INFINITY
                : distanceKm(userPosition.lat, userPosition.lon, course.latitude, course.longitude),
        })).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }, [courses, search, userPosition]);

    const visibleSummaries = useMemo(
        () => orderedCourses.slice(0, visibleCount),
        [orderedCourses, visibleCount]
    );

    useEffect(() => {
        let active = true;
        const missingIds = visibleSummaries
            .map((course) => course.id)
            .filter((courseId) => !details[courseId]);
        if (missingIds.length === 0) return;

        async function loadCardDetails() {
            setDetailsLoading(true);
            const [imagesResult, layoutsResult] = await Promise.all([
                supabaseBrowser.from("course_images")
                    .select("course_id,image_url,sort_order")
                    .in("course_id", missingIds)
                    .order("sort_order", { ascending: true }),
                supabaseBrowser.from("course_layouts")
                    .select("course_id,name,hole_count,par_total,color,is_default,par_rating")
                    .in("course_id", missingIds),
            ]);
            if (!active) return;
            if (imagesResult.error || layoutsResult.error) {
                setError("Unable to load course details.");
                setDetailsLoading(false);
                return;
            }
            const next: Record<string, CourseCardData> = {};
            for (const summary of visibleSummaries.filter((course) => missingIds.includes(course.id))) {
                const image = imagesResult.data?.find((row) => row.course_id === summary.id);
                const courseLayouts = layoutsResult.data?.filter((row) => row.course_id === summary.id) ?? [];
                const layout = courseLayouts.find((row) => row.is_default) ?? courseLayouts[0];
                next[summary.id] = {
                    ...summary,
                    image: image?.image_url ?? null,
                    layoutName: layout?.name ?? null,
                    holes: layout?.hole_count ?? null,
                    par: layout?.par_total ?? null,
                    color: layout?.color ?? "#333",
                    rating: layout?.par_rating ?? null,
                };
            }
            setDetails((current) => ({ ...current, ...next }));
            setDetailsLoading(false);
        }
        void loadCardDetails();
        return () => { active = false; };
    }, [details, visibleSummaries]);

    const visibleCourses = visibleSummaries
        .map((summary) => details[summary.id])
        .filter((course): course is CourseCardData => Boolean(course));
    const hasMore = visibleCount < orderedCourses.length;
    const isSearching = search.trim().length > 0;

    return <div className="space-y-10 p-6">
        <input type="text" placeholder="Search courses..." value={search}
            onChange={(event) => {
                setSearch(event.target.value);
                setVisibleCount(PAGE_SIZE);
            }}
            className="w-full rounded-xl bg-neutral-900/70 px-4 py-3 text-white placeholder-gray-400 backdrop-blur-sm focus:outline-none" />

        <section>
            <h2 className="mb-4 text-2xl font-semibold">
                {isSearching ? "Search Results" : "Nearby Courses"}
            </h2>
            {loading && <div className="text-gray-400">Loading courses...</div>}
            {!loading && !isSearching && !userPosition && (
                <div className="text-gray-400">Allow location access to see nearby courses.</div>
            )}
            {error && <div className="text-red-300">{error}</div>}
            {!loading && orderedCourses.length === 0 && (isSearching || userPosition) && (
                <div className="text-gray-400">No courses found</div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visibleCourses.map((course) => <CourseCard key={course.id} course={course} />)}
            </div>
            {detailsLoading && <div className="mt-4 text-gray-400">Loading course details...</div>}
            {hasMore && !detailsLoading && (
                <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                    className="mt-6 rounded-lg border border-white/20 bg-white/10 px-5 py-2 font-semibold text-white hover:bg-white/15">
                    See More
                </button>
            )}
        </section>
    </div>;
}

function CourseCard({ course }: { course: CourseCardData }) {
    return <Link href={`/courses/${course.id}`}
        className="group block overflow-hidden rounded-2xl shadow-lg transition-all duration-300 hover:shadow-2xl">
        <div className="relative h-56 w-full">
            {course.image && <Image src={course.image} alt={course.name} fill sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover transition duration-500 group-hover:scale-105" />}
            <div className="absolute inset-0 bg-black/40 transition group-hover:bg-black/50" />
            {course.layoutName && <div className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold text-white shadow"
                style={{ backgroundColor: course.color }}>{course.layoutName}</div>}
            {course.rating != null && <div className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-black shadow">
                ★ {course.rating}
            </div>}
            <div className="absolute bottom-3 left-3 text-white drop-shadow">
                <div className="text-lg font-bold">{course.name}</div>
                <div className="text-sm opacity-80">{course.location}</div>
            </div>
        </div>
        <div className="bg-neutral-900/70 p-4 text-white backdrop-blur-sm">
            <div className="flex gap-6 text-sm">
                {course.holes != null && <span>{course.holes} holes</span>}
                {course.par != null && <span>Par {course.par}</span>}
            </div>
            <div className="mt-4 font-semibold text-blue-300 group-hover:underline">View course →</div>
        </div>
    </Link>;
}
