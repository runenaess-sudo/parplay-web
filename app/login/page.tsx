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
        console.log("TRYKKET PÅ LOGIN");

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        console.log("LOGIN RESULT:", { data, error });

        if (error) {
            setErrorMsg(error.message);
            return;
        }

        window.location.href = "/";
    }

    return (
        <div style={{ padding: 40 }}>
            <h1>Logg inn</h1>

            <input
                type="email"
                placeholder="E‑post"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <input
                type="password"
                placeholder="Passord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}

            <button onClick={handleLogin}>Logg inn</button>
        </div>
    );
}
