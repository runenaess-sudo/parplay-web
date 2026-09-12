// src/components/Header/Header.tsx
"use client";

import { getUserAccess } from "@/lib/access";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuItem } from "../Header/MenuItem"; // juster path hvis MenuItem ligger et annet sted

type AccessInfo = {
    membership: string;
    limits: Record<string, unknown> | null;
};

type ActiveCourseInvitation = { invitation_id: string; course_name: string };

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();

    const [session, setSession] = useState<Session | null>(null);
    const [access, setAccess] = useState<AccessInfo | null>(null);
    const [invitations, setInvitations] = useState<ActiveCourseInvitation[]>([]);
    const [showInvitations, setShowInvitations] = useState(false);

    useEffect(() => {
        async function loadSessionAndAccess() {
            const { data: { session } } = await supabaseBrowser.auth.getSession();
            setSession(session);

            if (session?.user) {
                const nextAccess = await getUserAccess();
                setAccess(nextAccess);
                const response = await fetch("/api/course-invitations", { cache: "no-store" });
                const body = response.ok ? await response.json() as { invitations?: ActiveCourseInvitation[] } : null;
                setInvitations(body?.invitations ?? []);
            } else {
                setAccess(null);
                setInvitations([]);
            }
        }

        loadSessionAndAccess();

        const { data: authSub } = supabaseBrowser.auth.onAuthStateChange(async (_event, nextSession) => {
            setSession(nextSession);

            if (nextSession?.user) {
                const nextAccess = await getUserAccess();
                setAccess(nextAccess);
                const response = await fetch("/api/course-invitations", { cache: "no-store" });
                const body = response.ok ? await response.json() as { invitations?: ActiveCourseInvitation[] } : null;
                setInvitations(body?.invitations ?? []);
            } else {
                setAccess(null);
                setInvitations([]);
            }
        });

        return () => {
            authSub.subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        async function refreshInvitations() {
            const [nextAccess, response] = await Promise.all([
                getUserAccess(),
                fetch("/api/course-invitations", { cache: "no-store" }),
            ]);
            const body = response.ok
                ? await response.json() as { invitations?: ActiveCourseInvitation[] }
                : null;
            setAccess(nextAccess);
            setInvitations(body?.invitations ?? []);
            setShowInvitations(false);
        }
        window.addEventListener("course-invitations-changed", refreshInvitations);
        return () => window.removeEventListener("course-invitations-changed", refreshInvitations);
    }, []);

    const isLoggedIn = !!session?.user;
    const canCreateCourse =
        access?.membership === "admin" || access?.limits?.can_create_course !== false;

    async function handleLogout() {
        await supabaseBrowser.auth.signOut();
        router.push("/");
        router.refresh();
    }

    return (
        <header className="parplay-header">
            <Link href="/" className="text-xl font-semibold">ParPlay</Link>

            {isLoggedIn ? (
                <nav className="menu">
                    {invitations.length > 0 && <div className="relative">
                        <button type="button" aria-label={`${invitations.length} course invitation${invitations.length === 1 ? "" : "s"}`} aria-expanded={showInvitations} onClick={() => setShowInvitations((visible) => !visible)} className="relative rounded-full p-2 text-white hover:bg-white/10">
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m9-6a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4">{invitations.length}</span>
                        </button>
                        {showInvitations && <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/10 bg-black/95 p-3 text-white shadow-xl backdrop-blur-md">
                            <p className="text-sm font-semibold">Course invitations</p>
                            {invitations.map((invitation) => <div key={invitation.invitation_id} className="mt-3 border-t border-white/10 pt-3">
                                <p className="text-sm text-gray-300">You have a course ready to manage</p><p className="mt-1 font-semibold">{invitation.course_name}</p>
                                <Link onClick={() => setShowInvitations(false)} className="mt-2 inline-block text-sm text-blue-300" href={`/course-invitations/${invitation.invitation_id}`}>Open invitation</Link>
                            </div>)}
                        </div>}
                    </div>}
                    <MenuItem href="/community" active={pathname.startsWith("/community")}>Community</MenuItem>

                    {access?.membership === "admin" && (
                        <MenuItem href="/admin" active={pathname.startsWith("/admin")}>Admin</MenuItem>
                    )}

                    {(access?.membership === "club_manager" || access?.membership === "admin") && (
                        <MenuItem href="/club-manager" active={pathname.startsWith("/club-manager")}>Club Manager</MenuItem>
                    )}

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
                                onClick={handleLogout}
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
