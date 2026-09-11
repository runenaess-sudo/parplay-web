"use client";

import { useEffect, useState } from "react";

type ClaimStatus = "pending" | "accepted" | "declined" | "all";

type CourseClaim = {
    id: string;
    status: Exclude<ClaimStatus, "all">;
    created_at: string;
    decided_at: string | null;
    requested_by: string;
    course_id: string;
    club_id: string | null;
    course_name: string | null;
    club_name: string | null;
    requester_name: string | null;
};

const filters: Array<{ value: ClaimStatus; label: string }> = [
    { value: "pending", label: "Pending" },
    { value: "accepted", label: "Accepted" },
    { value: "declined", label: "Declined" },
    { value: "all", label: "All" },
];

function formatDate(value: string | null) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

export default function CourseClaimsPage() {
    const [filter, setFilter] = useState<ClaimStatus>("pending");
    const [claims, setClaims] = useState<CourseClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [actingOn, setActingOn] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    async function loadClaims(status: ClaimStatus) {
        try {
            const response = await fetch(`/api/admin/course-claims?status=${status}`, {
                cache: "no-store",
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Could not load claims.");
            setClaims(payload.claims ?? []);
        } catch (loadError: unknown) {
            setClaims([]);
            setError(loadError instanceof Error ? loadError.message : "Could not load claims.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let active = true;

        async function refreshClaims() {
            try {
                const response = await fetch(`/api/admin/course-claims?status=${filter}`, {
                    cache: "no-store",
                });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || "Could not load claims.");
                if (active) setClaims(payload.claims ?? []);
            } catch (loadError: unknown) {
                if (active) {
                    setClaims([]);
                    setError(
                        loadError instanceof Error ? loadError.message : "Could not load claims."
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        refreshClaims();
        return () => {
            active = false;
        };
    }, [filter]);

    async function decideClaim(claim: CourseClaim, decision: "accepted" | "declined") {
        const verb = decision === "accepted" ? "accept" : "decline";
        const confirmed = window.confirm(
            `Are you sure you want to ${verb} the claim for ${claim.course_name || claim.course_id}?`
        );
        if (!confirmed) return;

        setActingOn(claim.id);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch("/api/admin/course-claims", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ claimId: claim.id, decision }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Could not update claim.");

            setSuccess(`Claim ${decision}.`);
            setLoading(true);
            await loadClaims(filter);
        } catch (decisionError: unknown) {
            setError(
                decisionError instanceof Error
                    ? decisionError.message
                    : "Could not update claim."
            );
        } finally {
            setActingOn(null);
        }
    }

    return (
        <main className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">
                    Admin queue
                </p>
                <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Course Claims</h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-300">
                    Review ownership claims and assign accepted courses through the protected database workflow.
                </p>
            </section>

            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Claim status">
                {filters.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={filter === item.value}
                        onClick={() => {
                            setSuccess(null);
                            setError(null);
                            setLoading(true);
                            setFilter(item.value);
                        }}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                            filter === item.value
                                ? "bg-blue-600 text-white"
                                : "border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {success && (
                <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    {success}
                </p>
            )}
            {error && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                </p>
            )}

            {loading ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300">
                    Loading claims...
                </p>
            ) : claims.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300">
                    No {filter === "all" ? "course" : filter} claims found.
                </p>
            ) : (
                <div className="space-y-3">
                    {claims.map((claim) => (
                        <article
                            key={claim.id}
                            className="rounded-2xl border border-white/10 bg-black/20 p-5 shadow-xl backdrop-blur"
                        >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-lg font-semibold text-white">
                                            {claim.course_name || "Unnamed course"}
                                        </h2>
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                            claim.status === "pending"
                                                ? "bg-amber-500/15 text-amber-200"
                                                : claim.status === "accepted"
                                                    ? "bg-emerald-500/15 text-emerald-200"
                                                    : "bg-red-500/15 text-red-200"
                                        }`}>
                                            {claim.status}
                                        </span>
                                    </div>

                                    <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
                                        <div><dt className="text-gray-500">Club</dt><dd className="break-words text-gray-200">{claim.club_name || claim.club_id || "Unassigned"}</dd></div>
                                        <div><dt className="text-gray-500">Requested by</dt><dd className="break-words text-gray-200">{claim.requester_name || claim.requested_by}</dd></div>
                                        <div><dt className="text-gray-500">Requested</dt><dd className="text-gray-200">{formatDate(claim.created_at)}</dd></div>
                                        <div><dt className="text-gray-500">Decided</dt><dd className="text-gray-200">{formatDate(claim.decided_at)}</dd></div>
                                        <div><dt className="text-gray-500">Claim ID</dt><dd className="break-all font-mono text-xs text-gray-400">{claim.id}</dd></div>
                                        <div><dt className="text-gray-500">Course ID</dt><dd className="break-all font-mono text-xs text-gray-400">{claim.course_id}</dd></div>
                                    </dl>
                                </div>

                                {claim.status === "pending" && (
                                    <div className="flex shrink-0 gap-2">
                                        <button
                                            type="button"
                                            disabled={actingOn === claim.id}
                                            onClick={() => decideClaim(claim, "declined")}
                                            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                                        >
                                            Decline
                                        </button>
                                        <button
                                            type="button"
                                            disabled={actingOn === claim.id || !claim.club_id}
                                            onClick={() => decideClaim(claim, "accepted")}
                                            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                                            title={!claim.club_id ? "Assign a club before accepting" : undefined}
                                        >
                                            {actingOn === claim.id ? "Working..." : "Accept"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </main>
    );
}
