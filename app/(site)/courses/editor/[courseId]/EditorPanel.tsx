// app/courses/editor/[courseId]/EditorPanel.tsx
"use client";

import { useCourseEditor } from "@/src/state/useCourseEditor";

type Props = {
    courseId: string;
};

export function EditorPanel({ courseId }: Props) {
    const course = useCourseEditor((s) => s.course);
    const holes = useCourseEditor((s) => s.holes);
    const selectedHoleId = useCourseEditor((s) => s.selectedHoleId);
    const selectHole = useCourseEditor((s) => s.selectHole);

    const mapMode = useCourseEditor((s) => s.mapMode);
    const setMapMode = useCourseEditor((s) => s.setMapMode);

    const selectedFairwayIndex = useCourseEditor((s) => s.selectedFairwayIndex);

    const selectedHole = holes.find((h) => h.id === selectedHoleId) || null;

    return (
        <div className="w-80 border-l border-slate-800 bg-slate-900 text-slate-200 flex flex-col">
            {/* HEADER */}
            <div className="p-4 border-b border-slate-800">
                <div className="text-lg font-semibold">{course?.name || "Course"}</div>
                <div className="text-xs text-slate-400">ID: {courseId}</div>
            </div>

            {/* HOLE LIST */}
            <div className="p-3 border-b border-slate-800">
                <div className="text-xs uppercase text-slate-500 mb-2">Holes</div>

                <div className="flex flex-wrap gap-2">
                    {holes.map((h) => (
                        <button
                            key={h.id}
                            onClick={() => selectHole(h.id)}
                            className={`px-2 py-1 rounded text-xs ${selectedHoleId === h.id
                                ? "bg-slate-100 text-slate-900"
                                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                }`}
                        >
                            {h.number}
                        </button>
                    ))}
                </div>
            </div>

            {/* HOLE EDITOR */}
            {selectedHole && (
                <div className="p-4 flex-1 overflow-y-auto">
                    <div className="text-sm font-semibold mb-3">
                        Hole {selectedHole.number}
                    </div>

                    {/* HOLE NAME */}
                    <div className="mb-4">
                        <div className="text-xs text-slate-400 mb-1">Hole Name</div>
                        <input
                            type="text"
                            value={selectedHole.name ?? ""}
                            onChange={(e) => (selectedHole.name = e.target.value)}
                            className="w-full bg-slate-800 p-2 rounded text-sm"
                        />
                    </div>

                    {/* PAR */}
                    <div className="mb-4">
                        <div className="text-xs text-slate-400 mb-1">Par</div>
                        <input
                            type="number"
                            value={selectedHole.par}
                            onChange={(e) => (selectedHole.par = Number(e.target.value))}
                            className="w-full bg-slate-800 p-2 rounded text-sm"
                        />
                    </div>

                    {/* DISTANCE */}
                    <div className="mb-4">
                        <div className="text-xs text-slate-400 mb-1">Distance (m)</div>
                        <input
                            type="number"
                            value={selectedHole.distance ?? ""}
                            onChange={(e) =>
                                (selectedHole.distance = Number(e.target.value))
                            }
                            className="w-full bg-slate-800 p-2 rounded text-sm"
                        />
                    </div>

                    {/* TEE ROTATION */}
                    <div className="mb-6">
                        <div className="text-xs text-slate-400 mb-1">Tee Rotation</div>
                        <input
                            type="range"
                            min={0}
                            max={360}
                            value={selectedHole.tee_rotation ?? 0}
                            onChange={(e) =>
                                (selectedHole.tee_rotation = Number(e.target.value))
                            }
                            className="w-full"
                        />
                        <div className="text-xs text-slate-400 mt-1">
                            {selectedHole.tee_rotation ?? 0}°
                        </div>
                    </div>

                    {/* MAP ACTIONS */}
                    <div className="text-xs uppercase text-slate-500 mb-2">
                        Map Actions
                    </div>

                    <div className="space-y-2">
                        {/* Tee */}
                        <button
                            onClick={() => setMapMode("set-tee")}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded 
                                ${mapMode === "set-tee"
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-800 hover:bg-slate-700"
                                }
                            `}
                        >
                            <span>📍</span>
                            <span className="text-sm">Set Tee</span>
                        </button>

                        {/* Basket */}
                        <button
                            onClick={() => setMapMode("set-basket")}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded 
                                ${mapMode === "set-basket"
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-800 hover:bg-slate-700"
                                }
                            `}
                        >
                            <span>🎯</span>
                            <span className="text-sm">Set Basket</span>
                        </button>

                        {/* Add Fairway */}
                        <button
                            onClick={() => setMapMode("add-fairway")}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded 
                                ${mapMode === "add-fairway"
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-800 hover:bg-slate-700"
                                }
                            `}
                        >
                            <span>➕</span>
                            <span className="text-sm">Add Fairway Point</span>
                        </button>

                        {/* Edit Fairway */}
                        <button
                            onClick={() => setMapMode("edit-fairway")}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded 
                                ${mapMode === "edit-fairway"
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-800 hover:bg-slate-700"
                                }
                            `}
                        >
                            <span>✏️</span>
                            <span className="text-sm">Edit Fairway</span>
                        </button>
                    </div>

                    {/* SELECTED FAIRWAY POINT */}
                    {selectedFairwayIndex !== null && (
                        <div className="mt-6 p-3 bg-slate-800 rounded">
                            <div className="text-xs text-slate-400 mb-1">
                                Selected Fairway Point
                            </div>
                            <div className="text-sm">
                                Point #{selectedFairwayIndex + 1}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
