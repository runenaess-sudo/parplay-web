"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

type Invitation = { invitation_id: string; course_id: string; course_name: string; expires_at: string };

export default function CourseInvitationContinuationPage() {
    const { invitationId } = useParams<{ invitationId: string }>();
    const [invitation, setInvitation] = useState<Invitation | null>(null);
    const [state, setState] = useState<"loading" | "ready" | "missing" | "activated" | "unavailable">("loading");
    const [error, setError] = useState<string | null>(null);
    const [working, setWorking] = useState(false);

    useEffect(() => {
        let active = true;
        void fetch("/api/course-invitations", { cache: "no-store" })
            .then(async (response) => {
                if (!response.ok) throw new Error("discovery failed");
                return response.json() as Promise<{ invitations: Invitation[] }>;
            })
            .then(({ invitations }) => {
                if (!active) return;
                const match = invitations.find((item) => item.invitation_id === invitationId) ?? null;
                setInvitation(match);
                setState(match ? "ready" : "missing");
            })
            .catch(() => active && setState("unavailable"));
        return () => { active = false; };
    }, [invitationId]);

    async function activate() {
        if (!invitation || working) return;
        setWorking(true); setError(null);
        try {
            const response = await fetch("/api/course-invitations", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ invitationId: invitation.invitation_id }),
            });
            const body = await response.json() as { error?: string };
            if (!response.ok) {
                setError(body.error === "COURSE_INVITATION_EMAIL_NOT_VERIFIED"
                    ? "Verify this email in the ParPlay app, then try again."
                    : "This invitation is no longer available.");
                return;
            }
            setState("activated");
            window.dispatchEvent(new Event("course-invitations-changed"));
        } catch { setError("Invitation service is temporarily unavailable."); }
        finally { setWorking(false); }
    }

    return <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-16">
        <section className="w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">ParPlay Course</p>
            {state === "loading" && <p className="mt-4 text-gray-300">Loading invitation...</p>}
            {state === "unavailable" && <p className="mt-4 text-gray-300">Invitation service is temporarily unavailable.</p>}
            {state === "missing" && <p className="mt-4 text-gray-300">This invitation is no longer active for this account.</p>}
            {state === "activated" && invitation && <><h1 className="mt-3 text-3xl font-semibold">Your course is ready</h1><p className="mt-4 text-gray-300">Ownership is activated. You can now manage your course in ParPlay.</p><Link className="mt-6 block w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white" href={`/create-course/editor/${invitation.course_id}`}>Manage course</Link><Link className="mt-3 inline-block text-sm text-blue-300" href="/club-manager">Club Manager home</Link></>}
            {state === "ready" && invitation && <>
                <h1 className="mt-3 text-3xl font-semibold">You have a course ready to manage</h1>
                <p className="mt-4 text-xl font-semibold text-white">{invitation.course_name}</p>
                <button onClick={activate} disabled={working} className="mt-6 w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white disabled:opacity-50">{working ? "Checking..." : "Continue with this account"}</button>
            </>}
            {error && <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        </section>
    </main>;
}
