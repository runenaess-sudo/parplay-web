"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const handleLogin = async () => {
        if (!email || !password) {
            setErrorMsg("Please enter both email and password.");
            return;
        }

        setLoading(true);

        const result = await loginAction(email, password);

        setLoading(false);

        if (result.error) {
            setErrorMsg(result.error);
            return;
        }

        router.replace("/");
    };

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
                placeholder="Email"
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
                placeholder="Password"
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
                disabled={loading}
                style={{
                    padding: "12px 16px",
                    width: 260,
                    borderRadius: 8,
                    background: "#2D6CDF",
                    color: "white",
                    fontSize: 16,
                    cursor: "pointer",
                    opacity: loading ? 0.6 : 1,
                }}
            >
                {loading ? "Logging in..." : "Log in"}
            </button>
        </div>
    );
}
