import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (code) {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        await supabase.auth.exchangeCodeForSession(code);
    }

    return NextResponse.redirect(new URL("/", req.url));
}
