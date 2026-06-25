import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(req: NextRequest) {
    const res = NextResponse.next();

    // Ikke sjekk RSC-requests
    if (req.headers.get("rsc") === "1") {
        return res;
    }

    // Ikke sjekk login-siden
    if (req.nextUrl.pathname.startsWith("/login")) {
        return res;
    }

    // Sjekk kun cookies
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
