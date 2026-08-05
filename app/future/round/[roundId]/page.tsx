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

function getInitials(name: string) {
    const clean = name.trim();
    if (!clean) return "P";
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
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
    const [viewport, setViewport] = useState({ width: 0, height: 0 });

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
        if (typeof window === "undefined") return;

        const applyViewport = () => {
            setViewport({ width: window.innerWidth, height: window.innerHeight });
        };

        applyViewport();
        window.addEventListener("resize", applyViewport);
        return () => window.removeEventListener("resize", applyViewport);
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
    const isPortrait = viewport.height > viewport.width;
    const freezeLeaderCols = isPortrait || viewport.width < 900;
    const posColWidth = freezeLeaderCols ? 36 : 30;
    const playerColWidth = freezeLeaderCols ? 184 : 130;
    const holeColWidth = freezeLeaderCols ? 52 : 30;
    const adminColWidth = freezeLeaderCols ? 58 : 40;
    const avatarSize = freezeLeaderCols ? 22 : 18;

    const leaderboard = useMemo(() => {
        if (!round) return [] as Array<{
            id: string;
            name: string;
            rd: number;
            thru: number;
            total: number;
            rating: string;
            scores: Record<string, { score?: number } | number>;
        }>;

        const rows = players.map((player) => {
            const playerScores = round.scores?.[player.id] ?? {};

            let total = 0;
            let parPlayed = 0;
            let thru = 0;

            holes.forEach((hole) => {
                const raw = playerScores[hole.layoutIndex] ?? playerScores[String(hole.layoutIndex)];
                const score = extractScore(raw);
                if (score != null) {
                    total += score;
                    parPlayed += hole.par ?? 0;
                    thru += 1;
                }
            });

            const rd = total - parPlayed;
            const displayName = player.username ?? player.name ?? "Player";

            return {
                id: player.id,
                name: displayName,
                rd,
                thru,
                total,
                rating: "-",
                scores: playerScores,
            };
        });

        rows.sort((a, b) => {
            if (a.rd !== b.rd) return a.rd - b.rd;
            if (a.thru !== b.thru) return b.thru - a.thru;
            if (a.total !== b.total) return a.total - b.total;
            return a.name.localeCompare(b.name);
        });

        return rows;
    }, [round, players, holes]);

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
                        overflowX: freezeLeaderCols ? "auto" : "hidden",
                        border: "1px solid #dbe3ef",
                        borderRadius: 14,
                        background: "#ffffff",
                        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
                    }}
                >
                    <table style={{ borderCollapse: "collapse", width: freezeLeaderCols ? "max-content" : "100%", minWidth: "100%", tableLayout: freezeLeaderCols ? "auto" : "fixed" }}>
                        <thead>
                            <tr>
                                <th
                                    style={{
                                        ...thPinned,
                                        minWidth: posColWidth,
                                        width: posColWidth,
                                        position: freezeLeaderCols ? "sticky" : "static",
                                        left: freezeLeaderCols ? 0 : "auto",
                                        zIndex: freezeLeaderCols ? 4 : 1,
                                    }}
                                >
                                    Pos
                                </th>
                                <th
                                    style={{
                                        ...thPinnedName,
                                        minWidth: playerColWidth,
                                        width: playerColWidth,
                                        position: freezeLeaderCols ? "sticky" : "static",
                                        left: freezeLeaderCols ? posColWidth : "auto",
                                        zIndex: freezeLeaderCols ? 4 : 1,
                                    }}
                                >
                                    Player
                                </th>
                                <th style={thPinnedSmall}>Rd</th>
                                <th style={thPinnedSmall}>Thru</th>
                                {holes.map((hole) => (
                                    <th key={`h-${hole.layoutIndex}`} style={{ ...thHoleBox, minWidth: holeColWidth, width: holeColWidth }}>
                                        <div style={{ fontSize: freezeLeaderCols ? 12 : 10, fontWeight: 700, lineHeight: 1.05 }}>{hole.layoutIndex}</div>
                                        <div style={{ fontSize: freezeLeaderCols ? 10 : 9, fontStyle: "italic", color: "#4b5563", lineHeight: 1.05, marginTop: 2 }}>
                                            {hole.distance ?? "-"}
                                        </div>
                                        <div style={{ fontSize: freezeLeaderCols ? 11 : 9, fontWeight: 600, lineHeight: 1.05, marginTop: 2 }}>
                                            {hole.par ?? "-"}
                                        </div>
                                    </th>
                                ))}
                                <th style={{ ...thTail, minWidth: adminColWidth, width: adminColWidth }}>Tot</th>
                                <th style={{ ...thTail, minWidth: adminColWidth, width: adminColWidth }}>Rt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map((row, index) => {
                                const tieStart = leaderboard.findIndex((candidate) => candidate.rd === row.rd && candidate.thru === row.thru);
                                const posLabel = tieStart === index ? `${index + 1}` : `T${tieStart + 1}`;

                                return (
                                    <tr key={row.id}>
                                        <td
                                            style={{
                                                ...tdPinned,
                                                minWidth: posColWidth,
                                                width: posColWidth,
                                                position: freezeLeaderCols ? "sticky" : "static",
                                                left: freezeLeaderCols ? 0 : "auto",
                                                zIndex: freezeLeaderCols ? 3 : 1,
                                            }}
                                        >
                                            {posLabel}
                                        </td>
                                        <td
                                            style={{
                                                ...tdPinnedName,
                                                minWidth: playerColWidth,
                                                width: playerColWidth,
                                                position: freezeLeaderCols ? "sticky" : "static",
                                                left: freezeLeaderCols ? posColWidth : "auto",
                                                zIndex: freezeLeaderCols ? 3 : 1,
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ ...avatarBubble, width: avatarSize, height: avatarSize }}>{getInitials(row.name)}</span>
                                                <span style={{ color: "#111111", fontWeight: 600, whiteSpace: "nowrap" }}>{row.name}</span>
                                            </div>
                                        </td>
                                        <td style={tdPinnedSmall}>{row.thru === 0 ? "-" : row.rd === 0 ? "E" : row.rd > 0 ? `+${row.rd}` : row.rd}</td>
                                        <td style={tdPinnedSmall}>{row.thru}</td>
                                        {holes.map((hole) => {
                                            const raw = row.scores[hole.layoutIndex] ?? row.scores[String(hole.layoutIndex)];
                                            const score = extractScore(raw);
                                            const cellKey = `${row.id}:${hole.layoutIndex}`;
                                            const isLatest = highlightCellKey === cellKey && highlightVisible;
                                            const textColor = score == null ? "#6b7280" : getStrokeColor(score, hole.par);

                                            return (
                                                <td key={`${row.id}-${hole.layoutIndex}`} style={{ ...(isLatest ? tdLatestCompact : tdCellCompact), minWidth: holeColWidth, width: holeColWidth }}>
                                                    <span style={{ color: textColor, fontWeight: score == null ? 500 : 700 }}>
                                                        {score ?? "-"}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                        <td style={{ ...tdTail, minWidth: adminColWidth, width: adminColWidth }}>{row.thru === 0 ? "-" : row.total}</td>
                                        <td style={{ ...tdTail, minWidth: adminColWidth, width: adminColWidth }}>{row.rating}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </main>
    );
}

const baseCell: React.CSSProperties = {
    borderBottom: "1px solid #e5e7eb",
    borderRight: "1px solid #e5e7eb",
    textAlign: "center",
    padding: "6px 6px",
    minWidth: 42,
    fontSize: 12,
    lineHeight: 1.15,
};

const thPinned: React.CSSProperties = {
    ...baseCell,
    minWidth: 36,
    position: "sticky",
    left: 0,
    zIndex: 4,
    background: "#f4f6f8",
    fontWeight: 700,
    color: "#111111",
};

const thPinnedName: React.CSSProperties = {
    ...thPinned,
    textAlign: "left",
    minWidth: 184,
    left: 36,
};

const thPinnedSmall: React.CSSProperties = {
    ...thPinned,
    minWidth: 50,
    left: "auto",
    position: "static",
};

const thHoleBox: React.CSSProperties = {
    ...baseCell,
    background: "#f1f5f9",
    fontWeight: 600,
    color: "#111111",
    minWidth: 48,
    paddingTop: 5,
    paddingBottom: 5,
};

const thTail: React.CSSProperties = {
    ...thHoleBox,
    minWidth: 56,
};

const tdPinned: React.CSSProperties = {
    ...baseCell,
    minWidth: 36,
    position: "sticky",
    left: 0,
    zIndex: 3,
    background: "#ffffff",
    fontWeight: 700,
    color: "#111111",
};

const tdPinnedName: React.CSSProperties = {
    ...tdPinned,
    textAlign: "left",
    minWidth: 184,
    left: 36,
};

const tdPinnedSmall: React.CSSProperties = {
    ...baseCell,
    minWidth: 50,
    background: "#ffffff",
    fontWeight: 700,
    color: "#111111",
};

const tdCellCompact: React.CSSProperties = {
    ...baseCell,
    background: "#ffffff",
    color: "#111111",
};

const tdLatestCompact: React.CSSProperties = {
    ...baseCell,
    background: "#fef08a",
    borderColor: "#eab308",
    borderWidth: 2,
    borderStyle: "solid",
    fontWeight: 700,
    color: "#111111",
};

const tdTail: React.CSSProperties = {
    ...baseCell,
    minWidth: 56,
    fontWeight: 700,
    color: "#111111",
    background: "#f8fafc",
};

const avatarBubble: React.CSSProperties = {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#e2e8f0",
    color: "#1f2937",
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
};

