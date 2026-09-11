import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicActivationErrors = new Set([
    "COURSE_INVITATION_REVOKED", "COURSE_INVITATION_USED", "COURSE_INVITATION_EXPIRED",
    "COURSE_INVITATION_WRONG_ACCOUNT", "COURSE_INVITATION_EMAIL_NOT_VERIFIED",
    "COURSE_INVITATION_CLAIM_INVALID", "COURSE_INVITATION_RELATION_INVALID",
    "COURSE_INVITATION_PROFILE_NOT_FOUND", "COURSE_INVITATION_CLUB_CONFLICT",
]);

export async function GET() {
    const supabase = await supabaseServer();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const { data, error } = await supabase.rpc("get_my_active_course_owner_invitations_v1");
    if (error) {
        console.error("course_invitation_discovery_failed", { code: error.code });
        return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
    }
    return NextResponse.json({ invitations: data ?? [] });
}

export async function POST(request: Request) {
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
    if (!uuidPattern.test(invitationId)) return NextResponse.json({ error: "COURSE_INVITATION_INVALID" }, { status: 400 });

    const supabase = await supabaseServer();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const { data, error } = await supabase.rpc("activate_my_course_owner_invitation_v1", { p_invitation_id: invitationId });
    if (error) {
        const reason = publicActivationErrors.has(error.message) ? error.message : "COURSE_INVITATION_ACTIVATION_FAILED";
        console.warn("course_invitation_continuation_denied", { reason, code: error.code });
        return NextResponse.json({ error: reason }, { status: error.code === "42501" ? 403 : 409 });
    }
    return NextResponse.json({ outcome: "activated", result: data });
}
