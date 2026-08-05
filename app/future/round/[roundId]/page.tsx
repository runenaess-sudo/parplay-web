"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type LiveRound = {
    id: string;
    players: Array<{ id: string; name?: string | null; username?: string | null } | string>;
    scores: Record<string, Record<string, { score?: number } | number>>;
    course_id: string;
    layout_id: string;
    started_at: string;
    finished_at: string | null;
    status: string | null;
    share_token?: string | null;
};

type ScorePlayer = {
    id: string;
    username: string | null;
    name: string | null;
};

type Hole = {
    id: string;
    layoutIndex: number;
    number: number;
    par: number | null;
    distance: number | null;
};

function getStrokeColor(score: number, par: number | null) {
    if (par == null) return "#111111";
    if (score === par) return "#111111";
    if (score < par) return "#0e7490";
    return "#b91c1c";
}

function extractScore(raw: unknown): number | null {
    if (typeof raw === "number") {
        return Number.isFinite(raw) ? raw : null;
    }
    if (raw && typeof raw === "object" && "score" in raw) {
        const score = Number((raw as { score?: unknown }).score);
        return Number.isFinite(score) ? score : null;
    }
    return null;
}

function formatDuration(startedAt: string, finishedAt: string | null, nowMs: number) {
    const start = new Date(startedAt).getTime();
    const end = finishedAt ? new Date(finishedAt).getTime() : nowMs;

    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        return "-";
    }

    const diff = end - start;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function detectLastChangedCell(
    prevScores: LiveRound["scores"] | undefined,
    nextScores: LiveRound["scores"] | undefined
) {
    if (!nextScores) return null;

    const playerIds = new Set<string>([
        ...Object.keys(prevScores ?? {}),
        ...Object.keys(nextScores ?? {}),
    ]);

    let changedCell: string | null = null;

    playerIds.forEach((playerId) => {
        const prevPlayer = (prevScores ?? {})[playerId] ?? {};
        const nextPlayer = (nextScores ?? {})[playerId] ?? {};

        const holeKeys = new Set<string>([
            ...Object.keys(prevPlayer),
            ...Object.keys(nextPlayer),
        ]);

        holeKeys.forEach((holeKey) => {
            const prevValue = extractScore(prevPlayer[holeKey]);
            const nextValue = extractScore(nextPlayer[holeKey]);
            if (prevValue !== nextValue && nextValue != null) {
                changedCell = `${playerId}:${holeKey}`;
            }
        });
    });

    return changedCell;
}

export default function SharedLiveRoundPage() {
    const params = useParams<{ roundId: string }>();
    const searchParams = useSearchParams();
    const roundId = params?.roundId;
    const shareToken = searchParams.get("t")?.trim() ?? "";

    const [round, setRound] = useState<LiveRound | null>(null);
    const [players, setPlayers] = useState<ScorePlayer[]>([]);
    const [holes, setHoles] = useState<Hole[]>([]);
    const [courseName, setCourseName] = useState("");
    const [layoutName, setLayoutName] = useState("");
    const [loading, setLoading] = useState(true);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [nowMs, setNowMs] = useState(Date.now());
    const [highlightCellKey, setHighlightCellKey] = useState<string | null>(null);
    const [highlightVisible, setHighlightVisible] = useState(true);
    const [syncStatus, setSyncStatus] = useState<"connecting" | "live" | "polling">("connecting");

    const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearBlinkTimers = () => {
        if (blinkIntervalRef.current) {
            clearInterval(blinkIntervalRef.current);
            blinkIntervalRef.current = null;
        }
        if (blinkTimeoutRef.current) {
            clearTimeout(blinkTimeoutRef.current);
            blinkTimeoutRef.current = null;
        }
    };

    const triggerCellHighlight = (cellKey: string) => {
        clearBlinkTimers();
        setHighlightCellKey(cellKey);
        setHighlightVisible(true);

        let flips = 0;
        blinkIntervalRef.current = setInterval(() => {
            setHighlightVisible((prev) => !prev);
            flips += 1;
            if (flips >= 8 && blinkIntervalRef.current) {
                clearInterval(blinkIntervalRef.current);
                blinkIntervalRef.current = null;
                setHighlightVisible(true);
            }
        }, 180);

        blinkTimeoutRef.current = setTimeout(() => {
            clearBlinkTimers();
            setHighlightCellKey(null);
            setHighlightVisible(true);
        }, 2400);
    };

    useEffect(() => {
        if (!roundId) return;
        if (!shareToken) {
            setLoading(false);
            setErrorText("Missing share token in link.");
            return;
        }

        let cancelled = false;

        const hydratePlayers = async (livePlayers: LiveRound["players"]) => {
            const normalized = (Array.isArray(livePlayers) ? livePlayers : [])
                .map((entry) => {
                    if (typeof entry === "string") {
                        return { id: entry, name: null as string | null, username: null as string | null };
                    }
                    return {
                        id: entry?.id,
                        name: entry?.name ?? null,
                        username: entry?.username ?? null,
                    };
                })
                .filter((entry) => typeof entry.id === "string" && entry.id.length > 0) as Array<{
                    id: string;
                    name: string | null;
                    username: string | null;
                }>;

            const ids = normalized.map((p) => p.id);
            if (ids.length === 0) {
                if (!cancelled) setPlayers([]);
                return;
            }

            const { data: profileRows } = await supabaseBrowser
                .from("profiles")
                .select("id, username")
                .in("id", ids);

            if (cancelled) return;

            const usernameById = new Map((profileRows ?? []).map((row: any) => [String(row.id), row.username ?? null]));
            setPlayers(
                normalized.map((p) => ({
                    id: p.id,
                    username: usernameById.get(p.id) ?? p.username ?? null,
                    name: p.name,
                }))
            );
        };

        const load = async () => {
            setLoading(true);
            setErrorText(null);

            const { data: liveRound, error: roundError } = await supabaseBrowser
                .from("rounds_live")
                .select("id, players, scores, course_id, layout_id, started_at, finished_at, status, share_token")
                .eq("id", roundId)
                .eq("share_token", shareToken)
                .eq("share_enabled", true)
                .single();

            if (cancelled) return;

            if (roundError || !liveRound) {
                setRound(null);
                setLoading(false);
                setErrorText("This shared scorecard is unavailable or expired.");
                return;
            }

            const nextRound = liveRound as LiveRound;
            setRound(nextRound);
            await hydratePlayers(nextRound.players ?? []);

            const [layoutRes, courseRes, layoutHolesRes] = await Promise.all([
                supabaseBrowser
                    .from("course_layouts")
                    .select("name")
                    .eq("id", nextRound.layout_id)
                    .maybeSingle(),
                supabaseBrowser
                    .from("courses")
                    .select("name")
                    .eq("id", nextRound.course_id)
                    .maybeSingle(),
                supabaseBrowser
                    .from("layout_holes")
                    .select("hole_id, order_index")
                    .eq("layout_id", nextRound.layout_id)
                    .order("order_index", { ascending: true }),
            ]);

            if (cancelled) return;

            setLayoutName(layoutRes.data?.name ?? "");
            setCourseName(courseRes.data?.name ?? "");

            const holeIds = (layoutHolesRes.data ?? []).map((row: any) => row.hole_id).filter(Boolean);
            if (holeIds.length > 0) {
                const { data: holesRaw } = await supabaseBrowser
                    .from("holes")
                    .select("id, number, par, distance")
                    .in("id", holeIds);

                if (cancelled) return;

                const byId = new Map((holesRaw ?? []).map((h: any) => [h.id, h]));
                const ordered = (layoutHolesRes.data ?? [])
                    .map((row: any, idx: number) => {
                        const hole = byId.get(row.hole_id);
                        if (!hole) return null;
                        return {
                            ...hole,
                            layoutIndex: idx + 1,
                        } as Hole;
                    })
                    .filter(Boolean) as Hole[];
                setHoles(ordered);
            } else {
                setHoles([]);
            }

            setLoading(false);
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [roundId, shareToken]);

    useEffect(() => {
        if (!roundId || !shareToken) return;

        const poller = setInterval(async () => {
            const { data } = await supabaseBrowser
                .from("rounds_live")
                .select("id, players, scores, course_id, layout_id, started_at, finished_at, status, share_token")
                .eq("id", roundId)
                .eq("share_token", shareToken)
                .eq("share_enabled", true)
                .maybeSingle();

            if (!data) return;

            const next = data as LiveRound;
            setRound((prev) => {
                const changed = detectLastChangedCell(prev?.scores, next.scores);
                if (changed) triggerCellHighlight(changed);
                return {
                    ...(prev ?? next),
                    ...next,
                };
            });
        }, 4000);

        return () => clearInterval(poller);
    }, [roundId, shareToken]);

    useEffect(() => {
        if (!roundId || !shareToken) return;

        setSyncStatus("connecting");

        const channel = supabaseBrowser
            .channel(`web-live-round-${roundId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "rounds_live",
                    filter: `id=eq.${roundId}`,
                },
                (payload) => {
                    const next = payload.new as LiveRound;
                    if (typeof next.share_token === "string" && next.share_token !== shareToken) {
                        return;
                    }

                    setRound((prev) => {
                        const changed = detectLastChangedCell(prev?.scores, next.scores);
                        if (changed) triggerCellHighlight(changed);
                        return {
                            ...(prev ?? next),
                            ...next,
                        };
                    });
                }
            )
            .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    setSyncStatus("live");
                    return;
                }
                if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    setSyncStatus("polling");
                }
            });

        return () => {
            supabaseBrowser.removeChannel(channel);
        };
    }, [roundId, shareToken]);

    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        return () => clearBlinkTimers();
    }, []);

    const duration = useMemo(() => {
        if (!round?.started_at) return "-";
        return formatDuration(round.started_at, round.finished_at, nowMs);
    }, [round?.started_at, round?.finished_at, nowMs]);

    const syncLabel = syncStatus === "live" ? "Live" : syncStatus === "connecting" ? "Connecting..." : "Auto-refresh";
    const syncColor = syncStatus === "live" ? "#166534" : syncStatus === "connecting" ? "#92400e" : "#1d4ed8";
    const syncBg = syncStatus === "live" ? "#dcfce7" : syncStatus === "connecting" ? "#fef3c7" : "#dbeafe";
    const frontNine = holes.slice(0, 9);
    const backNine = holes.slice(9);

    const renderSection = (sectionHoles: Hole[], sectionLabel: string) => {
        if (!round || sectionHoles.length === 0) return null;

        return (
            <div key={sectionLabel} style={{ marginBottom: 18 }}>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #dbe3ef", background: "#f8fbff", color: "#111111", fontWeight: 700 }}>
                    {sectionLabel}
                </div>
                <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
                    <thead>
                        <tr>
                            <th style={thPlayer}>Hole</th>
                            {sectionHoles.map((hole) => (
                                <th key={`layout-hole-${hole.layoutIndex}`} style={thCell}>{hole.layoutIndex}</th>
                            ))}
                            <th style={thCell}>Tot</th>
                            <th style={thCell}>+/-</th>
                        </tr>
                        <tr>
                            <th style={thPlayerMuted}>C-hole</th>
                            {sectionHoles.map((hole) => (
                                <th key={`course-hole-${hole.layoutIndex}`} style={thCellMuted}>{hole.number}</th>
                            ))}
                            <th style={thCellMuted}>-</th>
                            <th style={thCellMuted}>-</th>
                        </tr>
                        <tr>
                            <th style={thPlayerMuted}>Length</th>
                            {sectionHoles.map((hole) => (
                                <th key={`length-${hole.layoutIndex}`} style={thCellMuted}>{hole.distance ?? "-"}</th>
                            ))}
                            <th style={thCellMuted}>-</th>
                            <th style={thCellMuted}>-</th>
                        </tr>
                        <tr>
                            <th style={thPlayerMuted}>Par</th>
                            {sectionHoles.map((hole) => (
                                <th key={`par-${hole.layoutIndex}`} style={thCellMuted}>{hole.par ?? "-"}</th>
                            ))}
                            <th style={thCellMuted}>
                                {sectionHoles.reduce((sum, h) => sum + (h.par ?? 0), 0)}
                            </th>
                            <th style={thCellMuted}>-</th>
                        </tr>
                    </thead>
                    <tbody>
                        {players.map((player) => {
                            const playerScores = round.scores?.[player.id] ?? {};

                            let sectionStrokes = 0;
                            let sectionParPlayed = 0;
                            let playedCount = 0;

                            sectionHoles.forEach((hole) => {
                                const raw = playerScores[hole.layoutIndex] ?? playerScores[String(hole.layoutIndex)];
                                const score = extractScore(raw);
                                if (score != null) {
                                    sectionStrokes += score;
                                    sectionParPlayed += hole.par ?? 0;
                                    playedCount += 1;
                                }
                            });

                            const relative = sectionStrokes - sectionParPlayed;

                            return (
                                <tr key={`${sectionLabel}-${player.id}`}>
                                    <td style={tdPlayer}>{player.username ?? player.name ?? "Player"}</td>
                                    {sectionHoles.map((hole) => {
                                        const raw = playerScores[hole.layoutIndex] ?? playerScores[String(hole.layoutIndex)];
                                        const score = extractScore(raw);
                                        const cellKey = `${player.id}:${hole.layoutIndex}`;
                                        const isLatest = highlightCellKey === cellKey && highlightVisible;
                                        const textColor = score == null ? "#6b7280" : getStrokeColor(score, hole.par);

                                        return (
                                            <td key={`${player.id}-${sectionLabel}-${hole.layoutIndex}`} style={isLatest ? tdLatest : tdCell}>
                                                <span style={{ color: textColor, fontWeight: score == null ? 500 : 700 }}>
                                                    {score ?? "-"}
                                                </span>
                                            </td>
                                        );
                                    })}
                                    <td style={tdTotal}>{playedCount === 0 ? "-" : sectionStrokes}</td>
                                    <td style={tdRelative}>
                                        {playedCount === 0 ? "-" : relative === 0 ? "E" : relative > 0 ? `+${relative}` : relative}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <main
            style={{
                maxWidth: 1180,
                margin: "0 auto",
                padding: "24px 16px 40px",
                background: "radial-gradient(1200px 500px at 10% -15%, #eff6ff 0%, #ffffff 45%)",
            }}
        >
            <section style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>Live Scorecard</h1>
                    <p style={{ margin: "8px 0 0", color: "#111111" }}>
                        {courseName || "Course"} {layoutName ? `- ${layoutName}` : ""}
                    </p>
                    {round?.started_at ? (
                        <p style={{ margin: "6px 0 0", color: "#111111", fontSize: 14 }}>
                            Started: {new Date(round.started_at).toLocaleString()} | Duration: {duration}
                        </p>
                    ) : null}
                </div>
                <div
                    style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        background: syncBg,
                        color: syncColor,
                        fontWeight: 700,
                        fontSize: 13,
                        border: `1px solid ${syncColor}33`,
                    }}
                >
                    {syncLabel}
                </div>
            </section>

            {loading ? <p>Loading scorecard...</p> : null}
            {!loading && errorText ? <p style={{ color: "#b91c1c" }}>{errorText}</p> : null}

            {!loading && !errorText && round ? (
                <div
                    style={{
                        overflowX: "auto",
                        border: "1px solid #dbe3ef",
                        borderRadius: 14,
                        background: "#ffffff",
                        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
                    }}
                >
                    {renderSection(frontNine, "Front")}
                    {renderSection(backNine, "Back")}
                </div>
            ) : null}
        </main>
    );
}

const baseCell: React.CSSProperties = {
    borderBottom: "1px solid #e5e7eb",
    borderRight: "1px solid #e5e7eb",
    textAlign: "center",
    padding: "10px 8px",
    minWidth: 48,
    fontSize: 14,
};

const thPlayer: React.CSSProperties = {
    ...baseCell,
    textAlign: "left",
    minWidth: 170,
    position: "sticky",
    left: 0,
    zIndex: 2,
    background: "#f8fafc",
    fontWeight: 700,
    color: "#111111",
};

const thCell: React.CSSProperties = {
    ...baseCell,
    background: "#f8fafc",
    fontWeight: 700,
    color: "#111111",
};

const thPlayerMuted: React.CSSProperties = {
    ...thPlayer,
    color: "#111111",
    fontWeight: 600,
};

const thCellMuted: React.CSSProperties = {
    ...thCell,
    color: "#111111",
    fontWeight: 600,
};

const tdPlayer: React.CSSProperties = {
    ...baseCell,
    textAlign: "left",
    minWidth: 170,
    position: "sticky",
    left: 0,
    zIndex: 1,
    background: "#ffffff",
    fontWeight: 600,
    color: "#111111",
};

const tdCell: React.CSSProperties = {
    ...baseCell,
    background: "#ffffff",
    color: "#111111",
};

const tdLatest: React.CSSProperties = {
    ...baseCell,
    background: "#fef08a",
    borderColor: "#eab308",
    borderWidth: 2,
    borderStyle: "solid",
    fontWeight: 700,
    color: "#111111",
};

const tdTotal: React.CSSProperties = {
    ...baseCell,
    minWidth: 60,
    fontWeight: 700,
    color: "#111111",
    background: "#f8fafc",
};

const tdRelative: React.CSSProperties = {
    ...baseCell,
    minWidth: 64,
    fontWeight: 700,
    color: "#111111",
    background: "#ffffff",
};
