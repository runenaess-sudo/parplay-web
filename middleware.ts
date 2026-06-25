import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
    const res = NextResponse.next();

    // Server-side Supabase client (no cookies, no auth-helpers)
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                persistSession: false, // middleware skal ikke lagre session
            },
        }
    );

    const {
        data: { session },
    } = await supabase.auth.getSession();

    // Hvis ikke innlogget → redirect til /login
    if (!session && !req.nextUrl.pathname.startsWith("/login")) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = "/login";
        return NextResponse.redirect(redirectUrl);
    }

    return res;
}

// Matcher som IKKE treffer JS, CSS, bilder, Supabase-auth, API, osv.
export const config = {
    matcher: [
        "/((?!_next|static|favicon.ico|login|auth|api|.*\\.js|.*\\.css|.*\\.png|.*\\.jpg).*)",
    ],
};
