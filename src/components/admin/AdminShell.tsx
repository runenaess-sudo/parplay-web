"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { communityModeratedEvent } from "@/lib/community-admin";
import DiagnosesLink from './DiagnosesLink';

const items = [
    { href: "/admin", label: "Overview", exact: true },
    { href: "/admin/course-claims", label: "Course Claims" },
    { href: "/admin/messages", label: "Messages" },
    { href: "/admin/moments", label: "Moments" },
    { href: "/admin/user-messages", label: "User Messages" },
    { href: "/admin/foundation-fame", label: "Foundation Fame" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [pendingCount, setPendingCount] = useState<number | null>(null);

    useEffect(() => {
        let controller: AbortController | undefined;
        async function refresh() {
            controller?.abort();
            const request = new AbortController();
            controller = request;
            try {
                const response = await fetch('/api/admin/user-messages?tab=PENDING', { cache: 'no-store', signal: request.signal });
                if (!response.ok) throw new Error('Count unavailable');
                const data = await response.json();
                if (!request.signal.aborted) setPendingCount(Number.isInteger(data.pending_count) && data.pending_count >= 0 ? data.pending_count : null);
            } catch {
                if (!request.signal.aborted) setPendingCount(null);
            }
        }
        void refresh();
        window.addEventListener(communityModeratedEvent, refresh);
        window.addEventListener('focus', refresh);
        return () => {
            controller?.abort();
            window.removeEventListener(communityModeratedEvent, refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [pathname]);

    return (
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 text-white md:grid-cols-[220px_minmax(0,1fr)] md:px-6">
            <aside className="h-fit rounded-2xl border border-white/10 bg-white/5 p-3 shadow-xl backdrop-blur md:sticky md:top-6">
                <p className="px-3 pb-3 pt-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">
                    Admin
                </p>
                <nav className="flex gap-2 overflow-x-auto md:flex-col" aria-label="Admin navigation">
                    <DiagnosesLink />
                    {items.map((item) => {
                        const active = item.exact
                            ? pathname === item.href
                            : pathname.startsWith(item.href);

                        return (
                            <Fragment key={item.href}>
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`shrink-0 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                                    active
                                        ? "bg-blue-600 text-white"
                                        : "text-gray-300 hover:bg-white/10 hover:text-white"
                                }`}
                            >
                                {item.label}
                            </Link>
                            {item.href === '/admin/user-messages' && pendingCount !== null && pendingCount > 0 && (
                                <Link href="/admin/user-messages/community-posts"
                                    aria-current={pathname === '/admin/user-messages/community-posts' ? 'page' : undefined}
                                    className={`ml-4 shrink-0 rounded-xl px-3 py-2 text-sm transition ${pathname === '/admin/user-messages/community-posts' ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/10'}`}>
                                    Community Posts <span className="rounded-full bg-orange-500/20 px-2 py-0.5 font-semibold text-orange-300">({pendingCount})</span>
                                </Link>
                            )}
                            </Fragment>
                        );
                    })}
                </nav>
            </aside>

            <div className="min-w-0">{children}</div>
        </div>
    );
}
