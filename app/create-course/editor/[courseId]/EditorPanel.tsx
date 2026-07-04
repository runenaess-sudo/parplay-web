"use client";

import { Toast } from "@/components/Toast";
import { useCourseEditor } from "@/state/useCourseEditor";
import { useMemo } from "react";

export default function EditorPanel() {
    const course = useCourseEditor((s) => s.course);
    const selectedHoleId = useCourseEditor((s) => s.selectedHoleId);
    const mode = useCourseEditor((s) => s.mode);

    const setMode = useCourseEditor((s) => s.setMode);
    const saveHole = useCourseEditor((s) => s.saveHole);
    const createNewHole = useCourseEditor((s) => s.createNewHole);

    const toast = useCourseEditor((s) => s.toast);
    const clearToast = useCourseEditor((s) => s.clearToast);

    if (!course) return null;

    const hole = course.holes.find((h: any) => h.id === selectedHoleId);

    const elevationStats = useMemo(() => {
        if (!hole) return null;

        const tee = hole.tee_elevation ?? null;
        const basket = hole.basket_elevation ?? null;

        if (tee == null || basket == null) {
            return { gain: null, loss: null, net: null };
        }

        const net = basket - tee;
        return {
            gain: net > 0 ? net : 0,
            loss: net < 0 ? Math.abs(net) : 0,
            net,
        };
    }, [hole]);

    return (
        <>
            {toast && <Toast message={toast} onClose={clearToast} />}

            {/* Flytende panel-innhold */}
            <div className="relative w-full h-full text-white p-4 space-y-6">

                {/* Course info */}
                <div>
                    <h2 className="text-xl font-bold">{course.name}</h2>
                    <p className="text-sm text-neutral-300">{course.id}</p>
                </div>

                {/* Mode buttons */}
                <div className="space-y-2 pt-4 border-t border-white/10">
                    {["tee", "basket", "points", "none"].map((m) => (
                        <button
                            key={m}
                            onClick={() => setMode(m as any)}
                            className={`w-full px-3 py-2 rounded ${mode === m
                                ? "bg-blue-600"
                                : "bg-neutral-800/70 hover:bg-neutral-700/70"
                                }`}
                        >
                            {m === "none"
                                ? "No mode"
                                : `Set ${m.charAt(0).toUpperCase() + m.slice(1)}`}
                        </button>
                    ))}
                </div>

                {/* Hole info + Save */}
                {hole && (
                    <div className="pt-4 border-t border-white/10 space-y-3">
                        <h3 className="text-lg font-semibold">Hole Info</h3>

                        <div className="text-sm text-neutral-300 space-y-1">
                            <p>
                                <span className="text-neutral-400">Length:</span>{" "}
                                {hole.distance ? `${hole.distance} m` : "–"}
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
                            onClick={() => createNewHole(course.id)}
                            className="w-full px-3 py-2 rounded bg-green-700 hover:bg-green-600 font-semibold"
                        >
                            Add New Hole
                        </button>

                        <button
                            onClick={() => saveHole(hole.id)}
                            className="w-full px-3 py-2 rounded bg-blue-700 hover:bg-blue-600 font-semibold"
                        >
                            Save Hole
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
