"use client";

import { getUserAccess } from "@/lib/access";
import { useEffect, useMemo, useState } from "react";

export default function AdminPage() {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [message, setMessage] = useState("");
    const [recipientMode, setRecipientMode] = useState<"all" | "custom">("all");
    const [customIds, setCustomIds] = useState("");
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        async function loadAccess() {
            const access = await getUserAccess();
            const admin = access.membership === "admin";
            setIsAdmin(admin);

            if (admin) {
                setLoadingUsers(true);
                try {
                    const res = await fetch("/api/admin/users", { cache: "no-store" });
                    const payload = await res.json();
                    if (res.ok) {
                        setUsers(payload.users ?? []);
                    }
                } finally {
                    setLoadingUsers(false);
                }
            }
        }

        loadAccess();
    }, []);

    const recipientCount = useMemo(() => {
        if (recipientMode === "all") return users.length;
        const ids = customIds
            .split(/[,\n]/)
            .map((x) => x.trim())
            .filter(Boolean);
        return ids.length;
    }, [customIds, recipientMode, users.length]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSending(true);
        setStatus(null);

        try {
            const body = {
                message,
                recipientMode,
                recipientIds: recipientMode === "custom"
                    ? customIds
                        .split(/[\n,]/)
                        .map((id) => id.trim())
                        .filter(Boolean)
                    : [],
            };

            const res = await fetch("/api/admin/system-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const payload = await res.json();

            if (!res.ok) {
                throw new Error(payload.error || "Could not send message.");
            }

            setStatus(`Sent to ${payload.sent} user${payload.sent === 1 ? "" : "s"}.`);
            setMessage("");
            setCustomIds("");
            setRecipientMode("all");
        } catch (error: any) {
            setStatus(error?.message || "Could not send message.");
        } finally {
            setSending(false);
        }
    }

    if (isAdmin === null) {
        return <main className="mx-auto max-w-5xl p-6 text-white">Checking access…</main>;
    }

    if (!isAdmin) {
        return (
            <main className="mx-auto max-w-3xl p-6 text-white">
                <h1 className="text-2xl font-semibold">Admin</h1>
                <p className="mt-3 text-gray-300">You do not have access to this area.</p>
            </main>
        );
    }

    return (
        <main className="mx-auto flex max-w-6xl flex-col gap-8 p-6 text-white">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-blue-300">Admin console</p>
                        <h1 className="mt-2 text-3xl font-semibold">Broadcast system messages</h1>
                        <p className="mt-3 max-w-2xl text-sm text-gray-300">
                            Send a message to all users or to a specific list of recipients. These appear in the app’s System inbox.
                        </p>
                    </div>
                    <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
                        Admin access enabled
                    </div>
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                <section className="rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-200">Message</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={6}
                                required
                                placeholder="Write a system message for your users"
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-0"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setRecipientMode("all")}
                                className={`rounded-full px-4 py-2 text-sm ${recipientMode === "all" ? "bg-blue-600 text-white" : "bg-white/10 text-gray-200"}`}
                            >
                                Send to all users
                            </button>
                            <button
                                type="button"
                                onClick={() => setRecipientMode("custom")}
                                className={`rounded-full px-4 py-2 text-sm ${recipientMode === "custom" ? "bg-blue-600 text-white" : "bg-white/10 text-gray-200"}`}
                            >
                                Send to selected users
                            </button>
                        </div>

                        {recipientMode === "custom" && (
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-200">Recipient user IDs</label>
                                <textarea
                                    value={customIds}
                                    onChange={(e) => setCustomIds(e.target.value)}
                                    rows={4}
                                    placeholder="Paste one user ID per line or comma separated"
                                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-0"
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
                            <span>{recipientMode === "all" ? `Recipients: ${recipientCount}` : `Recipients: ${recipientCount}`}</span>
                            <button
                                type="submit"
                                disabled={sending || !message.trim()}
                                className="rounded-full bg-white px-4 py-2 font-medium text-black transition disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {sending ? "Sending…" : "Send broadcast"}
                            </button>
                        </div>

                        {status && <p className="text-sm text-blue-300">{status}</p>}
                    </form>
                </section>

                <section className="rounded-2xl border border-white/10 bg-black/20 p-6 shadow-xl backdrop-blur">
                    <h2 className="text-lg font-semibold">Known users</h2>
                    <p className="mt-2 text-sm text-gray-400">Loaded from the existing profiles table.</p>

                    {loadingUsers ? (
                        <p className="mt-4 text-sm text-gray-300">Loading users…</p>
                    ) : users.length === 0 ? (
                        <p className="mt-4 text-sm text-gray-300">No users found.</p>
                    ) : (
                        <ul className="mt-4 space-y-2">
                            {users.slice(0, 12).map((user: any) => (
                                <li key={user.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                                    <div className="font-medium text-white">{user.full_name || user.username || "Unnamed user"}</div>
                                    <div className="text-xs text-gray-400">{user.username ? `@${user.username}` : user.id}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </main>
    );
}
