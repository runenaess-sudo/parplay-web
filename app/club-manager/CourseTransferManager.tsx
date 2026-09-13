"use client";

import { isBasicEmail } from "@/lib/course-manager-transfer";
import { useCallback, useEffect, useRef, useState } from "react";

type PendingTransfer = { maskedEmail: string; deliveryStatus: "reserved" | "sent" | "failed"; expiresAt: string };
const messages: Record<string, string> = {
    COURSE_MANAGER_TRANSFER_ALREADY_PENDING: "A pending transfer already exists for this course.",
    COURSE_MANAGER_TRANSFER_NOT_AUTHORIZED: "You no longer have authority to transfer this course.",
    COURSE_MANAGER_TRANSFER_NOT_PENDING: "This transfer is no longer pending.",
    COURSE_MANAGER_TRANSFER_MANAGER_CHANGED: "The active Course Manager has changed.",
    DELIVERY_FAILED: "Delivery failed. The transfer remains pending and can be retried.",
    UNAVAILABLE: "The transfer service is temporarily unavailable.",
};

export default function CourseTransferManager({ courseId }: { courseId: string }) {
    const [pending, setPending] = useState<PendingTransfer | null>(null);
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const busy = useRef(false);
    const refresh = useCallback(async () => {
        const response = await fetch(`/api/course-manager-transfer?courseId=${encodeURIComponent(courseId)}`, { cache: "no-store" });
        const body = await response.json() as { transfer?: PendingTransfer | null };
        if (!response.ok) throw new Error("TRANSFER_STATE_UNAVAILABLE");
        setPending(body.transfer ?? null);
    }, [courseId]);
    useEffect(() => {
        let active = true;
        async function loadInitialState() {
            try {
                const response = await fetch(`/api/course-manager-transfer?courseId=${encodeURIComponent(courseId)}`, { cache: "no-store" });
                const body = await response.json() as { transfer?: PendingTransfer | null };
                if (!response.ok) throw new Error();
                if (active) setPending(body.transfer ?? null);
            } catch {
                if (active) setError("Transfer status could not be loaded.");
            } finally {
                if (active) setLoading(false);
            }
        }
        void loadInitialState();
        return () => { active = false; };
    }, [courseId]);
    async function act(action: "create" | "resend" | "cancel") {
        if (busy.current) return;
        if (action === "create" && !isBasicEmail(email)) { setError("Enter a valid recipient email address.");return; }
        if (action === "cancel" && !window.confirm("Cancel transfer?\n\nThe recipient will no longer be able to use this invitation. You will remain Course Manager.")) return;
        busy.current = true;setWorking(true);setError(null);setNotice(null);
        try {
            const response = await fetch("/api/course-manager-transfer", { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, courseId, ...(action === "create" ? { email } : {}) }) });
            const body = await response.json() as { error?: string };
            if (!response.ok) setError(messages[body.error ?? ""] ?? "The transfer could not be updated. Please try again.");
            else {
                setNotice(action === "cancel" ? "Transfer cancelled. You remain Course Manager."
                    : action === "resend" ? "New invitation sent. The previous link is no longer valid."
                        : "Invitation sent. You remain Course Manager until it is accepted.");
                if (action === "create") setEmail("");
                await refresh();
            }
        } catch { setError("The transfer service is temporarily unavailable."); }
        finally { busy.current = false;setWorking(false); }
    }
    return <section className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <h4 className="font-semibold">Transfer Course Management</h4>
        {loading ? <p className="mt-2 text-sm text-gray-400">Loading transfer status...</p> : pending ? <div className="mt-3">
            <p className="text-sm font-semibold text-amber-300">Pending transfer</p>
            <dl className="mt-2 grid gap-2 text-sm text-gray-300 sm:grid-cols-2">
                <div><dt className="text-gray-500">Recipient</dt><dd>{pending.maskedEmail}</dd></div>
                <div><dt className="text-gray-500">Delivery</dt><dd>{pending.deliveryStatus === "failed" ? "Delivery failed — retry available" : pending.deliveryStatus === "sent" ? "Invitation sent" : "Sending"}</dd></div>
                <div><dt className="text-gray-500">Expires</dt><dd>{new Date(pending.expiresAt).toLocaleString()}</dd></div>
            </dl>
            <p className="mt-3 text-sm text-gray-400">Your management access remains active until the recipient accepts.</p>
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={working} onClick={() => void act("resend")} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold disabled:opacity-50">{working ? "Working..." : "Resend invitation"}</button><button type="button" disabled={working} onClick={() => void act("cancel")} className="rounded-lg border border-red-400/50 px-4 py-2 text-sm font-semibold text-red-200 disabled:opacity-50">Cancel transfer</button></div>
        </div> : <form className="mt-3" onSubmit={(event) => { event.preventDefault();void act("create"); }}>
            <p className="text-sm text-gray-300">Transfer management responsibility for this course to another person.</p>
            <label className="mt-3 block text-sm font-medium" htmlFor={`transfer-email-${courseId}`}>Recipient email</label>
            <input id={`transfer-email-${courseId}`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-blue-400" />
            <p className="mt-2 text-xs leading-5 text-gray-400">The current manager keeps access until acceptance. The recipient must use a ParPlay account with this email. Invitations expire after 7 days.</p>
            <button type="submit" disabled={working} className="mt-3 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold disabled:opacity-50">{working ? "Sending..." : "Send invitation"}</button>
        </form>}
        {notice && <p role="status" className="mt-3 rounded-lg bg-green-500/10 p-3 text-sm text-green-200">{notice}</p>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
    </section>;
}
