"use client";

import { HoleProfile } from "@/src/components/HoleProfile";
import { Toast } from "@/src/components/Toast";
import { useCourseEditor } from "@/src/state/useCourseEditor";
import { useMemo } from "react";

export default function EditorPanel() {
    const course = useCourseEditor((s) => s.course);
    const selectedHoleId = useCourseEditor((s) => s.selectedHoleId);
    const mode = useCourseEditor((s) => s.mode);

    const setSelectedHole = useCourseEditor((s) => s.setSelectedHole);
    const setMode = useCourseEditor((s) => s.setMode);
    const saveHole = useCourseEditor((s) => s.saveHole);

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

    const elevationPoints =
        hole && hole.fairway_points
            ? [
                ...(hole.tee_latitude
                    ? [{ lat: hole.tee_latitude, lng: hole.tee_longitude, elevation: hole.tee_elevation }]
                    : []),
                ...hole.fairway_points,
                ...(hole.basket_latitude
                    ? [{ lat: hole.basket_latitude, lng: hole.basket_longitude, elevation: hole.basket_elevation }]
                    : []),
            ]
            : [];

    return (
        <div className="relative w-64 bg-neutral-900 text-white p-4 space-y-6 border-r border-neutral-800">
            {toast && <Toast message={toast} onClose={clearToast} />}

            <div>
                <h2 className="text-xl font-bold">{course.name}</h2>
                <p className="text-sm text-neutral-400">{course.id}</p>
            </div>

            <div className="space-y-2">
                {course.holes.map((h: any) => (
                    <button
                        key={h.id}
                        onClick={() => setSelectedHole(h.id)}
                        className={`w-full text-left px-3 py-2 rounded transition ${selectedHoleId === h.id ? "bg-blue-600" : "bg-neutral-800 hover:bg-neutral-700"
                            }`}
                    >
                        Hole {h.number}
                    </button>
                ))}
            </div>

            <div className="space-y-2 pt-4 border-t border-neutral-700">
                {["tee", "basket", "points", "none"].map((m) => (
                    <button
                        key={m}
                        onClick={() => setMode(m as any)}
                        className={`w-full px-3 py-2 rounded ${mode === m ? "bg-blue-600" : "bg-neutral-800 hover:bg-neutral-700"
                            }`}
                    >
                        {m === "none" ? "No mode" : `Set ${m.charAt(0).toUpperCase() + m.slice(1)}`}
                    </button>
                ))}
            </div>

            {hole && (
                <div className="pt-4 border-t border-neutral-700 space-y-3">
                    <h3 className="text-lg font-semibold">Hole Info</h3>

                    <p className="text-sm text-neutral-300">
                        Length: {hole.length_meters ? `${hole.length_meters} m` : "–"}
                    </p>

                    <HoleProfile points={elevationPoints} />

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
