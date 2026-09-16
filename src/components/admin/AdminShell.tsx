"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const items = [
    { href: "/admin", label: "Overview", exact: true },
    { href: "/admin/course-claims", label: "Course Claims" },
    { href: "/admin/messages", label: "Messages" },
    { href: "/admin/user-messages", label: "User Messages" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 text-white md:grid-cols-[220px_minmax(0,1fr)] md:px-6">
            <aside className="h-fit rounded-2xl border border-white/10 bg-white/5 p-3 shadow-xl backdrop-blur md:sticky md:top-6">
                <p className="px-3 pb-3 pt-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">
                    Admin
                </p>
                <nav className="flex gap-2 overflow-x-auto md:flex-col" aria-label="Admin navigation">
                    {items.map((item) => {
                        const active = item.exact
                            ? pathname === item.href
                            : pathname.startsWith(item.href);

                        return (
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
                        );
                    })}
                </nav>
            </aside>

            <div className="min-w-0">{children}</div>
        </div>
    );
}
