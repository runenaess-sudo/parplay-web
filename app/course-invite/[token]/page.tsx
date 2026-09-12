"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Preview = { state: string; courseName?: string; maskedEmail?: string; courseId?: string };

export default function CourseInvitePage() {
    const { token } = useParams<{ token: string }>();
    const [preview, setPreview] = useState<Preview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [working, setWorking] = useState(false);

    useEffect(() => {
        fetch(`/api/course-invite?token=${encodeURIComponent(token)}`, { cache: "no-store" })
            .then(async (response) => ({ ok: response.ok, body: await response.json() }))
            .then(({ body }) => setPreview(body))
            .catch(() => setPreview({ state: "unavailable" }));
    }, [token]);

    async function activate() {
        setWorking(true);setError(null);
        try {
            const response = await fetch("/api/course-invite", {
                method: "POST",headers: { "Content-Type": "application/json" },body: JSON.stringify({ token }),
            });
            const body = await response.json() as { error?: string; result?: { course_id?: string } };
            if (!response.ok) {
                if (response.status === 401) setError("Log in with the account that received this invitation.");
                else if (body.error === "COURSE_INVITATION_WRONG_ACCOUNT") setError("This invitation was sent to a different email address. Sign out and use the correct account.");
                else if (body.error === "COURSE_INVITATION_EMAIL_NOT_VERIFIED") setError("Verify this email in the ParPlay app, then return here and try again.");
                else setError("This invitation cannot be activated. It may be expired, used or no longer valid.");
                return;
            }
            setPreview({ ...preview, state: "activated", courseId: body.result?.course_id });
            window.dispatchEvent(new Event("course-invitations-changed"));
        } catch { setError("Invitation service is temporarily unavailable."); }
        finally { setWorking(false); }
    }

    const terminal:Record<string,string>={invalid:"This invitation link is not valid.",expired:"This invitation has expired. Ask ParPlay Course Team for a new one.",revoked:"This invitation has been replaced by a newer invitation.",activated:"Ownership is activated. Your course is ready in ParPlay.",unavailable:"Invitation service is temporarily unavailable."};
    return <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-16">
        <section className="w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">ParPlay Course</p>
            <h1 className="mt-3 text-3xl font-semibold">Manage your course</h1>
            {!preview ? <p className="mt-4 text-gray-300">Loading invitation...</p> : terminal[preview.state] ? <><p className="mt-4 text-gray-300">{terminal[preview.state]}</p>{preview.state === "activated" && preview.courseId && <><Link className="mt-6 block w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white" href={`/create-course/editor/${preview.courseId}`}>Manage course</Link><Link className="mt-3 inline-block text-sm text-blue-300" href="/club-manager">Club Manager home</Link></>}</> : <>
                <p className="mt-4 text-gray-300">You&apos;ve been invited to manage:</p>
                <p className="mt-2 text-xl font-semibold text-white">{preview.courseName}</p>
                <p className="mt-2 text-sm text-gray-400">Use the ParPlay account for {preview.maskedEmail}.</p>
                <button onClick={activate} disabled={working} className="mt-6 w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white disabled:opacity-50">{working?"Checking...":"Continue with this account"}</button>
                <div className="mt-4 flex justify-center gap-4 text-sm"><Link className="text-blue-300" href={`/login?returnTo=${encodeURIComponent(`/course-invite/${token}`)}`}>Log in</Link><span className="text-gray-500">Create an account in the ParPlay app</span></div>
            </>}
            {error&&<p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        </section>
    </main>;
}
