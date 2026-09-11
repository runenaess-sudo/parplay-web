import { AdminAuthError, requireServerAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

function apiError(error: unknown) {
    if (error instanceof AdminAuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to search clubs" }, { status: 500 });
}

export async function GET(request: Request) {
    try {
        const { supabase } = await requireServerAdmin();
        const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";

        if (search.length < 2) {
            return NextResponse.json({ clubs: [] });
        }

        const escapedSearch = search.replaceAll("%", "\\%").replaceAll("_", "\\_");
        const { data, error } = await supabase
            .from("clubs")
            .select("id, name")
            .ilike("name", `%${escapedSearch}%`)
            .order("name", { ascending: true })
            .limit(20);

        if (error) throw error;
        return NextResponse.json({ clubs: data ?? [] });
    } catch (error: unknown) {
        return apiError(error);
    }
}
