import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function createCookieAdapter(cookieStore: CookieStore) {
    return {
        setAll(values: { name: string; value: string; options?: Record<string, unknown> }[]) {
            try {
                for (const value of values) cookieStore.set(value.name, value.value, normalizeCookieOptions(value.options));
            } catch {
                // Server Components cannot write cookies. Proxy performs refresh
                // before rendering; Route Handlers/Actions can persist here.
            }
        },
        getAll() {
            const all = cookieStore.getAll();
            return all?.map((cookie) => ({
                name: cookie.name,
                value: cookie.value,
            })) ?? null;
        },
    };
}

function normalizeCookieOptions(options?: Record<string, unknown>) {
    const normalized = {
        path: "/",
        ...(options ?? {}),
    } as Record<string, unknown>;

    if (process.env.NODE_ENV !== "production" && normalized.secure === undefined) {
        normalized.secure = false;
    }

    if (normalized.sameSite === undefined) {
        normalized.sameSite = "lax";
    }

    return normalized;
}

export async function supabaseServer() {
    const cookieStore = await cookies();

    return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        cookies: createCookieAdapter(cookieStore),
    });
}

export async function supabaseServerWithResponse(response: NextResponse) {
    const cookieStore = await cookies();

    return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        cookies: {
            getAll() {
                const all = cookieStore.getAll();
                return all?.map((cookie) => ({
                    name: cookie.name,
                    value: cookie.value,
                })) ?? null;
            },
            setAll(cookies, headers) {
                for (const cookie of cookies) {
                    try { cookieStore.set(cookie.name, cookie.value, normalizeCookieOptions(cookie.options)); } catch { /* Read-only render context. */ }
                    response.cookies.set(cookie.name, cookie.value, normalizeCookieOptions(cookie.options));
                }

                if (headers) {
                    for (const [name, value] of Object.entries(headers)) {
                        response.headers.set(name, value);
                    }
                }
            },
        },
    });
}

/** A verification outage is not proof that a stored session has been revoked. */
export class SessionVerificationUnavailableError extends Error {
    constructor() { super("Could not verify your session. Please try again when connected."); this.name = "SessionVerificationUnavailableError"; }
}

export async function getVerifiedServerUser(client: SupabaseClient) {
    const invalid = (error: { name?: string; status?: number; code?: string }) =>
        error.name === "AuthSessionMissingError"
        || ["bad_jwt", "session_not_found", "session_expired", "refresh_token_not_found", "refresh_token_already_used", "user_not_found", "user_banned"].includes(error.code ?? "")
        || (error.name === "AuthApiError" && (error.status === 401 || error.status === 403));
    try {
        const { data, error } = await client.auth.getUser();
        if (error) {
            if (invalid(error)) return null;
            throw new SessionVerificationUnavailableError();
        }
        return data.user;
    } catch (error) {
        if (error && typeof error === "object" && invalid(error)) return null;
        throw new SessionVerificationUnavailableError();
    }
}
