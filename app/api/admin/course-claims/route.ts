import { AdminAuthError, requireServerAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

const claimStatuses = new Set(["pending", "accepted", "declined", "all"]);
const decisions = new Set(["accepted", "declined"]);

function apiError(error: unknown, fallback: string) {
    if (error instanceof AdminAuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : fallback;
    return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
    try {
        const { supabase } = await requireServerAdmin();
        const requestedStatus = new URL(request.url).searchParams.get("status") ?? "pending";
        const status = requestedStatus.toLowerCase();

        if (!claimStatuses.has(status)) {
            return NextResponse.json({ error: "Invalid claim status" }, { status: 400 });
        }

        let query = supabase
            .from("course_claim_requests")
            .select("id, status, created_at, decided_at, requested_by, course_id, club_id")
            .order("created_at", { ascending: false });

        if (status !== "all") {
            query = query.eq("status", status);
        }

        const { data: claims, error: claimsError } = await query;
        if (claimsError) throw claimsError;

        const rows = claims ?? [];
        const courseIds = [...new Set(rows.map((claim) => claim.course_id).filter(Boolean))];
        const clubIds = [...new Set(rows.map((claim) => claim.club_id).filter(Boolean))];
        const requesterIds = [...new Set(rows.map((claim) => claim.requested_by).filter(Boolean))];

        const [coursesResult, clubsResult, profilesResult] = await Promise.all([
            courseIds.length
                ? supabase.from("courses").select("id, name").in("id", courseIds)
                : Promise.resolve({ data: [], error: null }),
            clubIds.length
                ? supabase.from("clubs").select("id, name").in("id", clubIds)
                : Promise.resolve({ data: [], error: null }),
            requesterIds.length
                ? supabase.from("profiles").select("id, full_name, username").in("id", requesterIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        if (coursesResult.error) throw coursesResult.error;
        if (clubsResult.error) throw clubsResult.error;
        if (profilesResult.error) throw profilesResult.error;

        const courseNames = new Map((coursesResult.data ?? []).map((row) => [row.id, row.name]));
        const clubNames = new Map((clubsResult.data ?? []).map((row) => [row.id, row.name]));
        const requesterNames = new Map(
            (profilesResult.data ?? []).map((row) => [
                row.id,
                row.full_name || (row.username ? `@${row.username}` : null),
            ])
        );

        return NextResponse.json({
            claims: rows.map((claim) => ({
                ...claim,
                course_name: courseNames.get(claim.course_id) ?? null,
                club_name: claim.club_id ? clubNames.get(claim.club_id) ?? null : null,
                requester_name: requesterNames.get(claim.requested_by) ?? null,
            })),
        });
    } catch (error: unknown) {
        return apiError(error, "Failed to load course claims");
    }
}

export async function POST(request: Request) {
    try {
        const { supabase } = await requireServerAdmin();
        const payload = await request.json();
        const claimId = String(payload?.claimId ?? "").trim();
        const decision = String(payload?.decision ?? "").trim().toLowerCase();

        if (!claimId) {
            return NextResponse.json({ error: "Claim ID is required" }, { status: 400 });
        }
        if (!decisions.has(decision)) {
            return NextResponse.json({ error: "Invalid claim decision" }, { status: 400 });
        }

        const { data, error } = await supabase.rpc("manual_course_claim_decision_v1", {
            claim_id: claimId,
            decision,
        });

        if (error) throw error;
        return NextResponse.json({ result: data });
    } catch (error: unknown) {
        return apiError(error, "Failed to decide course claim");
    }
}
