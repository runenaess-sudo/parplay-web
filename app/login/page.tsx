"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPageClient() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);

        const { data, error } = await supabaseBrowser.auth.signInWithPassword({
            email,
            password,
        });

        setLoading(false);

        if (error) {
            setErrorMsg(error.message);
            return;
        }

        // Bekreft at session er satt og naviger videre
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        console.log("session after signIn:", sessionData);
        router.push("/create-course");
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: "center", height: "100vh" }}>
            <h1>Logg inn</h1>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required style={{ padding: 12, width: 260 }} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required style={{ padding: 12, width: 260 }} />
            {errorMsg && <div style={{ color: "red" }}>{errorMsg}</div>}
            <button type="submit" disabled={loading} style={{ padding: 12, width: 260, background: "#2D6CDF", color: "white", borderRadius: 8 }}>
                {loading ? "Logger inn…" : "Logg inn"}
            </button>
        </form>
    );
}