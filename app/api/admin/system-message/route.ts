import { AdminAuthError, requireServerAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { supabase } = await requireServerAdmin();

        const { message, recipientMode, recipientIds } = await request.json();
        const text = String(message || "").trim();

        if (!text) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        let targetUserIds: string[] = [];

        if (recipientMode === "custom") {
            const requestedRecipientIds: unknown[] = Array.isArray(recipientIds) ? recipientIds : [];
            targetUserIds = Array.from(
                new Set(
                    requestedRecipientIds
                        .map((id: unknown) => String(id || "").trim())
                        .filter(Boolean)
                )
            );
        } else {
            const { data: profiles, error: profileError } = await supabase
                .from("profiles")
                .select("id")
                .order("id", { ascending: true });

            if (profileError) {
                throw profileError;
            }

            targetUserIds = (profiles ?? []).map((row) => String(row.id));
        }

        if (!targetUserIds.length) {
            return NextResponse.json({ error: "No recipients found" }, { status: 400 });
        }

        const rows = targetUserIds.map((userId) => ({
            user_id: userId,
            message: text,
            read: false,
        }));

        const { error } = await supabase.from("system_notifications").insert(rows);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ sent: rows.length });
    } catch (error: unknown) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        const message = error instanceof Error ? error.message : "Failed to send system message";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
