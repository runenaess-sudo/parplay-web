import "server-only";

import { supabaseServer } from "@/lib/supabase-server";
import type { User } from "@supabase/supabase-js";

export type AdminProfile = {
    id: string;
    membership: string;
};

export class AdminAuthError extends Error {
    constructor(
        message: "Unauthorized" | "Forbidden",
        readonly status: 401 | 403,
    ) {
        super(message);
        this.name = "AdminAuthError";
    }
}

/** Authoritative server boundary for admin-only routes and data access. */
export async function requireServerAdmin(): Promise<{
    user: User;
    profile: AdminProfile;
    supabase: Awaited<ReturnType<typeof supabaseServer>>;
}> {
    const supabase = await supabaseServer();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
        throw new AdminAuthError("Unauthorized", 401);
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, membership")
        .eq("id", userData.user.id)
        .maybeSingle();

    if (profileError) {
        throw profileError;
    }

    if (!profile || profile.membership !== "admin") {
        throw new AdminAuthError("Forbidden", 403);
    }

    return {
        user: userData.user,
        profile: profile as AdminProfile,
        supabase,
    };
}
