import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
    const res = NextResponse.next();

    // ⭐ KRITISK: Ikke kjør auth-sjekk på RSC-requests
    if (req.headers.get("rsc") === "1") {
        return res;
    }

    // ⭐ Ikke sjekk auth på login-siden
    if (req.nextUrl.pathname.startsWith("/login")) {
        return res;
    }

    // ⭐ Hvis du vil beskytte sider, gjør det KUN på navigasjon (ikke RSC)
    const session = req.cookies.get("sb-access-token");

    if (!session) {
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
