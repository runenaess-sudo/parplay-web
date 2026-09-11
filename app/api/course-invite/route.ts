import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const tokenPattern = /^[0-9a-f]{64}$/i;

function functionUrl() {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return base ? new URL("/functions/v1/course-owner-invite", base) : null;
}

export async function GET(request: Request) {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!tokenPattern.test(token)) return NextResponse.json({ state: "invalid" }, { status: 400 });
    const upstream = functionUrl();
    if (!upstream) return NextResponse.json({ state: "unavailable" }, { status: 503 });
    upstream.searchParams.set("token", token);
    try {
        const response = await fetch(upstream, { cache: "no-store" });
        return NextResponse.json(await response.json(), { status: response.status });
    } catch {
        return NextResponse.json({ state: "unavailable" }, { status: 502 });
    }
}

export async function POST(request: Request) {
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const token = typeof body.token === "string" ? body.token : "";
    if (!tokenPattern.test(token)) return NextResponse.json({ error: "COURSE_INVITATION_INVALID" }, { status: 400 });
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const upstream = functionUrl();
    if (!upstream) return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
    try {
        const response = await fetch(upstream, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ action: "activate", token }),
            cache: "no-store",
        });
        return NextResponse.json(await response.json(), { status: response.status });
    } catch {
        return NextResponse.json({ error: "UNAVAILABLE" }, { status: 502 });
    }
}
