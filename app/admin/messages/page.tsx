"use client";

import { useEffect, useMemo, useState } from "react";

type AdminUser = {
    id: string;
    full_name: string | null;
    username: string | null;
};

export default function AdminMessagesPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [message, setMessage] = useState("");
    const [recipientMode, setRecipientMode] = useState<"all" | "custom">("all");
    const [customIds, setCustomIds] = useState("");
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        async function loadUsers() {
            try {
                const response = await fetch("/api/admin/users", { cache: "no-store" });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || "Could not load users.");
                setUsers(payload.users ?? []);
            } catch (error: unknown) {
                setStatus(error instanceof Error ? error.message : "Could not load users.");
            } finally {
                setLoadingUsers(false);
            }
        }

        loadUsers();
    }, []);

    const recipientIds = useMemo(
        () => customIds.split(/[,\n]/).map((id) => id.trim()).filter(Boolean),
        [customIds]
    );
    const recipientCount = recipientMode === "all" ? users.length : recipientIds.length;

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setSending(true);
        setStatus(null);

        try {
            const response = await fetch("/api/admin/system-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message,
                    recipientMode,
                    recipientIds: recipientMode === "custom" ? recipientIds : [],
                }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Could not send message.");

            setStatus(`Sent to ${payload.sent} user${payload.sent === 1 ? "" : "s"}.`);
            setMessage("");
            setCustomIds("");
            setRecipientMode("all");
        } catch (error: unknown) {
            setStatus(error instanceof Error ? error.message : "Could not send message.");
        } finally {
            setSending(false);
        }
    }

    return (
        <main className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Admin messages</p>
                <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Broadcast system messages</h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-300">
                    Send a message to all users or selected recipients in the app&apos;s System inbox.
                </p>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                <section className="rounded-2xl border border-white/10 bg-black/20 p-5 shadow-xl backdrop-blur sm:p-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-200">Message</label>
                            <textarea
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                rows={6}
                                required
                                placeholder="Write a system message for your users"
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                            />
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button type="button" onClick={() => setRecipientMode("all")} className={`rounded-full px-4 py-2 text-sm ${recipientMode === "all" ? "bg-blue-600 text-white" : "bg-white/10 text-gray-200"}`}>
                                Send to all users
                            </button>
                            <button type="button" onClick={() => setRecipientMode("custom")} className={`rounded-full px-4 py-2 text-sm ${recipientMode === "custom" ? "bg-blue-600 text-white" : "bg-white/10 text-gray-200"}`}>
                                Send to selected users
                            </button>
                        </div>

                        {recipientMode === "custom" && (
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-200">Recipient user IDs</label>
                                <textarea
                                    value={customIds}
                                    onChange={(event) => setCustomIds(event.target.value)}
                                    rows={4}
                                    placeholder="Paste one user ID per line or comma separated"
                                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                                />
                            </div>
                        )}

                        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300 sm:flex-row sm:items-center sm:justify-between">
                            <span>Recipients: {recipientCount}</span>
                            <button type="submit" disabled={sending || !message.trim()} className="rounded-full bg-white px-4 py-2 font-medium text-black transition disabled:cursor-not-allowed disabled:opacity-60">
                                {sending ? "Sending..." : "Send broadcast"}
                            </button>
                        </div>

                        {status && <p className="text-sm text-blue-300">{status}</p>}
                    </form>
                </section>

                <section className="rounded-2xl border border-white/10 bg-black/20 p-5 shadow-xl backdrop-blur sm:p-6">
                    <h2 className="text-lg font-semibold">Known users</h2>
                    <p className="mt-2 text-sm text-gray-400">Loaded from the existing profiles table.</p>
                    {loadingUsers ? (
                        <p className="mt-4 text-sm text-gray-300">Loading users...</p>
                    ) : users.length === 0 ? (
                        <p className="mt-4 text-sm text-gray-300">No users found.</p>
                    ) : (
                        <ul className="mt-4 space-y-2">
                            {users.slice(0, 12).map((user) => (
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
