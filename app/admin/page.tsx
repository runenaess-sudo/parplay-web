"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AdminUser = {
    id: string;
    full_name: string | null;
    username: string | null;
    membership: string;
};

export default function AdminPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadUsers() {
            try {
                const response = await fetch("/api/admin/users", { cache: "no-store" });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.error || "Could not load users.");
                setUsers(payload.users ?? []);
            } catch (loadError: unknown) {
                setError(loadError instanceof Error ? loadError.message : "Could not load users.");
            } finally {
                setLoading(false);
            }
        }

        loadUsers();
    }, []);

    return (
        <main className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Admin console</p>
                        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Overview</h1>
                        <p className="mt-2 max-w-2xl text-sm text-gray-300">Review course claims and communicate with ParPlay users.</p>
                    </div>
                    <div className="w-fit rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Admin access enabled</div>
                </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
                <Link href="/admin/course-claims" className="rounded-2xl border border-white/10 bg-black/20 p-5 shadow-xl transition hover:border-blue-400/40 hover:bg-white/5">
                    <p className="text-lg font-semibold">Course Claims</p>
                    <p className="mt-2 text-sm text-gray-400">Review pending and completed ownership claims.</p>
                </Link>
                <Link href="/admin/messages" className="rounded-2xl border border-white/10 bg-black/20 p-5 shadow-xl transition hover:border-blue-400/40 hover:bg-white/5">
                    <p className="text-lg font-semibold">Messages</p>
                    <p className="mt-2 text-sm text-gray-400">Send system messages to all or selected users.</p>
                </Link>
            </div>

            <section className="rounded-2xl border border-white/10 bg-black/20 p-5 shadow-xl backdrop-blur sm:p-6">
                <h2 className="text-lg font-semibold">Known users</h2>
                <p className="mt-2 text-sm text-gray-400">Loaded from the existing profiles table.</p>
                {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
                {loading ? (
                    <p className="mt-4 text-sm text-gray-300">Loading users...</p>
                ) : users.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-300">No users found.</p>
                ) : (
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {users.slice(0, 12).map((user) => (
                            <li key={user.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                                <div className="font-medium text-white">{user.full_name || user.username || "Unnamed user"}</div>
                                <div className="text-xs text-gray-400">{user.username ? `@${user.username}` : user.id}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}
