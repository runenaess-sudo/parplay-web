import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
    const res = NextResponse.next();

    // 1) Ikke blokker RSC fetch (ellers infinite loop)
    if (req.headers.get("rsc") === "1") {
        return res;
    }

    // 2) Opprett Supabase-klient
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                persistSession: false,
                detectSessionInUrl: false,
            },
        }
    );

    // 3) Hent session
    const {
        data: { session },
    } = await supabase.auth.getSession();

    // 4) Hvis ikke logget inn → redirect til login
    if (!session && !req.nextUrl.pathname.startsWith("/login")) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = "/login";
        return NextResponse.redirect(redirectUrl);
    }

    return res;
}

export const config = {
    matcher: [
        "/((?!_next|static|favicon.ico|login|auth|api|.*\\.js|.*\\.css|.*\\.png|.*\\.jpg).*)",
    ],
};
