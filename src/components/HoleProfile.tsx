"use client";

export function HoleProfile({
    points,
}: {
    points: { lat: number; lng: number; elevation: number }[];
}) {
    if (!points || points.length < 2) return null;

    const elevations = points.map((p) => p.elevation ?? 0);
    const min = Math.min(...elevations);
    const max = Math.max(...elevations);

    const normalize = (e: number) =>
        ((e - min) / (max - min || 1)) * 80; // height scaling

    const width = 240;
    const height = 80;
    const step = width / (points.length - 1);

    const path = points
        .map((p, i) => {
            const x = i * step;
            const y = height - normalize(p.elevation ?? 0);
            return `${i === 0 ? "M" : "L"} ${x},${y}`;
        })
        .join(" ");

    return (
        <svg width={width} height={height} className="mt-2">
            <path
                d={path}
                stroke="#00ff88"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
            />
        </svg>
    );
}
