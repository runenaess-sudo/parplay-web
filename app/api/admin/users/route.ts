import { getUserAccess } from "@/lib/access";
import { supabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const access = await getUserAccess();
        if (access.membership !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const supabase = await supabaseServer();
        const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, username, membership")
            .order("full_name", { ascending: true })
            .limit(100);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ users: data ?? [] });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Failed to load users" }, { status: 500 });
    }
}
