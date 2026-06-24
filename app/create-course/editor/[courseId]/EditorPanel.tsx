// app/create-course/editor/[courseId]/EditorPanel.tsx
"use client";

import { useCourseEditor } from "@/src/state/useCourseEditor";

export default function EditorPanel() {
    const course = useCourseEditor((s) => s.course);
    const selectedHoleId = useCourseEditor((s) => s.selectedHoleId);
    const mode = useCourseEditor((s) => s.mode);

    const setSelectedHole = useCourseEditor((s) => s.setSelectedHole);
    const setMode = useCourseEditor((s) => s.setMode);

    if (!course) return null;

    return (
        <div className="w-64 bg-neutral-900 text-white p-4 space-y-6">

            {/* BANENAVN */}
            <div>
                <h2 className="text-xl font-bold">{course.name}</h2>
                <p className="text-sm text-neutral-400">{course.id}</p>
            </div>

            {/* HULL-LISTE */}
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
                        Hull {h.number}
                    </button>
                ))}
            </div>

            {/* MODUS-KNAPPER */}
            <div className="space-y-2 pt-4 border-t border-neutral-700">
                <button
                    onClick={() => setMode("tee")}
                    className={`w-full px-3 py-2 rounded ${mode === "tee"
                        ? "bg-green-600"
                        : "bg-neutral-800 hover:bg-neutral-700"
                        }`}
                >
                    Sett Tee
                </button>

                <button
                    onClick={() => setMode("basket")}
                    className={`w-full px-3 py-2 rounded ${mode === "basket"
                        ? "bg-yellow-600"
                        : "bg-neutral-800 hover:bg-neutral-700"
                        }`}
                >
                    Sett Basket
                </button>

                <button
                    onClick={() => setMode("fairway")}
                    className={`w-full px-3 py-2 rounded ${mode === "fairway"
                        ? "bg-purple-600"
                        : "bg-neutral-800 hover:bg-neutral-700"
                        }`}
                >
                    Legg til Fairway-punkt
                </button>

                <button
                    onClick={() => setMode("none")}
                    className={`w-full px-3 py-2 rounded ${mode === "none"
                        ? "bg-neutral-700"
                        : "bg-neutral-800 hover:bg-neutral-700"
                        }`}
                >
                    Ingen modus
                </button>
            </div>
        </div>
    );
}
