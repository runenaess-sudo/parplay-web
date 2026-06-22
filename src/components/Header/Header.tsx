"use client";

import { supabaseBrowser as supabase } from "@/src/lib/supabase-browser";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
        <header className="parplay-header">
            {/* Logo */}
            <Link href="/" className="text-xl font-semibold">
                ParPlay
            </Link>

            {/* Main Menu */}
            <nav className="menu">
                <MenuItem href="/community" active={pathname.startsWith("/community")}>
                    Community
                </MenuItem>

                {/* COURSES DROPDOWN */}
                <div className="relative group">
                    {/* Not clickable */}
                    <div className="menu-item cursor-default select-none">
                        Courses
                    </div>

                    {/* Dropdown */}
                    <div
                        className="
                            absolute left-0 top-full 
                            hidden group-hover:block 
                            bg-white shadow-lg rounded-md 
                            z-50
                        "
                    >
                        <Link href="/courses" className="dropdown-item block whitespace-nowrap">
                            View Courses
                        </Link>

                        {canCreateCourse && (
                            <Link href="/courses/create" className="dropdown-item block whitespace-nowrap">
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

                        <div
                            className="
                                absolute left-0 top-full 
                                hidden group-hover:block 
                                bg-white shadow-lg rounded-md 
                                z-50
                            "
                        >
                            <Link href="/profile" className="dropdown-item block whitespace-nowrap">
                                Profile
                            </Link>

                            <button
                                className="dropdown-item text-left block whitespace-nowrap"
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
