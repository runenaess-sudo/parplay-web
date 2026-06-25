import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
    const res = NextResponse.next();

    // ⭐ 1: Ikke kjør auth-sjekk på RSC-requests
    if (req.headers.get("rsc") === "1") {
        return res;
    }

    // ⭐ 2: Ikke sjekk auth på login-siden
    if (req.nextUrl.pathname.startsWith("/login")) {
        return res;
    }

    // ⭐ 3: Sjekk kun cookies (ikke Supabase-klient)
    const access = req.cookies.get("sb-access-token");

    if (!access) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = "/login";
        return NextResponse.redirect(redirectUrl);
    }

    return res;
}

export const config = {
    matcher: [
        "/((?!_next|static|favicon.ico|api|.*\\.js|.*\\.css|.*\\.png|.*\\.jpg).*)",
    ],
};
