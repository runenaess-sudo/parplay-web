"use client";

import { supabaseBrowser } from "@/src/lib/supabase-browser";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Course = {
    id: string;
    name: string;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    is_published: boolean;
    image: string | null;
    layoutName: string | null;
    holes: number | null;
    par: number | null;
    color: string;
    rating: number | null;
    distance?: number;
};

type UserPos = {
    lat: number;
    lon: number;
} | null;

export default function CoursesPage() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [filtered, setFiltered] = useState<Course[]>([]);
    const [nearby, setNearby] = useState<Course[]>([]);
    const [search, setSearch] = useState<string>("");
    const [userPos, setUserPos] = useState<UserPos>(null);

    // Fetch courses from Supabase
    useEffect(() => {
        async function load() {
            const supabase = supabaseBrowser;

            const { data: coursesData } = await supabase
                .from("courses")
                .select("id, name, location, latitude, longitude, is_published")
                .eq("is_published", true);

            if (!coursesData) {
                setCourses([]);
                setFiltered([]);
                return;
            }

            const { data: images } = await supabase
                .from("course_images")
                .select("course_id, image_url, sort_order");

            const { data: layouts } = await supabase
                .from("course_layouts")
                .select("course_id, name, hole_count, par_total, color, is_default, par_rating");

            const enriched: Course[] = coursesData.map((course: any) => {
                const imgs = images?.filter((i: any) => i.course_id === course.id) || [];
                const primary = imgs.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];

                const ls = layouts?.filter((l: any) => l.course_id === course.id) || [];
                const layout = ls.find((l: any) => l.is_default) || ls[0];

                return {
                    id: course.id,
                    name: course.name,
                    location: course.location ?? null,
                    latitude: course.latitude ?? null,
                    longitude: course.longitude ?? null,
                    is_published: course.is_published,
                    image: primary?.image_url ?? null,
                    layoutName: layout?.name ?? null,
                    holes: layout?.hole_count ?? null,
                    par: layout?.par_total ?? null,
                    color: layout?.color ?? "#333",
                    rating: layout?.par_rating ?? null,
                };
            });

            setCourses(enriched);
            setFiltered(enriched);
        }

        load();
    }, []);

    // Search filter
    useEffect(() => {
        if (!search) {
            setFiltered(courses);
            return;
        }

        const s = search.toLowerCase();
        setFiltered(
            courses.filter(
                (c) =>
                    c.name.toLowerCase().includes(s) ||
                    c.location?.toLowerCase().includes(s)
            )
        );
    }, [search, courses]);

    // Get user position
    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserPos({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                });
            },
            () => {
                setUserPos(null);
            }
        );
    }, []);

    // Calculate distance
    function dist(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Nearby logic
    useEffect(() => {
        if (!userPos || courses.length === 0) return;

        const withDistance: Course[] = courses
            .map((c) => {
                if (c.latitude == null || c.longitude == null) {
                    return { ...c, distance: Number.POSITIVE_INFINITY };
                }
                return {
                    ...c,
                    distance: dist(userPos.lat, userPos.lon, c.latitude, c.longitude),
                };
            })
            .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
            .slice(0, 9);

        setNearby(withDistance);
    }, [userPos, courses]);

    return (
        <div className="p-6 space-y-10">
            {/* SEARCH FIELD */}
            <div>
                <input
                    type="text"
                    placeholder="Search courses..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-neutral-900/70 text-white placeholder-gray-400 backdrop-blur-sm focus:outline-none"
                />
            </div>

            {/* NEARBY SECTION */}
            {nearby.length > 0 && (
                <div>
                    <h2 className="text-2xl font-semibold mb-4">Nearby Courses</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {nearby.map((course) => (
                            <CourseCard key={course.id} course={course} />
                        ))}
                    </div>
                </div>
            )}

            {/* ALL COURSES */}
            <div>
                <h2 className="text-2xl font-semibold mb-4">All Courses</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((course) => (
                        <CourseCard key={course.id} course={course} />
                    ))}
                </div>
            </div>
        </div>
    );
}

// PREMIUM COURSE CARD
function CourseCard({ course }: { course: Course }) {
    return (
        <Link
            href={`/courses/${course.id}`}
            className="group block rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300"
        >
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

                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition" />

                <div
                    className="absolute top-3 left-3 px-3 py-1 rounded-full text-white text-xs font-semibold shadow"
                    style={{ backgroundColor: course.color }}
                >
                    {course.layoutName}
                </div>

                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-white/90 text-black text-xs font-semibold shadow">
                    ⭐ {course.rating}
                </div>

                <div className="absolute bottom-3 left-3 text-white drop-shadow">
                    <div className="text-lg font-bold">{course.name}</div>
                    <div className="text-sm opacity-80">{course.location}</div>
                </div>
            </div>

            <div className="p-4 bg-neutral-900/70 text-white backdrop-blur-sm">
                <div className="flex gap-6 text-sm">
                    <span className="flex items-center gap-1">🕳 {course.holes}</span>
                    <span className="flex items-center gap-1">⛳ Par {course.par}</span>
                </div>

                <div className="mt-4 text-blue-300 font-semibold group-hover:underline">
                    View course →
                </div>
            </div>
        </Link>
    );
}
