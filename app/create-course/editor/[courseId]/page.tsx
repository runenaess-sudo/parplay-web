"use client";

import { useCourseEditor } from "@/src/state/useCourseEditor";
import { useParams } from "next/navigation";
import EditorPanel from "./EditorPanel";
import LoadEditorData from "./LoadEditorData";
import { MapCanvas } from "./MapCanvas";

export default function Page() {
    const { courseId } = useParams() as { courseId: string };

    const course = useCourseEditor((s) => s.course);
    const selectedHoleId = useCourseEditor((s) => s.selectedHoleId);
    const mode = useCourseEditor((s) => s.mode);

    const setTee = useCourseEditor((s) => s.setTee);
    const setBasket = useCourseEditor((s) => s.setBasket);
    const addFairwayPoint = useCourseEditor((s) => s.addFairwayPoint);
    const moveFairwayPoint = useCourseEditor((s) => s.moveFairwayPoint);
    const removeFairwayPoint = useCourseEditor((s) => s.removeFairwayPoint);
    const setTeeAngle = useCourseEditor((s) => s.setTeeAngle);

    return (
        <div className="flex flex-col min-h-screen bg-slate-900">

            {/* HEADER */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-4">
                <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-200">
                        ParPlay
                    </span>
                    <span className="text-sm font-semibold text-slate-100">
                        Course Editor
                    </span>
                </div>

                <div className="text-xs text-slate-400">
                    Course ID: <span className="font-mono">{courseId}</span>
                </div>
            </div>

            {/* LOADING */}
            {!course && (
                <div className="flex flex-1 items-center justify-center text-slate-300">
                    Loading editor…
                </div>
            )}

            {/* MAIN EDITOR */}
            {course && (
                <div className="flex flex-row flex-1 min-h-0">

                    {/* LEFT SIDE: EDITOR PANEL */}
                    <div className="w-80 shrink-0 border-r border-slate-800">
                        <EditorPanel />
                    </div>

                    {/* RIGHT SIDE: MAP */}
                    <div className="relative flex-1 min-h-0">
                        <MapCanvas
                            course={course}
                            selectedHoleId={selectedHoleId}
                            mode={mode}
                            onSetTee={setTee}
                            onSetBasket={setBasket}
                            onAddFairwayPoint={addFairwayPoint}
                            onMoveFairwayPoint={moveFairwayPoint}
                            onRemoveFairwayPoint={removeFairwayPoint}
                            onSetTeeAngle={setTeeAngle}
                        />
                    </div>
                </div>
            )}

            <LoadEditorData courseId={courseId} />
        </div>
    );
}
