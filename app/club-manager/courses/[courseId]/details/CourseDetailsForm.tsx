"use client";

import { useState } from "react";

type CourseDetails = {
    name: string;
    location: string;
    description: string;
    timezone: string;
};

export default function CourseDetailsForm({ courseId, initialDetails, timezoneOptions }: {
    courseId: string;
    initialDetails: CourseDetails;
    timezoneOptions: string[];
}) {
    const [details, setDetails] = useState(initialDetails);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    async function save(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            const response = await fetch(`/api/course-details/${encodeURIComponent(courseId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(details),
            });
            const body = await response.json() as { error?: string; course?: CourseDetails };
            if (!response.ok || !body.course) {
                setError(body.error ?? "Course details could not be saved.");
                return;
            }
            setDetails({
                name: body.course.name,
                location: body.course.location,
                description: body.course.description ?? "",
                timezone: body.course.timezone ?? "",
            });
            setSaved(true);
        } catch {
            setError("Course details could not be saved.");
        } finally {
            setSaving(false);
        }
    }

    const inputClass = "mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-gray-500 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15";

    return <form onSubmit={save} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
        <div className="grid gap-5">
            <label className="text-sm font-medium text-gray-200">
                Course name
                <input required type="text" value={details.name}
                    onChange={(event) => setDetails((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Course name" className={inputClass} />
            </label>
            <label className="text-sm font-medium text-gray-200">
                Location
                <input required type="text" value={details.location}
                    onChange={(event) => setDetails((current) => ({ ...current, location: event.target.value }))}
                    placeholder="City, country" className={inputClass} />
            </label>
            <label className="text-sm font-medium text-gray-200">
                Description
                <textarea rows={5} value={details.description}
                    onChange={(event) => setDetails((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Describe the course" className={`${inputClass} resize-y leading-6`} />
            </label>
            <label className="text-sm font-medium text-gray-200">
                Local timezone
                <select value={details.timezone}
                    onChange={(event) => setDetails((current) => ({ ...current, timezone: event.target.value }))}
                    className={inputClass}>
                    <option value="">Not set</option>
                    {timezoneOptions.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
                </select>
                <span className="mt-2 block text-xs font-normal text-gray-500">Used for course-local activity by weekday and hour.</span>
            </label>
        </div>

        {saved && <p role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Course details saved.</p>}
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

        <div className="mt-6 flex justify-end">
            <button type="submit" disabled={saving}
                className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? "Saving..." : "Save changes"}
            </button>
        </div>
    </form>;
}
