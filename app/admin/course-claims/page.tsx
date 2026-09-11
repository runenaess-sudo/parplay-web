"use client";

import { useEffect, useState } from "react";

type ClaimStatus = "pending" | "accepted" | "declined" | "all";
type ContactState = "unknown" | "known" | "review" | "all";

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
    course_created_by: string | null;
    creator_name: string | null;
    owner_contact_status: "known" | "unknown" | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    contact_organization: string | null;
    contact_role: string | null;
    invitation: {
        id: string;
        recipient_email: string;
        delivery_status: "reserved" | "sent" | "failed";
        sent_at: string | null;
        expires_at: string;
        consumed_at: string | null;
        revoked_at: string | null;
    } | null;
};

type ClubOption = { id: string; name: string };

type PreparationForm = {
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    contactOrganization: string;
    contactRole: string;
    selectedClubId: string;
    selectedClubName: string;
    newClubName: string;
};

const filters: Array<{ value: ClaimStatus; label: string }> = [
    { value: "pending", label: "Pending" },
    { value: "accepted", label: "Accepted" },
    { value: "declined", label: "Declined" },
    { value: "all", label: "All" },
];

const contactFilters: Array<{ value: ContactState; label: string }> = [
    { value: "all", label: "All owner states" },
    { value: "unknown", label: "Owner information missing" },
    { value: "known", label: "Contact ready" },
    { value: "review", label: "Needs review" },
];

function formatDate(value: string | null) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function invitationRequirements(claim: CourseClaim) {
    const missing: string[] = [];
    if (claim.owner_contact_status !== "known") missing.push("Confirm owner contact");
    if (!claim.contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claim.contact_email)) {
        missing.push("Add a valid owner email");
    }
    if (!claim.club_id) missing.push("Assign a club first");
    return missing;
}

export default function CourseClaimsPage() {
    const [filter, setFilter] = useState<ClaimStatus>("pending");
    const [contactFilter, setContactFilter] = useState<ContactState>("all");
    const [claims, setClaims] = useState<CourseClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [actingOn, setActingOn] = useState<string | null>(null);
    const [preparingClaimId, setPreparingClaimId] = useState<string | null>(null);
    const [preparationForm, setPreparationForm] = useState<PreparationForm | null>(null);
    const [clubSearch, setClubSearch] = useState("");
    const [clubResults, setClubResults] = useState<ClubOption[]>([]);
    const [searchingClubs, setSearchingClubs] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    async function loadClaims(status: ClaimStatus, ownerState: ContactState) {
        try {
            const response = await fetch(
                `/api/admin/course-claims?status=${status}&contactState=${ownerState}`,
                {
                cache: "no-store",
                }
            );
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Could not load claims.");
            setClaims(payload.claims ?? []);
            setLoadFailed(false);
        } catch (loadError: unknown) {
            setClaims([]);
            setLoadFailed(true);
            setError(loadError instanceof Error ? loadError.message : "Could not load claims.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let active = true;

        async function refreshClaims() {
            try {
                const response = await fetch(
                    `/api/admin/course-claims?status=${filter}&contactState=${contactFilter}`,
                    { cache: "no-store" }
                );
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || "Could not load claims.");
                if (active) {
                    setClaims(payload.claims ?? []);
                    setLoadFailed(false);
                }
            } catch (loadError: unknown) {
                if (active) {
                    setClaims([]);
                    setLoadFailed(true);
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
    }, [contactFilter, filter]);

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
            await loadClaims(filter, contactFilter);
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

    function openPreparation(claim: CourseClaim) {
        setPreparingClaimId(claim.id);
        setPreparationForm({
            contactName: claim.contact_name ?? "",
            contactEmail: claim.contact_email ?? "",
            contactPhone: claim.contact_phone ?? "",
            contactOrganization: claim.contact_organization ?? "",
            contactRole: claim.contact_role ?? "",
            selectedClubId: claim.club_id ?? "",
            selectedClubName: claim.club_name ?? "",
            newClubName: "",
        });
        setClubSearch(claim.club_name ?? "");
        setClubResults([]);
        setError(null);
        setSuccess(null);
    }

    async function searchClubs() {
        const search = clubSearch.trim();
        if (search.length < 2) {
            setClubResults([]);
            return;
        }

        setSearchingClubs(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/clubs?search=${encodeURIComponent(search)}`, {
                cache: "no-store",
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Could not search clubs.");
            setClubResults(payload.clubs ?? []);
        } catch (searchError: unknown) {
            setError(searchError instanceof Error ? searchError.message : "Could not search clubs.");
        } finally {
            setSearchingClubs(false);
        }
    }

    async function prepareInvitation(claim: CourseClaim) {
        if (!preparationForm) return;

        setActingOn(claim.id);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch("/api/admin/course-claims", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "prepare",
                    claimId: claim.id,
                    clubId: preparationForm.selectedClubId || null,
                    newClubName: preparationForm.newClubName || null,
                    contactName: preparationForm.contactName,
                    contactEmail: preparationForm.contactEmail,
                    contactPhone: preparationForm.contactPhone,
                    contactOrganization: preparationForm.contactOrganization,
                    contactRole: preparationForm.contactRole,
                }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Could not prepare invitation.");

            setSuccess("Ownership case is ready for invitation. No invitation has been sent.");
            setPreparingClaimId(null);
            setPreparationForm(null);
            setLoading(true);
            await loadClaims(filter, contactFilter);
        } catch (prepareError: unknown) {
            setError(
                prepareError instanceof Error
                    ? prepareError.message
                    : "Could not prepare invitation."
            );
        } finally {
            setActingOn(null);
        }
    }

    async function sendInvitation(claim: CourseClaim) {
        const verb = claim.invitation ? "resend" : "send";
        if (!window.confirm(`Are you sure you want to ${verb} the owner invitation?`)) return;
        setActingOn(claim.id);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch("/api/admin/course-claims", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "send-invitation", claimId: claim.id }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Could not send invitation.");
            setSuccess("Owner invitation sent.");
            setLoading(true);
            await loadClaims(filter, contactFilter);
        } catch (sendError: unknown) {
            setError(sendError instanceof Error ? sendError.message : "Could not send invitation.");
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

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Owner/contact state
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Owner contact state">
                    {contactFilters.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            aria-pressed={contactFilter === item.value}
                            onClick={() => {
                                setSuccess(null);
                                setError(null);
                                setLoading(true);
                                setContactFilter(item.value);
                            }}
                            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                                contactFilter === item.value
                                    ? "bg-violet-500 text-white"
                                    : "border border-white/10 bg-black/20 text-gray-300 hover:bg-white/10"
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </section>

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
            ) : loadFailed ? null : claims.length === 0 ? (
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

                                    <div className={`rounded-xl border p-4 ${
                                        claim.owner_contact_status === "unknown"
                                            ? "border-amber-400/30 bg-amber-500/10"
                                            : claim.owner_contact_status === "known"
                                                ? "border-emerald-400/30 bg-emerald-500/10"
                                                : "border-violet-400/30 bg-violet-500/10"
                                    }`}>
                                        <p className={`text-xs font-bold uppercase tracking-[0.16em] ${
                                            claim.owner_contact_status === "unknown"
                                                ? "text-amber-200"
                                                : claim.owner_contact_status === "known"
                                                    ? "text-emerald-200"
                                                    : "text-violet-200"
                                        }`}>
                                            {claim.owner_contact_status === "unknown"
                                                ? "Owner information missing"
                                                : claim.owner_contact_status === "known"
                                                    ? "Contact ready"
                                                    : "Needs review"}
                                        </p>
                                        <p className="mt-1 text-sm text-gray-200">
                                            {claim.owner_contact_status === "unknown"
                                                ? "The course creator did not know who manages this course."
                                                : claim.owner_contact_status === "known"
                                                    ? "Owner contact information has been supplied. No invitation has been sent."
                                                    : "This course predates the current owner-contact status system."}
                                        </p>
                                    </div>

                                    {claim.owner_contact_status !== "unknown" &&
                                        (claim.contact_name || claim.contact_email || claim.contact_phone
                                            || claim.contact_organization || claim.contact_role) && (
                                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
                                                {claim.owner_contact_status === "known"
                                                    ? "Contact details"
                                                    : "Historical contact details - unverified"}
                                            </p>
                                            <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                                                <div><dt className="text-gray-500">Name</dt><dd className="break-words text-gray-200">{claim.contact_name || "Not provided"}</dd></div>
                                                <div><dt className="text-gray-500">Email</dt><dd className="break-all text-gray-200">{claim.contact_email || "Not provided"}</dd></div>
                                                <div><dt className="text-gray-500">Phone</dt><dd className="break-words text-gray-200">{claim.contact_phone || "Not provided"}</dd></div>
                                                <div><dt className="text-gray-500">Organization</dt><dd className="break-words text-gray-200">{claim.contact_organization || "Not provided"}</dd></div>
                                                <div><dt className="text-gray-500">Role</dt><dd className="break-words text-gray-200">{claim.contact_role || "Not provided"}</dd></div>
                                            </dl>
                                        </div>
                                    )}

                                    <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
                                        <div><dt className="text-gray-500">Assigned database club</dt><dd className="break-words text-gray-200">{claim.club_name || claim.club_id || "No club assigned yet"}</dd></div>
                                        <div><dt className="text-gray-500">Created by</dt><dd className="break-words text-gray-200">{claim.creator_name || claim.course_created_by || "Unknown"}</dd></div>
                                        <div><dt className="text-gray-500">Requested by</dt><dd className="break-words text-gray-200">{claim.requester_name || claim.requested_by}</dd></div>
                                        <div><dt className="text-gray-500">Requested</dt><dd className="text-gray-200">{formatDate(claim.created_at)}</dd></div>
                                        <div><dt className="text-gray-500">Decided</dt><dd className="text-gray-200">{formatDate(claim.decided_at)}</dd></div>
                                        <div><dt className="text-gray-500">Claim ID</dt><dd className="break-all font-mono text-xs text-gray-400">{claim.id}</dd></div>
                                        <div><dt className="text-gray-500">Course ID</dt><dd className="break-all font-mono text-xs text-gray-400">{claim.course_id}</dd></div>
                                    </dl>

                                    {claim.status === "pending" && (
                                        <div className={`rounded-xl border p-4 ${
                                            invitationRequirements(claim).length === 0
                                                ? "border-lime-400/40 bg-lime-400/10"
                                                : "border-white/10 bg-white/5"
                                        }`}>
                                            <p className={`text-xs font-bold uppercase tracking-[0.16em] ${
                                                invitationRequirements(claim).length === 0
                                                    ? "text-lime-300"
                                                    : "text-gray-300"
                                            }`}>
                                                {invitationRequirements(claim).length === 0
                                                    ? "Ready for invitation"
                                                    : "Invitation preparation"}
                                            </p>
                                            {invitationRequirements(claim).length === 0 ? (
                                                <p className="mt-1 text-sm text-gray-200">
                                                    Contact and club prerequisites are complete. No invitation has been sent.
                                                </p>
                                            ) : (
                                                <ul className="mt-2 list-inside list-disc text-sm text-gray-300">
                                                    {invitationRequirements(claim).map((requirement) => (
                                                        <li key={requirement}>{requirement}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}

                                    {claim.invitation && (
                                        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm">
                                            <p className="font-semibold uppercase tracking-wide text-cyan-200">
                                                {claim.invitation.consumed_at
                                                    ? "Activated"
                                                    : claim.invitation.revoked_at
                                                        ? "Revoked"
                                                        : new Date(claim.invitation.expires_at) <= new Date()
                                                            ? "Expired"
                                                            : claim.invitation.delivery_status === "sent"
                                                                ? "Invitation sent"
                                                                : claim.invitation.delivery_status === "failed"
                                                                    ? "Delivery failed"
                                                                    : "Preparing delivery"}
                                            </p>
                                            <p className="mt-1 text-gray-200">Recipient: {claim.invitation.recipient_email}</p>
                                            {claim.invitation.sent_at && <p className="text-gray-300">Sent: {formatDate(claim.invitation.sent_at)}</p>}
                                            <p className="text-gray-300">Expires: {formatDate(claim.invitation.expires_at)}</p>
                                        </div>
                                    )}

                                    {claim.status === "pending" && preparingClaimId === claim.id && preparationForm && (
                                        <section className="space-y-4 rounded-xl border border-blue-400/30 bg-blue-500/10 p-4">
                                            <div>
                                                <h3 className="font-semibold text-white">Prepare owner invitation</h3>
                                                <p className="mt-1 text-xs text-gray-300">
                                                    Confirming saves authoritative contact and club data. It does not send an invitation.
                                                </p>
                                            </div>

                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {[
                                                    ["Contact name", "contactName"],
                                                    ["Owner email *", "contactEmail"],
                                                    ["Phone", "contactPhone"],
                                                    ["Organization", "contactOrganization"],
                                                    ["Role", "contactRole"],
                                                ].map(([label, field]) => (
                                                    <label key={field} className="text-xs font-medium text-gray-300">
                                                        {label}
                                                        <input
                                                            type={field === "contactEmail" ? "email" : "text"}
                                                            value={preparationForm[field as keyof PreparationForm]}
                                                            onChange={(event) => setPreparationForm({
                                                                ...preparationForm,
                                                                [field]: event.target.value,
                                                            })}
                                                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
                                                        />
                                                    </label>
                                                ))}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-gray-300">
                                                    Find an existing club
                                                    <div className="mt-1 flex gap-2">
                                                        <input
                                                            type="search"
                                                            value={clubSearch}
                                                            onChange={(event) => setClubSearch(event.target.value)}
                                                            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={searchClubs}
                                                            disabled={searchingClubs || clubSearch.trim().length < 2}
                                                            className="rounded-lg border border-blue-400/30 px-3 py-2 text-sm text-blue-200 disabled:opacity-50"
                                                        >
                                                            {searchingClubs ? "Searching..." : "Search"}
                                                        </button>
                                                    </div>
                                                </label>
                                                {preparationForm.selectedClubId && (
                                                    <p className="text-sm text-emerald-300">
                                                        Selected: {preparationForm.selectedClubName || preparationForm.selectedClubId}
                                                    </p>
                                                )}
                                                {clubResults.length > 0 && (
                                                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2">
                                                        {clubResults.map((club) => (
                                                            <button
                                                                key={club.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setPreparationForm({
                                                                        ...preparationForm,
                                                                        selectedClubId: club.id,
                                                                        selectedClubName: club.name,
                                                                        newClubName: "",
                                                                    });
                                                                    setClubResults([]);
                                                                    setClubSearch(club.name);
                                                                }}
                                                                className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10"
                                                            >
                                                                {club.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <label className="block text-xs font-medium text-gray-300">
                                                Or create a club with its real name
                                                <input
                                                    type="text"
                                                    value={preparationForm.newClubName}
                                                    onChange={(event) => setPreparationForm({
                                                        ...preparationForm,
                                                        newClubName: event.target.value,
                                                        selectedClubId: event.target.value ? "" : preparationForm.selectedClubId,
                                                        selectedClubName: event.target.value ? "" : preparationForm.selectedClubName,
                                                    })}
                                                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
                                                />
                                            </label>

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => prepareInvitation(claim)}
                                                    disabled={actingOn === claim.id}
                                                    className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
                                                >
                                                    {actingOn === claim.id ? "Saving..." : "Confirm contact and club"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPreparingClaimId(null);
                                                        setPreparationForm(null);
                                                    }}
                                                    disabled={actingOn === claim.id}
                                                    className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 disabled:opacity-50"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </section>
                                    )}
                                </div>

                                {claim.status === "pending" && (
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                        <button
                                            type="button"
                                            disabled={actingOn === claim.id}
                                            onClick={() => openPreparation(claim)}
                                            className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-50"
                                        >
                                            {invitationRequirements(claim).length === 0 ? "Review details" : "Prepare invitation"}
                                        </button>
                                        {invitationRequirements(claim).length === 0 && !claim.invitation?.consumed_at && (
                                            <button
                                                type="button"
                                                disabled={actingOn === claim.id}
                                                onClick={() => sendInvitation(claim)}
                                                className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-lime-300 disabled:opacity-50"
                                            >
                                                {actingOn === claim.id
                                                    ? "Sending..."
                                                    : claim.invitation
                                                        ? "Resend invitation"
                                                        : "Send invitation"}
                                            </button>
                                        )}
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
