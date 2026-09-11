import { AdminAuthError, requireServerAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

const claimStatuses = new Set(["pending", "accepted", "declined", "all"]);
const contactStates = new Set(["known", "unknown", "review", "all"]);
const decisions = new Set(["accepted", "declined"]);

type InvitationRow = {
    id: string;
    claim_id: string;
    recipient_email: string;
    delivery_status: string;
    sent_at: string | null;
    expires_at: string;
    consumed_at: string | null;
    revoked_at: string | null;
    created_at: string;
};

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
        const searchParams = new URL(request.url).searchParams;
        const requestedStatus = searchParams.get("status") ?? "pending";
        const status = requestedStatus.toLowerCase();
        const contactState = (searchParams.get("contactState") ?? "all").toLowerCase();

        if (!claimStatuses.has(status)) {
            return NextResponse.json({ error: "Invalid claim status" }, { status: 400 });
        }
        if (!contactStates.has(contactState)) {
            return NextResponse.json({ error: "Invalid owner contact state" }, { status: 400 });
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

        const claimIds = rows.map((claim) => claim.id);
        const [coursesResult, clubsResult, contactsResult, invitationsResult] = await Promise.all([
            courseIds.length
                ? supabase.from("courses").select("id, name, created_by").in("id", courseIds)
                : Promise.resolve({ data: [], error: null }),
            clubIds.length
                ? supabase.from("clubs").select("id, name").in("id", clubIds)
                : Promise.resolve({ data: [], error: null }),
            courseIds.length
                ? supabase
                    .from("course_contacts")
                    .select("course_id, owner_contact_status, name, email, phone, club, role")
                    .in("course_id", courseIds)
                : Promise.resolve({ data: [], error: null }),
            claimIds.length
                ? supabase.from("course_owner_invitations")
                    .select("id,claim_id,recipient_email,delivery_status,sent_at,expires_at,consumed_at,revoked_at,created_at")
                    .in("claim_id", claimIds)
                    .order("created_at", { ascending: false })
                : Promise.resolve({ data: [], error: null }),
        ]);

        if (coursesResult.error) throw coursesResult.error;
        if (clubsResult.error) throw clubsResult.error;
        if (contactsResult.error) throw contactsResult.error;
        if (invitationsResult.error) throw invitationsResult.error;

        const courseRows = coursesResult.data ?? [];
        const profileIds = [...new Set([
            ...rows.map((claim) => claim.requested_by),
            ...courseRows.map((course) => course.created_by),
        ].filter(Boolean))];
        const profilesResult = profileIds.length
            ? await supabase
                .from("profiles")
                .select("id, full_name, username")
                .in("id", profileIds)
            : { data: [], error: null };
        if (profilesResult.error) throw profilesResult.error;

        const courses = new Map(courseRows.map((row) => [row.id, row]));
        const clubNames = new Map((clubsResult.data ?? []).map((row) => [row.id, row.name]));
        const profileNames = new Map(
            (profilesResult.data ?? []).map((row) => [
                row.id,
                row.full_name || (row.username ? `@${row.username}` : null),
            ])
        );
        const contacts = new Map(
            (contactsResult.data ?? []).map((row) => [row.course_id, row])
        );
        const invitations = new Map<string, InvitationRow>();
        for (const invitation of (invitationsResult.data ?? []) as InvitationRow[]) {
            if (!invitations.has(invitation.claim_id)) invitations.set(invitation.claim_id, invitation);
        }

        const enrichedClaims = rows.map((claim) => {
            const course = courses.get(claim.course_id);
            const contact = contacts.get(claim.course_id);
            const ownerContactStatus = contact?.owner_contact_status === "known"
                || contact?.owner_contact_status === "unknown"
                ? contact.owner_contact_status
                : null;
            const invitation = invitations.get(claim.id) ?? null;

            return {
                ...claim,
                course_name: course?.name ?? null,
                course_created_by: course?.created_by ?? null,
                creator_name: course?.created_by
                    ? profileNames.get(course.created_by) ?? null
                    : null,
                club_name: claim.club_id ? clubNames.get(claim.club_id) ?? null : null,
                requester_name: profileNames.get(claim.requested_by) ?? null,
                owner_contact_status: ownerContactStatus,
                contact_name: contact?.name ?? null,
                contact_email: contact?.email ?? null,
                contact_phone: contact?.phone ?? null,
                contact_organization: contact?.club ?? null,
                contact_role: contact?.role ?? null,
                invitation,
            };
        });

        const filteredClaims = contactState === "all"
            ? enrichedClaims
            : enrichedClaims.filter((claim) =>
                contactState === "review"
                    ? claim.owner_contact_status === null
                    : claim.owner_contact_status === contactState
            );

        return NextResponse.json({
            claims: filteredClaims,
        });
    } catch (error: unknown) {
        return apiError(error, "Failed to load course claims");
    }
}

export async function POST(request: Request) {
    try {
        const { supabase } = await requireServerAdmin();
        const payload = await request.json();
        const action = String(payload?.action ?? "decision").trim().toLowerCase();
        const claimId = String(payload?.claimId ?? "").trim();

        if (!claimId) {
            return NextResponse.json({ error: "Claim ID is required" }, { status: 400 });
        }

        if (action === "prepare") {
            const clubId = String(payload?.clubId ?? "").trim() || null;
            const newClubName = String(payload?.newClubName ?? "").trim() || null;
            const contactEmail = String(payload?.contactEmail ?? "").trim();

            if ((!clubId && !newClubName) || (clubId && newClubName)) {
                return NextResponse.json(
                    { error: "Select an existing club or enter a new club name" },
                    { status: 400 }
                );
            }
            if (!contactEmail) {
                return NextResponse.json({ error: "Owner email is required" }, { status: 400 });
            }

            const { data, error } = await supabase.rpc(
                "prepare_course_ownership_invitation_v1",
                {
                    claim_id: claimId,
                    existing_club_id: clubId,
                    new_club_name: newClubName,
                    contact_name: String(payload?.contactName ?? "").trim() || null,
                    contact_email: contactEmail,
                    contact_phone: String(payload?.contactPhone ?? "").trim() || null,
                    contact_organization:
                        String(payload?.contactOrganization ?? "").trim() || null,
                    contact_role: String(payload?.contactRole ?? "").trim() || null,
                }
            );

            if (error) throw error;
            return NextResponse.json({ result: data });
        }

        if (action === "send-invitation") {
            const { data, error } = await supabase.functions.invoke("course-owner-invite", {
                body: { action: "send", claim_id: claimId },
            });
            if (error) throw error;
            return NextResponse.json({ result: data });
        }

        const decision = String(payload?.decision ?? "").trim().toLowerCase();
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
