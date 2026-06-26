"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
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
            const supabase = supabaseBrowser;

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
                    <div className="menu-item cursor-default select-none">
                        Courses
                    </div>

                    <div
                        className="
                            absolute left-0 top-full 
                            hidden group-hover:block 
                            bg-black/80 text-white 
                            shadow-xl rounded-md 
                            backdrop-blur-md
                            z-50
                        "
                    >
                        <Link href="/courses" className="dropdown-item block whitespace-nowrap hover:bg-white/10">
                            View Courses
                        </Link>

                        {canCreateCourse && (
                            <Link href="/courses/create" className="dropdown-item block whitespace-nowrap hover:bg-white/10">
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
                                bg-black/80 text-white 
                                shadow-xl rounded-md 
                                backdrop-blur-md
                                z-50
                            "
                        >
                            <Link href="/profile" className="dropdown-item block whitespace-nowrap hover:bg-white/10">
                                Profile
                            </Link>

                            <button
                                className="dropdown-item text-left block whitespace-nowrap hover:bg-white/10"
                                onClick={async () => {
                                    await supabaseBrowser.auth.signOut();
                                }}
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
