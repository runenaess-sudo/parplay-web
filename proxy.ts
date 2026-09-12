import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(req: NextRequest) {
    const pathname = req.nextUrl.pathname;
    const isSharedLiveRoundPath = pathname.startsWith("/future/round/");

    // Ikke sjekk RSC-requests
    if (req.headers.get("rsc") === "1") {
        return NextResponse.next();
    }

    // Tillat offentlig startside, login/auth og delte live-runder.
    if (
        pathname === "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/auth") ||
        pathname.startsWith("/course-invite/") ||
        pathname === "/courses" ||
        pathname.startsWith("/courses/") ||
        pathname === "/verify-email" ||
        isSharedLiveRoundPath
    ) {
        return NextResponse.next();
    }

    // Sjekk om vi har noen gyldige Supabase auth-cookies.
    const cookies = req.cookies.getAll();
    const hasSupabaseAuthCookie = cookies.some((cookie) =>
        /^sb-access-token(?:\.\d+)?$/.test(cookie.name) ||
        /^sb-.+-(?:auth|refresh|access)-token(?:\.\d+)?$/.test(cookie.name)
    );

    if (!hasSupabaseAuthCookie) {
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
