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

        try {
            const { data, error } = await supabaseBrowser.auth.signInWithPassword({
                email,
                password,
            });

            if (error || !data.session) {
                setErrorMsg(error?.message || "Login failed. Please try again.");
                return;
            }

            const requestedReturnTo = new URLSearchParams(window.location.search).get("returnTo");
            const safeReturnTo = requestedReturnTo
                && /^\/course-invite\/[0-9a-f]{64}$/i.test(requestedReturnTo)
                ? requestedReturnTo
                : "/create-course";

            router.replace(safeReturnTo);
            router.refresh();
        } catch {
            setErrorMsg("Unable to log in right now. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: "center", height: "100vh" }}>
            <h1>Logg inn</h1>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required style={{ padding: 12, width: 260 }} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required style={{ padding: 12, width: 260 }} />
            {errorMsg && <div role="alert" style={{ color: "#DC2626", maxWidth: 320, textAlign: "center" }}>{errorMsg}</div>}
            <button type="submit" disabled={loading} style={{ padding: 12, width: 260, background: "#2D6CDF", color: "white", borderRadius: 8 }}>
                {loading ? "Logger inn…" : "Logg inn"}
            </button>
        </form>
    );
}
