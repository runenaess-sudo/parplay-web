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
        background: "#0A0A0A",
        color: "white",
        textAlign: "center",
        padding: "24px",
        gap: "20px",
      }}
    >
      <Image
        src="/pp_logo.png"
        alt="ParPlay"
        width={320}
        height={320}
        priority
        style={{ width: "min(70vw, 320px)", height: "auto" }}
      />

      <div
        style={{
          padding: "10px 18px",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: "10px",
          fontSize: "1rem",
          letterSpacing: "0.02em",
        }}
      >
        {countdown.isDone
          ? "Lansert"
          : `${countdown.days}d ${String(countdown.hours).padStart(2, "0")}t ${String(countdown.minutes).padStart(2, "0")}m ${String(countdown.seconds).padStart(2, "0")}s til 01.01.2027`}
      </div>
    </main>
  );
}
