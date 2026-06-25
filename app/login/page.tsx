"use client";

import { createBrowserClient } from "@supabase/auth-helpers-nextjs";
import { useState } from "react";

export default function LoginPage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleLogin() {
        setLoading(true);

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${location.origin}/auth/callback`,
            },
        });

        setLoading(false);

        if (!error) {
            setSent(true);
        } else {
            alert("Kunne ikke sende e‑post. Sjekk adressen.");
        }
    }

    return (
        <div
            style={{
                display: "flex",
                height: "100vh",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 20,
                fontFamily: "sans-serif",
            }}
        >
            <h1>Logg inn</h1>

            {sent ? (
                <p>Sjekk e‑posten din for magisk innloggingslink.</p>
            ) : (
                <>
                    <input
                        type="email"
                        placeholder="Din e‑postadresse"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{
                            padding: "12px 16px",
                            width: 260,
                            borderRadius: 8,
                            border: "1px solid #ccc",
                            fontSize: 16,
                        }}
                    />

                    <button
                        onClick={handleLogin}
                        disabled={loading || !email}
                        style={{
                            padding: "12px 16px",
                            width: 260,
                            borderRadius: 8,
                            background: "#0070f3",
                            color: "white",
                            fontSize: 16,
                            cursor: "pointer",
                            opacity: loading ? 0.6 : 1,
                        }}
                    >
                        {loading ? "Sender..." : "Send magisk link"}
                    </button>
                </>
            )}
        </div>
    );
}
