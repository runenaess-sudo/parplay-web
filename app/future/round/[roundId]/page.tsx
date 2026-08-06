"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type LiveRound = {
    id: string;
    round_id?: string | null;
    players: Array<{ id: string; name?: string | null; username?: string | null } | string>;
    scores: Record<string, Record<string, { score?: number } | number>>;
    course_id: string;
    layout_id: string;
    started_at: string;
    finished_at: string | null;
    status: string | null;
    mode?: string | null;
    share_token?: string | null;
    weather?: unknown;
};

type RoundWeather = {
    temp: number | null;
    wind: number | null;
    code: number | null;
};

type ScorePlayer = {
    id: string;
    username: string | null;
    name: string | null;
    avatarUrl: string | null;
};

type Hole = {
    id: string;
    layoutIndex: number;
    number: number;
    par: number | null;
    distance: number | null;
};

function getScoreDisplayStyle(score: number | null, par: number | null) {
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

function normalizeWeather(raw: unknown): RoundWeather | null {
    if (!raw) return null;

    let weatherObj: any = raw;
    if (typeof raw === "string") {
        try {
            weatherObj = JSON.parse(raw);
        } catch {
            return null;
        }
    }

    const temp = Number(weatherObj?.temp);
    const wind = Number(weatherObj?.wind);
    const code = Number(weatherObj?.code);

    return {
        temp: Number.isFinite(temp) ? temp : null,
        wind: Number.isFinite(wind) ? wind : null,
        code: Number.isFinite(code) ? code : null,
    };
}

function getWeatherIcon(code: number | null) {
    if (code == null) return "⛅";
    if (code === 0) return "☀";
    if (code <= 3) return "🌤";
    if (code <= 45) return "🌫";
    if (code <= 55) return "🌦";
    if (code <= 65) return "🌧";
    if (code <= 75) return "🌨";
    if (code <= 95) return "⛈";
    return "⛅";
}

function getRoundStatusBadge(status: string | null | undefined) {
    const normalized = String(status ?? "active").trim().toLowerCase();

    if (normalized === "finished") {
        return { label: "Finished", bg: "#e2e8f0", color: "#111111" };
    }

    if (normalized === "paused") {
        return { label: "Paused", bg: "#fee2e2", color: "#7f1d1d" };
    }

    if (normalized === "not_started") {
        return { label: "Not started", bg: "#dbeafe", color: "#1e3a8a" };
    }

    if (normalized === "in_progress" || normalized === "active") {
        return { label: "Active", bg: "#dcfce7", color: "#166534" };
    }

    const label = normalized.replace(/_/g, " ");
    return {
        label: label.length ? label.charAt(0).toUpperCase() + label.slice(1) : "Active",
        bg: "#f3f4f6",
        color: "#111111",
    };
}

function getRoundModeLabel(mode: string | null | undefined) {
    const normalized = String(mode ?? "casual").trim().toLowerCase();

    if (normalized === "friend-league" || normalized === "friendleague") return "Friend League";
    if (normalized === "regular" || normalized === "regular-round") return "Regular";
    if (normalized === "casual" || normalized === "casual-round") return "Casual";
    if (normalized === "battle" || normalized === "battle-round") return "Battle";
    if (normalized === "matchplay" || normalized === "matchplay-round") return "Matchplay";

    const words = normalized.replace(/[_-]+/g, " ").split(" ").filter(Boolean);
    if (words.length === 0) return "Casual";
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function deriveHolesFromScores(scores: LiveRound["scores"] | undefined): Hole[] {
    if (!scores || typeof scores !== "object") return [];

    const indexSet = new Set<number>();

    Object.values(scores).forEach((playerScoreMap) => {
        if (!playerScoreMap || typeof playerScoreMap !== "object") return;

        Object.keys(playerScoreMap).forEach((key) => {
            const idx = Number(key);
            if (Number.isFinite(idx) && idx > 0) {
                indexSet.add(idx);
            }
        });
    });

    return Array.from(indexSet)
        .sort((a, b) => a - b)
        .map((layoutIndex) => ({
            id: `score-fallback-${layoutIndex}`,
            layoutIndex,
            number: layoutIndex,
            par: null,
            distance: null,
        }));
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
    const [courseImageUrl, setCourseImageUrl] = useState<string | null>(null);
    const [nowMs, setNowMs] = useState(Date.now());
    const [highlightCellKey, setHighlightCellKey] = useState<string | null>(null);
    const [highlightVisible, setHighlightVisible] = useState(true);
    const [syncStatus, setSyncStatus] = useState<"connecting" | "live" | "polling">("connecting");
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const [ratingByPlayerId, setRatingByPlayerId] = useState<Record<string, number | null>>({});

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
                        avatarUrl: null as string | null,
                    };
                })
                .filter((entry) => typeof entry.id === "string" && entry.id.length > 0) as Array<{
                    id: string;
                    name: string | null;
                    username: string | null;
                    avatarUrl: string | null;
                }>;

            const ids = normalized.map((p) => p.id);
            if (ids.length === 0) {
                if (!cancelled) setPlayers([]);
                return;
            }

            const { data: profileRows } = await supabaseBrowser
                .from("profiles")
                .select("id, username, avatar_url")
                .in("id", ids);

            if (cancelled) return;

            const usernameById = new Map((profileRows ?? []).map((row: any) => [String(row.id), row.username ?? null]));
            const avatarById = new Map((profileRows ?? []).map((row: any) => [String(row.id), row.avatar_url ?? null]));
            setPlayers(
                normalized.map((p) => ({
                    id: p.id,
                    username: usernameById.get(p.id) ?? p.username ?? null,
                    name: p.name,
                    avatarUrl: avatarById.get(p.id) ?? null,
                }))
            );
        };

        const load = async () => {
            setLoading(true);
            setErrorText(null);

            const { data: liveRound, error: roundError } = await supabaseBrowser
                .from("rounds_live")
                .select("id, round_id, players, scores, course_id, layout_id, started_at, finished_at, status, mode, share_token, weather")
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

            const [layoutRes, courseRes, courseImageRes, layoutHolesRes] = await Promise.all([
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
                    .from("course_images")
                    .select("image_url, sort_order")
                    .eq("course_id", nextRound.course_id)
                    .order("sort_order", { ascending: true })
                    .limit(1),
                supabaseBrowser
                    .from("layout_holes")
                    .select("hole_id, order_index")
                    .eq("layout_id", nextRound.layout_id)
                    .order("order_index", { ascending: true }),
            ]);

            if (cancelled) return;

            setLayoutName(layoutRes.data?.name ?? "");
            setCourseName(courseRes.data?.name ?? "");
            setCourseImageUrl(courseImageRes.data?.[0]?.image_url ?? null);

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
        if (!round?.started_at || !round?.course_id || !round?.layout_id || players.length === 0) return;

        let cancelled = false;

        const loadRatings = async () => {
            const playerIds = players.map((p) => p.id).filter(Boolean);
            if (playerIds.length === 0) return;

            const { data } = await supabaseBrowser
                .from("rounds")
                .select("player_id, round_rating, started_at, is_incomplete")
                .eq("course_id", round.course_id)
                .eq("layout_id", round.layout_id)
                .eq("started_at", round.started_at)
                .eq("is_incomplete", false)
                .in("player_id", playerIds);

            if (cancelled) return;

            const nextMap: Record<string, number | null> = {};
            (data ?? []).forEach((row: any) => {
                const playerId = String(row.player_id ?? "").trim();
                if (!playerId) return;
                const rating = Number(row.round_rating);
                nextMap[playerId] = Number.isFinite(rating) ? rating : null;
            });

            setRatingByPlayerId((prev) => ({ ...prev, ...nextMap }));
        };

        void loadRatings();

        const timer = setInterval(loadRatings, 4000);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [round?.started_at, round?.course_id, round?.layout_id, players]);

    useEffect(() => {
        if (!roundId || !shareToken) return;

        const poller = setInterval(async () => {
            const { data } = await supabaseBrowser
                .from("rounds_live")
                .select("id, round_id, players, scores, course_id, layout_id, started_at, finished_at, status, mode, share_token, weather")
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
    const weather = useMemo(() => normalizeWeather(round?.weather), [round?.weather]);
    const roundStatus = useMemo(() => getRoundStatusBadge(round?.status), [round?.status]);
    const modeLabel = useMemo(() => getRoundModeLabel(round?.mode), [round?.mode]);

    const syncLabel = syncStatus === "live" ? "Live" : syncStatus === "connecting" ? "Connecting..." : "Auto-refresh";
    const syncColor = "#111111";
    const syncBg = syncStatus === "live" ? "#dcfce7" : syncStatus === "connecting" ? "#fef3c7" : "#dbeafe";
    const isPortrait = viewport.height > viewport.width;
    const freezeLeaderCols = isPortrait || viewport.width <= 980;
    const posColWidth = freezeLeaderCols ? 36 : 30;
    const playerColWidth = freezeLeaderCols ? 184 : 130;
    const holeColWidth = freezeLeaderCols ? 52 : 30;
    const adminColWidth = freezeLeaderCols ? 58 : 40;
    const avatarSize = freezeLeaderCols ? 22 : 18;
    const derivedHoles = useMemo(() => deriveHolesFromScores(round?.scores), [round?.scores]);
    const visibleHoles = holes.length > 0 ? holes : derivedHoles;
    const usingFallbackHoleMeta = holes.length === 0 && visibleHoles.length > 0;

    const leaderboard = useMemo(() => {
        if (!round) return [] as Array<{
            id: string;
            name: string;
            avatarUrl: string | null;
            rd: number;
            thru: number;
            total: number;
            roundRating: number | null;
            scores: Record<string, { score?: number } | number>;
        }>;

        const rows = players.map((player) => {
            const playerScores = round.scores?.[player.id] ?? {};

            let total = 0;
            let parPlayed = 0;
            let thru = 0;

            visibleHoles.forEach((hole) => {
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
                avatarUrl: player.avatarUrl,
                rd,
                thru,
                total,
                roundRating: ratingByPlayerId[player.id] ?? null,
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
    }, [round, players, visibleHoles, ratingByPlayerId]);

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
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                    <div
                        style={{
                            width: 132,
                            height: 84,
                            borderRadius: 10,
                            overflow: "hidden",
                            background: "linear-gradient(135deg, #e2e8f0, #cbd5e1)",
                            border: "1px solid #d1d5db",
                            flexShrink: 0,
                        }}
                    >
                        {courseImageUrl ? (
                            <img
                                src={courseImageUrl}
                                alt={courseName || "Course image"}
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                        ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 12, fontWeight: 700 }}>
                                Course
                            </div>
                        )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.1, color: "#111111" }}>Live Scorecard</h1>
                            <span
                                style={{
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    background: roundStatus.bg,
                                    color: roundStatus.color,
                                    fontWeight: 700,
                                    fontSize: 12,
                                    border: `1px solid ${roundStatus.color}33`,
                                    lineHeight: 1,
                                }}
                            >
                                {roundStatus.label}
                            </span>
                        </div>
                        <p style={{ margin: "6px 0 0", color: "#111111", fontSize: 15, lineHeight: 1.2 }}>
                            {courseName || "Course"}{layoutName ? ` (${layoutName})` : ""} | Mode: {modeLabel}
                        </p>
                        {round?.started_at ? (
                            <p style={{ margin: "6px 0 0", color: "#111111", fontSize: 13, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                Started: {new Date(round.started_at).toLocaleString()} | Duration: {duration} | Weather: {getWeatherIcon(weather?.code ?? null)} {weather?.temp == null ? "-" : `${Math.round(weather.temp)}°C`} | 💨 {weather?.wind == null ? "-" : `${Math.round(weather.wind)} m/s`} | Sync: {syncLabel}
                            </p>
                        ) : null}
                    </div>
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
                    {usingFallbackHoleMeta ? (
                        <div style={{ padding: "8px 12px", borderBottom: "1px solid #e5e7eb", background: "#fffbeb", color: "#7c2d12", fontSize: 12, fontWeight: 600 }}>
                            Live scores are updating, but hole metadata is unavailable for this public view.
                        </div>
                    ) : null}
                    <table style={{ borderCollapse: "separate", borderSpacing: 0, width: freezeLeaderCols ? "max-content" : "100%", minWidth: "100%", tableLayout: freezeLeaderCols ? "auto" : "fixed" }}>
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
                                        boxShadow: "none",
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
                                        boxShadow: "none",
                                    }}
                                >
                                    Player
                                </th>
                                <th style={thPinnedSmall}>Rd</th>
                                <th style={thPinnedSmall}>Thru</th>
                                {visibleHoles.map((hole) => (
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
                                                boxShadow: "none",
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
                                                boxShadow: "none",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                {row.avatarUrl ? (
                                                    <img
                                                        src={row.avatarUrl}
                                                        alt={row.name}
                                                        width={avatarSize}
                                                        height={avatarSize}
                                                        style={{
                                                            width: avatarSize,
                                                            height: avatarSize,
                                                            borderRadius: 999,
                                                            objectFit: "cover",
                                                            border: "1px solid #cbd5e1",
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                ) : (
                                                    <span style={{ ...avatarBubble, width: avatarSize, height: avatarSize }}>{getInitials(row.name)}</span>
                                                )}
                                                <span style={{ color: "#111111", fontWeight: 600, whiteSpace: "nowrap" }}>{row.name}</span>
                                            </div>
                                        </td>
                                        <td style={tdPinnedSmall}>{row.thru === 0 ? "-" : row.rd === 0 ? "E" : row.rd > 0 ? `+${row.rd}` : row.rd}</td>
                                        <td style={tdPinnedSmall}>{row.thru}</td>
                                        {visibleHoles.map((hole) => {
                                            const raw = row.scores[hole.layoutIndex] ?? row.scores[String(hole.layoutIndex)];
                                            const score = extractScore(raw);
                                            const cellKey = `${row.id}:${hole.layoutIndex}`;
                                            const isLatest = highlightCellKey === cellKey && highlightVisible;
                                            const displayStyle = getScoreDisplayStyle(score, hole.par);

                                            return (
                                                <td key={`${row.id}-${hole.layoutIndex}`} style={{ ...(isLatest ? tdLatestCompact : tdCellCompact), minWidth: holeColWidth, width: holeColWidth }}>
                                                    {displayStyle.bubbleStyle ? (
                                                        <span style={{ ...scoreCircleBase, ...displayStyle.bubbleStyle }}>{score ?? "-"}</span>
                                                    ) : (
                                                        <span style={{ color: displayStyle.textColor, fontWeight: 700 }}>{score ?? "-"}</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td style={{ ...tdTail, minWidth: adminColWidth, width: adminColWidth }}>{row.thru === 0 ? "-" : row.total}</td>
                                        <td style={{ ...tdTail, minWidth: adminColWidth, width: adminColWidth }}>
                                            {row.roundRating == null ? "-" : Math.round(row.roundRating)}
                                        </td>
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
    borderRight: "none",
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

const scoreCircleBase: React.CSSProperties = {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 5px",
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
};

