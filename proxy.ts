import { createServerClient } from "@supabase/ssr";
import { getVerifiedServerUser } from "@/lib/supabase-server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function proxy(req: NextRequest) {
    const pathname = req.nextUrl.pathname;
    const isSharedLiveRoundPath = pathname.startsWith("/future/round/");

    const isTournamentLivePath = /^\/future\/tournaments\/[^/]+\/round\/[^/]+\/?$/.test(pathname);

    // Permanent public event resource. Only one UUID segment, never admin/player routes.
    const isPublicEventPath = /^\/future\/tournaments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(pathname);

    // Tillat offentlig startside, login/auth og delte live-runder.
    const publicPath = (
        pathname === "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/auth") ||
        pathname.startsWith("/course-invite/") ||
        pathname.startsWith("/course-manager-transfer/") ||
        pathname === "/courses" ||
        pathname.startsWith("/courses/") ||
        pathname === "/verify-email" ||
        isPublicEventPath ||
        isSharedLiveRoundPath ||
        isTournamentLivePath || /^\/future\/leagues\/[^/]+\/round\/[^/]+\/?$/.test(pathname)
    );


    // Sjekk om vi har noen gyldige Supabase auth-cookies.
    const cookies = req.cookies.getAll();
    const hasSupabaseAuthCookie = cookies.some((cookie) =>
        /^sb-access-token(?:\.\d+)?$/.test(cookie.name) ||
        /^sb-.+-(?:auth|refresh|access)-token(?:\.\d+)?$/.test(cookie.name)
    );

    const bypassRedirect = publicPath || req.headers.get("rsc") === "1";
    let response = NextResponse.next({ request: { headers: req.headers } });
    const authHeaders: Record<string, string> = {};
    const finish = (result: NextResponse) => {
        for (const cookie of response.cookies.getAll()) result.cookies.set(cookie);
        for (const [name, value] of Object.entries(authHeaders)) result.headers.set(name, value);
        return result;
    };
    const login = () => {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = "/login";
        return finish(NextResponse.redirect(redirectUrl));
    };
    if (!hasSupabaseAuthCookie) return bypassRedirect ? response : login();

    const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
            getAll: () => req.cookies.getAll(),
            setAll(values, headers) {
                for (const value of values) req.cookies.set(value.name, value.value);
                const previous = response.cookies.getAll();
                response = NextResponse.next({ request: { headers: req.headers } });
                for (const cookie of previous) response.cookies.set(cookie);
                for (const value of values) response.cookies.set(value.name, value.value, value.options);
                Object.assign(authHeaders, headers);
                for (const [name, value] of Object.entries(authHeaders)) response.headers.set(name, value);
            },
        },
    });
    try {
        const user = await getVerifiedServerUser(client);
        return !user && !bypassRedirect ? login() : response;
    } catch {
        // Do not discard cookies or redirect to login on an Auth/network outage.
        // Public/RSC routing is unchanged; protected server reads still verify identity.
        if (bypassRedirect) return response;
        return finish(new NextResponse("Session verification is temporarily unavailable. Please try again.", {
            status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": "5" },
        }));
    }

}

export const config = {
    matcher: [
        "/((?!_next|__nextjs_font|static|favicon.ico|api|.*\\.js|.*\\.css|.*\\.png|.*\\.jpg|.*\\.woff2|.*\\.woff|.*\\.svg|.*\\.ico).*)",
    ],
};
