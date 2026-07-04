// src/components/Header/Header.tsx
"use client";

import { getUserAccess } from "@/lib/access";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuItem } from "../Header/MenuItem"; // juster path hvis MenuItem ligger et annet sted

type AccessInfo = {
    membership: string;
    limits: Record<string, any> | null;
};

export default function Header() {
    const pathname = usePathname();

    const [session, setSession] = useState<Session | null>(null);
    const [access, setAccess] = useState<AccessInfo | null>(null);

    useEffect(() => {
        async function loadSessionAndAccess() {
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            setSession(session);

            if (session?.user) {
                const nextAccess = await getUserAccess();
                setAccess(nextAccess);
            } else {
                setAccess(null);
            }
        }

        loadSessionAndAccess();

        const { data: authSub } = supabaseBrowser.auth.onAuthStateChange(async (_event, nextSession) => {
            setSession(nextSession);

            if (nextSession?.user) {
                const nextAccess = await getUserAccess();
                setAccess(nextAccess);
            } else {
                setAccess(null);
            }
        });

        return () => {
            authSub.subscription.unsubscribe();
        };
    }, []);

    const isLoggedIn = !!session?.user;
    const canCreateCourse = access?.limits?.can_create_course === true;

    return (
        <header className="parplay-header">
            <Link href="/" className="text-xl font-semibold">ParPlay</Link>

            {isLoggedIn ? (
                <nav className="menu">
                    <MenuItem href="/community" active={pathname.startsWith("/community")}>Community</MenuItem>

                    <div className="relative group">
                        <div className="menu-item cursor-default select-none">Courses</div>

                        <div className="absolute left-0 top-full hidden group-hover:block bg-black/80 text-white shadow-xl rounded-md backdrop-blur-md z-50">
                            <Link href="/courses" className="dropdown-item block whitespace-nowrap hover:bg-white/10">View Courses</Link>

                            {canCreateCourse && (
                                <Link href="/create-course" className="dropdown-item block whitespace-nowrap hover:bg-white/10">Create Course</Link>
                            )}
                        </div>
                    </div>

                    <MenuItem href="/tournaments" active={pathname.startsWith("/tournaments")}>Tournaments</MenuItem>
                </nav>
            ) : (
                <div aria-hidden="true" />
            )}

            <nav>
                {isLoggedIn ? (
                    <div className="relative group">
                        <MenuItem href="/profile" active={pathname.startsWith("/profile")}>My Profile</MenuItem>

                        <div className="absolute left-0 top-full hidden group-hover:block bg-black/80 text-white shadow-xl rounded-md backdrop-blur-md z-50">
                            <Link href="/profile" className="dropdown-item block whitespace-nowrap hover:bg-white/10">Profile</Link>

                            <button
                                className="dropdown-item text-left block whitespace-nowrap hover:bg-white/10"
                                onClick={async () => { await supabaseBrowser.auth.signOut(); }}
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                ) : (
                    <MenuItem href="/login" active={pathname === "/login"}>Login</MenuItem>
                )}
            </nav>
        </header>
    );
}
