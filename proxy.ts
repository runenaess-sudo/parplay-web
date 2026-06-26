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

    // Sjekk om vi har noen gyldige Supabase auth-cookies.
    const cookies = req.cookies.getAll();
    const hasSupabaseAuthCookie = cookies.some((cookie) =>
        cookie.name === "sb-access-token" ||
        cookie.name.startsWith("sb-") && /(auth|refresh|access)-token$/.test(cookie.name)
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
