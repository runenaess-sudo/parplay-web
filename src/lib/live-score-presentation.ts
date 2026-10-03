import type React from "react";

export function getScoreDisplayStyle(score: number | null, par: number | null) {
    if (score == null || par == null) {
        return {
            textColor: "#6b7280",
            bubbleStyle: null as React.CSSProperties | null,
        };
    }

    if (score === 1) {
        return {
            textColor: "#111111",
            bubbleStyle: {
                background: "#fde68a",
                color: "#111111",
            } as React.CSSProperties,
        };
    }

    const diff = score - par;

    if (diff <= -3) {
        return {
            textColor: "#111111",
            bubbleStyle: {
                background: "#cbd5e1",
                color: "#111111",
            } as React.CSSProperties,
        };
    }

    if (diff === -2) {
        return {
            textColor: "#111111",
            bubbleStyle: {
                background: "#facc15",
                color: "#111111",
            } as React.CSSProperties,
        };
    }

    if (diff === -1) {
        return {
            textColor: "#111111",
            bubbleStyle: {
                background: "#86efac",
                color: "#111111",
            } as React.CSSProperties,
        };
    }

    if (diff === 1) {
        return {
            textColor: "#111111",
            bubbleStyle: {
                background: "#f9a8d4",
                color: "#111111",
            } as React.CSSProperties,
        };
    }

    if (diff >= 2) {
        return {
            textColor: "#ffffff",
            bubbleStyle: {
                background: "#991b1b",
                color: "#ffffff",
            } as React.CSSProperties,
        };
    }

    return {
        textColor: "#111111",
        bubbleStyle: null as React.CSSProperties | null,
    };
}

export function getInitials(name: string) {
    const clean = name.trim();
    if (!clean) return "P";
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

