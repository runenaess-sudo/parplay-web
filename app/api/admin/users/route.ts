import { AdminAuthError, requireServerAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const { supabase } = await requireServerAdmin();
        const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, username, membership")
            .order("full_name", { ascending: true })
            .limit(100);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ users: data ?? [] });
    } catch (error: unknown) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        const message = error instanceof Error ? error.message : "Failed to load users";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
