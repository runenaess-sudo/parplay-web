"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser as supabase } from "@/src/lib/supabase-browser";
import { MenuItem } from "./MenuItem";

type AccessInfo = {
    membership: string;
    limits: Record<string, any> | null;
};

export function Header() {
    const pathname = usePathname();

    const [session, setSession] = useState<Session | null>(null);
    const [access, setAccess] = useState<AccessInfo | null>(null);

    useEffect(() => {
        async function load() {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);

            if (session?.user) {
                const res = await fetch("/api/access");
                const json = await res.json();
                setAccess(json);
            }
        }
        load();
    }, []);

    const isLoggedIn = !!session?.user;
    const canCreateCourse = access?.limits?.can_create_course === true;

    return (
        <header className="w-full h-16 flex items-center px-6 justify-between bg-black text-white border-b border-gray-800">
            {/* Logo */}
            <Link href="/" className="text-xl font-semibold">
                ParPlay
            </Link>

            {/* Main Menu */}
            <nav className="flex gap-8 text-sm font-medium">
                <MenuItem href="/community" active={pathname.startsWith("/community")}>
                    Community
                </MenuItem>

                <div className="relative group">
                    <MenuItem href="/courses" active={pathname.startsWith("/courses")}>
                        Courses
                    </MenuItem>

                    {/* Dropdown */}
                    <div className="absolute hidden group-hover:flex flex-col bg-white shadow-lg border rounded-md mt-2 w-40">
                        <Link href="/courses" className="px-4 py-2 hover:bg-gray-100">
                            View Courses
                        </Link>

                        {canCreateCourse && (
                            <Link
                                href="/courses/create"
                                className="px-4 py-2 hover:bg-gray-100"
                            >
                                Create Course
                            </Link>
                        )}
                    </div>
                </div>

                <MenuItem href="/tournaments" active={pathname.startsWith("/tournaments")}>
                    Tournaments
                </MenuItem>
            </nav>

            {/* Profile / Login */}
            <nav>
                {isLoggedIn ? (
                    <div className="relative group">
                        <MenuItem href="/profile" active={pathname.startsWith("/profile")}>
                            My Profile
                        </MenuItem>

                        <div className="absolute hidden group-hover:flex flex-col bg-white shadow-lg border rounded-md mt-2 w-40">
                            <Link href="/profile" className="px-4 py-2 hover:bg-gray-100">
                                Profile
                            </Link>

                            <button
                                className="px-4 py-2 text-left hover:bg-gray-100"
                                onClick={() => supabase.auth.signOut()}
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                ) : (
                    <MenuItem href="/login" active={pathname === "/login"}>
                        Login
                    </MenuItem>
                )}
            </nav>
        </header>
    );
}
