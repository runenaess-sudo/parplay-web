import { supabaseServerWithResponse } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const response = NextResponse.redirect(new URL("/", req.url));

    if (code) {
        const supabase = await supabaseServerWithResponse(response);
        await supabase.auth.exchangeCodeForSession(code);
    }

    return response;
}
