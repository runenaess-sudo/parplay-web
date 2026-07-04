"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isDone: boolean;
};

function getCountdown(targetDate: Date): Countdown {
  const now = Date.now();
  const target = targetDate.getTime();
  const diff = target - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isDone: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, isDone: false };
}

export default function Home() {
  const targetDate = new Date("2027-01-01T00:00:00+01:00");
  const [countdown, setCountdown] = useState<Countdown>(() => getCountdown(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getCountdown(targetDate));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        transform: "translateY(-48px)",
        background: "#0A0A0A",
        color: "white",
        textAlign: "center",
        padding: "24px",
        gap: "20px",
      }}
    >
      <div
        style={{
          width: "min(90vw, 630px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "30px",
        }}
      >
        <div
          style={{
            fontSize: "clamp(40px, 9.6vw, 48px)",
            fontStyle: "italic",
            fontWeight: 700,
            letterSpacing: "0.04em",
            lineHeight: 1.1,
            color: "#FFFFFF",
            textShadow: "0 2px 8px rgba(0,0,0,0.85)",
            whiteSpace: "nowrap",
            padding: "0 6px",
          }}
        >
          {countdown.isDone
            ? "Lansert"
            : `${countdown.days}d ${String(countdown.hours).padStart(2, "0")}t ${String(countdown.minutes).padStart(2, "0")}m ${String(countdown.seconds).padStart(2, "0")}s`}
        </div>

        <Image
          src="/pp_logo.png"
          alt="ParPlay"
          width={630}
          height={630}
          priority
          style={{ width: "100%", height: "auto" }}
        />
      </div>
    </main>
  );
}
