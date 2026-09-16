"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NewCoursePage() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [location, setLocation] = useState("");
    const [timezone, setTimezone] = useState("");
    const [timezoneOptions, setTimezoneOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        void supabaseBrowser.rpc("get_iana_timezones_v1").then(({ data, error: timezoneError }) => {
            if (!timezoneError) setTimezoneOptions((data ?? []).map((row: { timezone: string }) => row.timezone));
        });
    }, []);

    async function createCourse(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const supabase = supabaseBrowser;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            setError("You must be logged in.");
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from("courses")
            .insert({
                name,
                location,
                created_by: session.user.id,
                is_published: false,
                timezone: timezone || null,
            })
            .select()
            .single();

        if (error || !data) {
            setError("Failed to create course.");
            setLoading(false);
            return;
        }

        // Redirect to Holes step (same as app)
        router.push(`/future/create-course/holes?courseId=${data.id}`);
    }

    return (
        <div className="p-6 max-w-xl mx-auto text-white">
            <h1 className="text-3xl font-bold mb-6">Create a New Course</h1>

            <p className="text-gray-400 mb-8">
                Start by entering the basic information for your new course.
            </p>

            <form onSubmit={createCourse} className="flex flex-col gap-6">

                {/* NAME */}
                <div>
                    <label className="block text-sm mb-1">Course Name</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 rounded-md bg-gray-900 border border-gray-700 text-white"
                        placeholder="Example: Blue Mountain DGC"
                    />
                </div>

                <div>
                    <label className="block text-sm mb-1">Local timezone</label>
                    <select value={timezone} onChange={(event) => setTimezone(event.target.value)}
                        className="w-full px-4 py-2 rounded-md bg-gray-900 border border-gray-700 text-white">
                        <option value="">Not set</option>
                        {timezoneOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Select the course timezone, not your current timezone.</p>
                </div>

                {/* LOCATION */}
                <div>
                    <label className="block text-sm mb-1">Location</label>
                    <input
                        type="text"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full px-4 py-2 rounded-md bg-gray-900 border border-gray-700 text-white"
                        placeholder="City, Country"
                    />
                </div>

                {/* ERROR */}
                {error && (
                    <div className="text-red-400 text-sm">{error}</div>
                )}

                {/* SUBMIT */}
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-medium"
                >
                    {loading ? "Creating..." : "Create Course"}
                </button>
            </form>
        </div>
    );
}
