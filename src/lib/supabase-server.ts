import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function createCookieAdapter(cookieStore: {
    getAll(): Array<{ name: string; value: string }>;
    set(cookie: { name: string; value: string; options?: Record<string, unknown> }): void;
}) {
    return {
        getAll() {
            const all = cookieStore.getAll();
            return all?.map((cookie) => ({
                name: cookie.name,
                value: cookie.value,
            })) ?? null;
        },
        setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            for (const cookie of cookies) {
                cookieStore.set({
                    name: cookie.name,
                    value: cookie.value,
                    ...cookie.options,
                });
            }
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
            setAll(cookies) {
                for (const cookie of cookies) {
                    response.cookies.set(cookie.name, cookie.value, normalizeCookieOptions(cookie.options));
                }
            },
        },
    });
}
