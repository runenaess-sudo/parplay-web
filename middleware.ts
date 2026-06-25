import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
    const res = NextResponse.next();

    // ⭐ KRITISK: Ikke blokker RSC fetch (ellers infinite loop)
    if (req.headers.get("rsc") === "1") {
        return res;
    }

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

    const {
        data: { session },
    } = await supabase.auth.getSession();

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
