"use server";

import { supabaseServer } from "@/src/lib/supabase-server";

export async function loginAction(email: string, password: string) {
    // ⭐ supabaseServer ER async hos deg → må await’es
    const supabase = await supabaseServer();

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return { error: error.message };
    }

    return { success: true };
}
