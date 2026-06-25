"use client";

import { createBrowserClient } from "@supabase/auth-helpers-nextjs";
import { useState } from "react";

export default function LoginPage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    async function handleLogin() {
        setErrorMsg("");

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMsg("Feil e‑post eller passord");
            return;
        }

        // Redirect til forsiden
        window.location.href = "/";
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

            <input
                type="email"
                placeholder="E‑post"
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

            <input
                type="password"
                placeholder="Passord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                    padding: "12px 16px",
                    width: 260,
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    fontSize: 16,
                }}
            />

            {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}

            <button
                onClick={handleLogin}
                style={{
                    padding: "12px 16px",
                    width: 260,
                    borderRadius: 8,
                    background: "#0070f3",
                    color: "white",
                    fontSize: 16,
                    cursor: "pointer",
                }}
            >
                Logg inn
            </button>
        </div>
    );
}
