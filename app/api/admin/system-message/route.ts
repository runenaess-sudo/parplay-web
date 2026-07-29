import { getUserAccess } from "@/lib/access";
import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const access = await getUserAccess();
        if (access.membership !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { message, recipientMode, recipientIds } = await request.json();
        const text = String(message || "").trim();

        if (!text) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const supabase = await supabaseServer();

        let targetUserIds: string[] = [];

        if (recipientMode === "custom") {
            targetUserIds = Array.from(
                new Set(
                    (recipientIds || [])
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

            targetUserIds = (profiles ?? []).map((row: any) => String(row.id));
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
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Failed to send system message" }, { status: 500 });
    }
}
