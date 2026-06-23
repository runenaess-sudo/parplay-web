"use client";

import { createClient } from "@supabase/supabase-js";

export const supabaseBrowser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

console.log("SUPABASE BROWSER URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("SUPABASE BROWSER KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 10));
