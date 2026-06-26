export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    const { error } = await searchParams;

    return (
        <form
            action="/api/login"
            method="post"
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
                name="email"
                placeholder="Email"
                required
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
                name="password"
                placeholder="Password"
                required
                style={{
                    padding: "12px 16px",
                    width: 260,
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    fontSize: 16,
                }}
            />

            {error ? (
                <div style={{ color: "red", marginTop: 8, maxWidth: 260, textAlign: "center" }}>
                    {error}
                </div>
            ) : null}

            <button
                type="submit"
                style={{
                    padding: "12px 16px",
                    width: 260,
                    borderRadius: 8,
                    background: "#2D6CDF",
                    color: "white",
                    fontSize: 16,
                    cursor: "pointer",
                }}
            >
                Log in
            </button>
        </form>
    );
}
