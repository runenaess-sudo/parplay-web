// app/courses/editor/[courseId]/MapCanvas.tsx
"use client";

import { useEffect } from "react";
import { useCourseEditor } from "./useCourseEditor";

type Props = {
    courseId: string;
};

export function MapCanvas({ courseId }: Props) {
    const holes = useCourseEditor((s) => s.holes);
    const selectedHoleId = useCourseEditor((s) => s.selectedHoleId);
    const mapMode = useCourseEditor((s) => s.mapMode);
    const selectHole = useCourseEditor((s) => s.selectHole);

    const selectedHole = holes.find((h) => h.id === selectedHoleId) || null;

    // TEMP: Debug logging
    useEffect(() => {
        console.log("Selected hole:", selectedHole);
        console.log("Map mode:", mapMode);
    }, [selectedHole, mapMode]);

    return (
        <div className="flex flex-1 items-center justify-center bg-slate-900 text-slate-300">
            <div className="text-center">
                <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                    Map Canvas (placeholder)
                </div>

                {selectedHole ? (
                    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-left text-xs">
                        <div className="font-semibold text-slate-200">
                            Hole {selectedHole.number}
                        </div>

                        <div className="mt-1 text-slate-400">
                            Par: {selectedHole.par}
                        </div>

                        <div className="mt-1 text-slate-400">
                            Tee:{" "}
                            {selectedHole.tee
                                ? JSON.stringify(selectedHole.tee)
                                : "Not set"}
                        </div>

                        <div className="mt-1 text-slate-400">
                            Basket:{" "}
                            {selectedHole.basket
                                ? JSON.stringify(selectedHole.basket)
                                : "Not set"}
                        </div>

                        <div className="mt-1 text-slate-400">
                            Fairway points:{" "}
                            {selectedHole.fairway
                                ? selectedHole.fairway.length
                                : 0}
                        </div>

                        <div className="mt-3 text-slate-500">
                            Map mode: <span className="font-mono">{mapMode}</span>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-400">
                        No hole selected
                    </div>
                )}

                {/* Hole list for quick testing */}
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {holes.map((h) => (
                        <button
                            key={h.id}
                            onClick={() => selectHole(h.id)}
                            className={`rounded px-2 py-1 text-xs ${selectedHoleId === h.id
                                ? "bg-slate-100 text-slate-900"
                                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                }`}
                        >
                            Hole {h.number}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
