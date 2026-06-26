import { supabaseServerWithResponse } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const formData = await req.formData();
    const email = formData.get("email")?.toString() ?? "";
    const password = formData.get("password")?.toString() ?? "";

    const response = NextResponse.redirect(new URL("/", req.url), { status: 303 });
    const supabase = await supabaseServerWithResponse(response);

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url), { status: 303 });
    }

    return response;
}
