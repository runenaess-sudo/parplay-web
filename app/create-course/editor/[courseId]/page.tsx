"use client";

import { useCourseEditor } from "@/state/useCourseEditor";
import { useParams, useRouter } from "next/navigation";
import EditorPanel from "./EditorPanel";
import LoadEditorData from "./LoadEditorData";
import { MapCanvas } from "./MapCanvas";

/* -------------------------------------------------------
   TYPES
-------------------------------------------------------- */
type Hole = {
    id: string;
    number: number;
};

type HoleListOverlayProps = {
    holes: Hole[];
    selectedHoleId: string | null;
    onSelect: (id: string) => void;
};

/* -------------------------------------------------------
   HOLE LIST OVERLAY (flyter oppå kartet)
-------------------------------------------------------- */
function HoleListOverlay({
    holes,
    selectedHoleId,
    onSelect,
}: HoleListOverlayProps) {
    return (
        <div className="absolute top-0 left-0 right-0 z-30 p-2">
            <div className="flex gap-2 overflow-x-auto bg-black/60 backdrop-blur-sm rounded-xl p-2">
                {holes.map((h) => (
                    <button
                        key={h.id}
                        onClick={() => onSelect(h.id)}
                        className={`px-3 py-1 rounded text-sm whitespace-nowrap ${h.id === selectedHoleId
                            ? "bg-white text-black font-bold"
                            : "bg-slate-700 text-slate-200"
                            }`}
                    >
                        {h.number}
                    </button>
                ))}
            </div>
        </div>
    );
}

/* -------------------------------------------------------
   PAGE COMPONENT
-------------------------------------------------------- */
export default function Page() {
    const router = useRouter();
    const { courseId } = useParams() as { courseId: string };

    const course = useCourseEditor((s) => s.course);
    const selectedHoleId = useCourseEditor((s) => s.selectedHoleId);
    const mode = useCourseEditor((s) => s.mode);
    const featureTool = useCourseEditor((s) => s.featureTool);
    const drawingCoordinates = useCourseEditor((s) => s.drawingCoordinates);
    const selectedFeatureId = useCourseEditor((s) => s.selectedFeatureId);

    const setTee = useCourseEditor((s) => s.setTee);
    const setBasket = useCourseEditor((s) => s.setBasket);
    const addFairwayPoint = useCourseEditor((s) => s.addFairwayPoint);
    const moveFairwayPoint = useCourseEditor((s) => s.moveFairwayPoint);
    const removeFairwayPoint = useCourseEditor((s) => s.removeFairwayPoint);
    const setTeeAngle = useCourseEditor((s) => s.setTeeAngle);
    const setSelectedHole = useCourseEditor((s) => s.setSelectedHole);
    const addFeatureCoordinate = useCourseEditor((s) => s.addFeatureCoordinate);
    const selectFeature = useCourseEditor((s) => s.selectFeature);
    const moveFeatureVertex = useCourseEditor((s) => s.moveFeatureVertex);

    return (
        <div className="flex flex-col min-h-screen bg-slate-900">

            {/* HEADER */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push("/create-course/edit")}
                        className="text-slate-300 hover:text-white transition text-sm"
                    >
                        ← Back
                    </button>

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
                <div className="relative flex-1 min-h-0">

                    {/* FLYTENDE VERKTØYPANEL */}
                    <div className="absolute top-14 left-0 bottom-0 z-40 w-80 bg-black/60 backdrop-blur-md border-r border-white/10">
                        <EditorPanel />
                    </div>

                    {/* HULL-LISTE OVERLAY */}
                    <HoleListOverlay
                        holes={course.holes as Hole[]}
                        selectedHoleId={selectedHoleId}
                        onSelect={setSelectedHole}
                    />

                    {/* KARTET (FULLSCREEN UNDER ALT) */}
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
                        featureTool={featureTool}
                        drawingCoordinates={drawingCoordinates}
                        selectedFeatureId={selectedFeatureId}
                        onAddFeatureCoordinate={(lng, lat) => { void addFeatureCoordinate(lng, lat); }}
                        onSelectFeature={selectFeature}
                        onMoveFeatureVertex={(id, index, lng, lat, persist) => {
                            void moveFeatureVertex(id, index, lng, lat, persist);
                        }}
                    />
                </div>
            )}

            <LoadEditorData courseId={courseId} />
        </div>
    );
}
