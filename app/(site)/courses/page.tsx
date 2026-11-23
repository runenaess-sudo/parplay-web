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
    layouts: number;
    holes: number | null;
};

type UserPosition = { lat: number; lon: number } | null;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const radius = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
        * Math.sin(dLon / 2) ** 2;
    const clamped = Math.min(1, Math.max(0, a));
    return radius * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}

function validLocation(latitude: number | null, longitude: number | null) {
    return latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
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
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (position) => setUserPosition({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
            }),
            () => setUserPosition(null),
            { timeout: 10000, maximumAge: 60000 }
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
        if (!userPosition) return courses;
        return courses.map((course) => ({
            ...course,
            distance: !validLocation(course.latitude, course.longitude)
                ? Number.POSITIVE_INFINITY
                : distanceKm(userPosition.lat, userPosition.lon, course.latitude!, course.longitude!),
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
                    .select("id,course_id,hole_count,is_default")
                    .in("course_id", missingIds).eq("published", true).order("id"),
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
                const layout = courseLayouts.find((row) => row.is_default && row.hole_count != null)
                    ?? [...courseLayouts].filter(row => row.hole_count != null).sort((a,b) => (b.hole_count ?? 0)-(a.hole_count ?? 0))[0];
                next[summary.id] = {
                    ...summary,
                    image: image?.image_url ?? null,
                    layouts: courseLayouts.length,
                    holes: layout?.hole_count ?? null,
                };
            }
            setDetails((current) => ({ ...current, ...next }));
            setDetailsLoading(false);
        }
        void loadCardDetails();
        return () => { active = false; };
    }, [details, visibleSummaries]);

    const visibleCourses = visibleSummaries
        .map((summary): CourseCardData | undefined => details[summary.id] ? { ...details[summary.id], distance: userPosition && validLocation(summary.latitude, summary.longitude)
            ? distanceKm(userPosition.lat, userPosition.lon, summary.latitude!, summary.longitude!) : undefined } : undefined)
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
                {isSearching ? "Search Results" : userPosition ? "Nearby Courses" : "Courses"}
            </h2>
            {loading && <div className="text-gray-400">Loading courses...</div>}
            {error && <div className="text-red-300">{error}</div>}
            {!loading && orderedCourses.length === 0 && (
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
            <div className="absolute bottom-3 left-3 text-white drop-shadow">
                <div className="text-lg font-bold">{course.name}</div>
                <div className="text-sm opacity-80">{course.location}</div>
            </div>
        </div>
        <div className="bg-neutral-900/70 p-4 text-white backdrop-blur-sm">
            <div className="flex items-center gap-x-3 whitespace-nowrap text-xs text-gray-300 sm:text-sm">
                <span>{course.layouts} {course.layouts === 1 ? 'layout' : 'layouts'}</span>
                <span>{course.holes ?? 'N/A'} holes</span>
                {course.distance != null && Number.isFinite(course.distance) && <span className="inline-flex items-center gap-1" title="Straight-line distance from your location">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 shrink-0"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
                    {course.distance.toFixed(1)} km
                </span>}
            </div>
            <div className="mt-4 font-semibold text-blue-300 group-hover:underline">View course →</div>
        </div>
    </Link>;
}
