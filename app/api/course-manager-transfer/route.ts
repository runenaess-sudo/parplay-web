import { COURSE_ID_PATTERN, COURSE_MANAGER_TRANSFER_TOKEN_PATTERN, maskTransferEmail } from "@/lib/course-manager-transfer";
import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

function edgeFunctionUrl() {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return base ? new URL("/functions/v1/course-manager-transfer", base) : null;
}
function json(body: Record<string, unknown>, status = 200) {
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
async function session() {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getSession();
    return { supabase, session: data.session };
}
async function pendingTransferForCourse(courseId: string) {
    const { supabase, session: activeSession } = await session();
    if (!activeSession) return { error: json({ error: "UNAUTHORIZED" }, 401) };
    const [{ data: profile }, { data: assigned }] = await Promise.all([
        supabase.from("profiles").select("membership").eq("id", activeSession.user.id).maybeSingle(),
        supabase.rpc("is_course_manager_v1", { p_course_id: courseId, p_user_id: activeSession.user.id }),
    ]);
    if (profile?.membership !== "admin" && assigned !== true) {
        return { error: json({ error: "COURSE_MANAGER_TRANSFER_NOT_AUTHORIZED" }, 403) };
    }
    const { data, error } = await supabase.from("course_manager_transfers")
        .select("id,intended_email_normalized,status,expires_at,delivery_status,sent_at,last_delivery_attempt_at,delivery_attempt_count")
        .eq("course_id", courseId).eq("status", "pending").gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return { error: json({ error: "TRANSFER_STATE_UNAVAILABLE" }, 503) };
    return { supabase, session: activeSession, transfer: data };
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";
    if (token) {
        if (!COURSE_MANAGER_TRANSFER_TOKEN_PATTERN.test(token)) return json({ state: "invalid" }, 404);
        const upstream = edgeFunctionUrl();
        if (!upstream) return json({ state: "unavailable" }, 503);
        upstream.searchParams.set("token", token);
        try {
            const response = await fetch(upstream, { cache: "no-store" });
            return json(await response.json() as Record<string, unknown>, response.status);
        } catch { return json({ state: "unavailable" }, 502); }
    }
    const courseId = url.searchParams.get("courseId") ?? "";
    if (!COURSE_ID_PATTERN.test(courseId)) return json({ error: "INVALID_REQUEST" }, 400);
    const result = await pendingTransferForCourse(courseId);
    if (result.error) return result.error;
    const transfer = result.transfer;
    return json({ transfer: transfer ? {
        maskedEmail: maskTransferEmail(transfer.intended_email_normalized), status: transfer.status,
        deliveryStatus: transfer.delivery_status, expiresAt: transfer.expires_at, sentAt: transfer.sent_at,
        lastDeliveryAttemptAt: transfer.last_delivery_attempt_at, deliveryAttemptCount: transfer.delivery_attempt_count,
    } : null });
}

export async function POST(request: Request) {
    let body: Record<string, unknown>;
    try { body = await request.json() as Record<string, unknown>; } catch { return json({ error: "INVALID_REQUEST" }, 400); }
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "accept") {
        const token = typeof body.token === "string" ? body.token : "";
        if (!COURSE_MANAGER_TRANSFER_TOKEN_PATTERN.test(token)) return json({ error: "COURSE_MANAGER_TRANSFER_INVALID" }, 404);
        const { session: activeSession } = await session();
        if (!activeSession) return json({ error: "UNAUTHORIZED" }, 401);
        const upstream = edgeFunctionUrl();
        if (!upstream) return json({ error: "UNAVAILABLE" }, 503);
        try {
            const response = await fetch(upstream, { method: "POST", headers: {
                "Content-Type": "application/json", Authorization: `Bearer ${activeSession.access_token}`,
            }, body: JSON.stringify({ action: "accept", token }), cache: "no-store" });
            return json(await response.json() as Record<string, unknown>, response.status);
        } catch { return json({ error: "UNAVAILABLE" }, 502); }
    }
    const courseId = typeof body.courseId === "string" ? body.courseId : "";
    if (!COURSE_ID_PATTERN.test(courseId)) return json({ error: "INVALID_REQUEST" }, 400);
    const result = await pendingTransferForCourse(courseId);
    if (result.error) return result.error;
    if (action === "cancel") {
        if (!result.transfer) return json({ error: "COURSE_MANAGER_TRANSFER_NOT_PENDING" }, 409);
        const { error } = await result.supabase!.rpc("cancel_course_manager_transfer_v1", { p_transfer_id: result.transfer.id });
        return error ? json({ error: "COURSE_MANAGER_TRANSFER_FAILED" }, 409) : json({ outcome: "cancelled" });
    }
    if (action !== "create" && action !== "resend") return json({ error: "INVALID_REQUEST" }, 400);
    if (action === "create" && result.transfer) return json({ error: "COURSE_MANAGER_TRANSFER_ALREADY_PENDING" }, 409);
    if (action === "resend" && !result.transfer) return json({ error: "COURSE_MANAGER_TRANSFER_NOT_PENDING" }, 409);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const upstream = edgeFunctionUrl();
    if (!upstream) return json({ error: "UNAVAILABLE" }, 503);
    try {
        const response = await fetch(upstream, { method: "POST", headers: {
            "Content-Type": "application/json", Authorization: `Bearer ${result.session!.access_token}`,
        }, body: JSON.stringify(action === "create" ? { action, courseId, email }
            : { action, transferId: result.transfer!.id }), cache: "no-store" });
        return json(await response.json() as Record<string, unknown>, response.status);
    } catch { return json({ error: "UNAVAILABLE" }, 502); }
}
