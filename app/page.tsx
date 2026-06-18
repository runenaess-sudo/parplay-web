export default function Home() {
  return (
    <main
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#0A0A0A",
        color: "white",
        fontFamily: "system-ui",
        textAlign: "center",
        padding: "0 24px"
      }}
    >
      <h1
        style={{
          fontSize: "3rem",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          marginBottom: "0.5rem"
        }}
      >
        ParPlay
      </h1>

      <p
        style={{
          fontSize: "1.25rem",
          opacity: 0.7,
          marginBottom: "2rem"
        }}
      >
        Premium DiscGolf. Coming soon.
      </p>

      <div
        style={{
          padding: "10px 22px",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "8px",
          fontSize: "0.9rem",
          opacity: 0.8
        }}
      >
        © {new Date().getFullYear()} ParPlay
      </div>
    </main>
  );
}
