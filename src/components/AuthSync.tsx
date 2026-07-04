// src/components/AuthSync.tsx
"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffect } from "react";

export default function AuthSync() {
    useEffect(() => {
        (async () => {
            const { data: sessionData } = await supabaseBrowser.auth.getSession();
            console.log("Auth init session:", sessionData);
        })();

        const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
            console.log("Auth event:", _event, session);
        });

        return () => sub?.subscription?.unsubscribe?.();
    }, []);

    return null;
}
