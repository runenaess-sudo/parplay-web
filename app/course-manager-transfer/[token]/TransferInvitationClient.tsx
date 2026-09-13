"use client";

import { courseManagerTransferPath } from "@/lib/course-manager-transfer";
import { supabaseBrowser } from "@/lib/supabase-browser";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Preview = {
    state: "active" | "completed" | "invalid" | "expired" | "cancelled" | "unavailable";
    course_name?: string;
    club_name?: string | null;
    masked_email?: string;
    expires_at?: string;
};

const unavailableCopy: Partial<Record<Preview["state"], { title: string; message: string }>> = {
    invalid: { title: "Invitation unavailable", message: "This invitation is invalid or no longer available." },
    expired: { title: "Invitation expired", message: "Ask the current Course Manager to send a new invitation." },
    cancelled: { title: "Invitation unavailable", message: "This invitation has been cancelled." },
    unavailable: { title: "Invitation unavailable", message: "The invitation service is temporarily unavailable." },
};

export default function TransferInvitationClient({ token }: { token: string }) {
    const [preview, setPreview] = useState<Preview | null>(null);
    const [authenticated, setAuthenticated] = useState(false);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const submitting = useRef(false);
    const destination = courseManagerTransferPath(token);

    async function inspect() {
        const response = await fetch(`/api/course-manager-transfer?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const body = await response.json() as Preview;
        setPreview(response.ok ? body : { state: body.state ?? "invalid" });
    }

    useEffect(() => {
        let active = true;
        async function loadInvitation() {
            try {
                const [response, sessionResult] = await Promise.all([
                    fetch(`/api/course-manager-transfer?token=${encodeURIComponent(token)}`, { cache: "no-store" }),
                    supabaseBrowser.auth.getSession(),
                ]);
                const body = await response.json() as Preview;
                if (!active) return;
                setPreview(response.ok ? body : { state: body.state ?? "invalid" });
                setAuthenticated(!!sessionResult.data.session);
            } catch {
                if (active) setPreview({ state: "unavailable" });
            }
        }
        void loadInvitation();
        return () => { active = false; };
    }, [token]);

    async function accept() {
        if (submitting.current || !window.confirm(`Accept Course Management?\n\nYou will become the Course Manager for ${preview?.course_name ?? "this course"}. The current manager's active access will end when the transfer completes.`)) return;
        submitting.current = true;setWorking(true);setError(null);
        try {
            await inspect();
            const response = await fetch("/api/course-manager-transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept", token }) });
            const body = await response.json() as { error?: string };
            if (response.ok) { setSuccess(true);setPreview((current) => current ? { ...current, state: "completed" } : current);return; }
            if (response.status === 401) { setAuthenticated(false);setError("Log in with the account that received this invitation."); }
            else if (body.error === "COURSE_MANAGER_TRANSFER_WRONG_ACCOUNT") setError("Wrong ParPlay account. Sign in with the account for the invited email shown above.");
            else if (body.error === "COURSE_MANAGER_TRANSFER_EMAIL_NOT_VERIFIED") setError("Email verification required. Verify this account through the existing ParPlay verification flow, then return to this invitation.");
            else if (body.error === "COURSE_MANAGER_TRANSFER_EXPIRED") setPreview({ state: "expired" });
            else if (body.error === "COURSE_MANAGER_TRANSFER_CANCELLED") setPreview({ state: "cancelled" });
            else setError("This invitation can no longer be accepted. Ask the current Course Manager to check it.");
        } catch { setError("The invitation service is temporarily unavailable."); }
        finally { submitting.current = false;setWorking(false); }
    }

    async function switchAccount() {
        await supabaseBrowser.auth.signOut();
        window.location.assign(`/login?returnTo=${encodeURIComponent(destination)}`);
    }

    const terminal = preview ? unavailableCopy[preview.state] : null;
    return <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-16 text-white">
        <section className="w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">ParPlay</p>
            {!preview ? <><h1 className="mt-3 text-3xl font-semibold">Course Manager Invitation</h1><p className="mt-4 text-gray-300">Loading invitation...</p></>
                : terminal ? <><h1 className="mt-3 text-3xl font-semibold">{terminal.title}</h1><p className="mt-4 text-gray-300">{terminal.message}</p></>
                    : preview.state === "completed" || success ? <><h1 className="mt-3 text-3xl font-semibold">Course Management Transferred</h1><p className="mt-4 text-gray-300">{success ? `You are now the Course Manager for ${preview.course_name}.` : "This transfer has already been completed."}</p><Link href="/club-manager" className="mt-6 block w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold">Open Club Manager</Link></>
                        : <><h1 className="mt-3 text-3xl font-semibold">Course Manager Invitation</h1><p className="mt-4 text-gray-300">You&apos;ve been invited to manage:</p><p className="mt-2 text-xl font-semibold">{preview.course_name}</p>{preview.club_name && <p className="mt-1 text-sm text-gray-400">{preview.club_name}</p>}<dl className="mt-5 space-y-3 rounded-xl bg-black/20 p-4 text-left text-sm"><div><dt className="text-gray-500">Invited email</dt><dd>{preview.masked_email}</dd></div><div><dt className="text-gray-500">Invitation expires</dt><dd>{preview.expires_at ? new Date(preview.expires_at).toLocaleString() : "Unavailable"}</dd></div></dl><p className="mt-4 text-sm leading-6 text-gray-300">Accepting transfers Course Manager responsibility to your ParPlay account. The current manager keeps access until you accept.</p>{authenticated ? <><button type="button" onClick={() => void accept()} disabled={working} className="mt-6 w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold disabled:opacity-50">{working ? "Accepting..." : "Accept Course Management"}</button><button type="button" onClick={() => void switchAccount()} disabled={working} className="mt-3 text-sm text-blue-300">Use a different account</button></> : <><Link className="mt-6 block w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold" href={`/login?returnTo=${encodeURIComponent(destination)}`}>Log in to continue</Link><p className="mt-3 text-sm text-gray-400">Need an account? Create one in the ParPlay app, then return to this link.</p></>}</>}
            {error && <p role="alert" className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        </section>
    </main>;
}
