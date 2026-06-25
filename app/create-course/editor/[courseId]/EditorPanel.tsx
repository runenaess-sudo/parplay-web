"use client";

import { useCourseEditor } from "@/src/state/useCourseEditor";
import { useMemo } from "react";

export default function EditorPanel() {
    const course = useCourseEditor((s) => s.course);
    const selectedHoleId = useCourseEditor((s) => s.selectedHoleId);
    const mode = useCourseEditor((s) => s.mode);

    const setSelectedHole = useCourseEditor((s) => s.setSelectedHole);
    const setMode = useCourseEditor((s) => s.setMode);
    const saveHole = useCourseEditor((s) => s.saveHole);

    if (!course) return null;

    const hole = course.holes.find((h: any) => h.id === selectedHoleId);

    // ⭐ Live beregning av elevation gain/loss
    const elevationStats = useMemo(() => {
        if (!hole) return null;

        const tee = hole.tee_elevation ?? null;
        const basket = hole.basket_elevation ?? null;

        if (tee == null || basket == null) {
            return {
                gain: null,
                loss: null,
                net: null,
            };
        }

        const net = basket - tee;
        return {
            gain: net > 0 ? net : 0,
            loss: net < 0 ? Math.abs(net) : 0,
            net,
        };
    }, [hole]);

    return (
        <div className="w-64 bg-neutral-900 text-white p-4 space-y-6 border-r border-neutral-800">
            {/* COURSE HEADER */}
            <div>
                <h2 className="text-xl font-bold">{course.name}</h2>
                <p className="text-sm text-neutral-400">{course.id}</p>
            </div>

            {/* HOLE LIST */}
            <div className="space-y-2">
                {course.holes.map((h: any) => (
                    <button
                        key={h.id}
                        onClick={() => setSelectedHole(h.id)}
                        className={`w-full text-left px-3 py-2 rounded transition ${selectedHoleId === h.id
                            ? "bg-blue-600"
                            : "bg-neutral-800 hover:bg-neutral-700"
                            }`}
                    >
                        Hole {h.number}
                    </button>
                ))}
            </div>

            {/* MODE BUTTONS */}
            <div className="space-y-2 pt-4 border-t border-neutral-700">
                <button
                    onClick={() => setMode("tee")}
                    className={`w-full px-3 py-2 rounded ${mode === "tee"
                        ? "bg-green-600"
                        : "bg-neutral-800 hover:bg-neutral-700"
                        }`}
                >
                    Set Tee
                </button>

                <button
                    onClick={() => setMode("basket")}
                    className={`w-full px-3 py-2 rounded ${mode === "basket"
                        ? "bg-yellow-600"
                        : "bg-neutral-800 hover:bg-neutral-700"
                        }`}
                >
                    Set Basket
                </button>

                <button
                    onClick={() => setMode("points")}
                    className={`w-full px-3 py-2 rounded ${mode === "points"
                        ? "bg-purple-600"
                        : "bg-neutral-800 hover:bg-neutral-700"
                        }`}
                >
                    Set Points
                </button>

                <button
                    onClick={() => setMode("none")}
                    className={`w-full px-3 py-2 rounded ${mode === "none"
                        ? "bg-neutral-700"
                        : "bg-neutral-800 hover:bg-neutral-700"
                        }`}
                >
                    No mode
                </button>
            </div>

            {/* HOLE INFO */}
            {hole && (
                <div className="pt-4 border-t border-neutral-700 space-y-3">
                    <h3 className="text-lg font-semibold">Hole Info</h3>

                    <div className="text-sm text-neutral-300 space-y-1">
                        <p>
                            <span className="text-neutral-400">Length:</span>{" "}
                            {hole.length_meters ? `${hole.length_meters} m` : "–"}
                        </p>

                        <p>
                            <span className="text-neutral-400">Elevation Gain:</span>{" "}
                            {elevationStats?.gain != null
                                ? `${elevationStats.gain.toFixed(1)} m`
                                : "–"}
                        </p>

                        <p>
                            <span className="text-neutral-400">Elevation Loss:</span>{" "}
                            {elevationStats?.loss != null
                                ? `${elevationStats.loss.toFixed(1)} m`
                                : "–"}
                        </p>

                        <p>
                            <span className="text-neutral-400">Net Elevation:</span>{" "}
                            {elevationStats?.net != null
                                ? `${elevationStats.net.toFixed(1)} m`
                                : "–"}
                        </p>
                    </div>

                    <button
                        onClick={() => saveHole(hole.id)}
                        className="w-full px-3 py-2 rounded bg-blue-700 hover:bg-blue-600 font-semibold"
                    >
                        Save Hole
                    </button>
                </div>
            )}
        </div>
    );
}
