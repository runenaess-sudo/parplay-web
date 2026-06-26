import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(req: NextRequest) {
    // Ikke sjekk RSC-requests
    if (req.headers.get("rsc") === "1") {
        return NextResponse.next();
    }

    // Ikke sjekk login-siden og auth-callback
    if (req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/auth")) {
        return NextResponse.next();
    }

    // Sjekk kun cookies
    const access = req.cookies.get("sb-access-token");

    if (!access) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = "/login";
        return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next|__nextjs_font|static|favicon.ico|api|.*\\.js|.*\\.css|.*\\.png|.*\\.jpg|.*\\.woff2|.*\\.woff|.*\\.svg|.*\\.ico).*)",
    ],
};
