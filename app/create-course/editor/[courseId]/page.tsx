"use client";

import { useCourseEditor } from "@/state/useCourseEditor";
import { type HoleFeature } from "@/types/holeFeatures";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import EditorPanel from "./EditorPanel";
import PlayOptionsPanel from './PlayOptionsPanel';
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
    const setFairwayPointWidth = useCourseEditor((s) => s.setFairwayPointWidth);
    const removeFairwayPoint = useCourseEditor((s) => s.removeFairwayPoint);
    const setTeeAngle = useCourseEditor((s) => s.setTeeAngle);
    const setSelectedHole = useCourseEditor((s) => s.setSelectedHole);
    const addFeatureCoordinate = useCourseEditor((s) => s.addFeatureCoordinate);
    const selectFeature = useCourseEditor((s) => s.selectFeature);
    const moveFeatureVertex = useCourseEditor((s) => s.moveFeatureVertex);
    const attachFeatureToHole = useCourseEditor((s) => s.attachFeatureToHole);
    const featureLinkPending = useCourseEditor((s) => s.featureLinkPending);
    const [weakSelection, setWeakSelection] = useState<{ featureId: string; holeId: string } | null>(null);
    const [toolsOpen, setToolsOpen] = useState(true);
    const [builderOpen, setBuilderOpen] = useState(false);

    const selectWeakFeature = (featureId: string) => {
        if (selectedHoleId) setWeakSelection({ featureId, holeId: selectedHoleId });
    };
    const canonicalFeatures = new Map<string, HoleFeature>(
        ((course?.canonical_hole_features ?? []) as HoleFeature[]).map((feature) => [feature.id, feature]),
    );
    const selectedWeakFeature = weakSelection?.holeId === selectedHoleId
        ? canonicalFeatures.get(weakSelection.featureId) ?? null
        : null;
    const currentWeakTargetHole = course?.holes.find((hole: Hole) => hole.id === selectedHoleId) ?? null;
    const weakOriginHole = selectedWeakFeature
        ? course?.holes.find((hole: Hole) =>
            hole.id === (selectedWeakFeature.origin_hole_id ?? selectedWeakFeature.hole_id)) ?? null
        : null;
    const weakFeatureLabel = selectedWeakFeature?.feature_type === "OB_LINE"
        ? "OB line"
        : selectedWeakFeature?.feature_type === "OB_AREA" ? "OB area" : "hazard area";

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-slate-900">

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
                    <button onClick={() => setBuilderOpen(open => !open)} aria-expanded={builderOpen} className="absolute left-2 top-14 z-50 min-h-11 rounded bg-slate-800 px-3 text-white lg:hidden">Build hole</button>
                    <div className={`${builderOpen ? 'block' : 'hidden lg:block'} absolute top-28 lg:top-14 left-0 bottom-0 z-40 w-64 max-w-[85vw] bg-black/90 backdrop-blur-md border-r border-white/10`}>
                        <EditorPanel />
                    </div>
                    <button onClick={() => setToolsOpen(open => !open)} aria-expanded={toolsOpen}
                        className="absolute right-2 top-14 z-50 min-h-11 rounded bg-slate-800 px-3 text-white">{toolsOpen ? 'Hide tools' : 'Tools'}</button>
                    {toolsOpen && <aside className="absolute right-0 top-28 bottom-0 z-40 w-[260px] max-w-[85vw] overflow-y-auto border-l border-white/10 bg-slate-950/95 backdrop-blur-md">
                        <PlayOptionsPanel key={`${courseId}:${selectedHoleId}`} />
                        <EditorPanel toolsOnly />
                    </aside>}

                    {/* HULL-LISTE OVERLAY */}
                    <HoleListOverlay
                        holes={course.holes as Hole[]}
                        selectedHoleId={selectedHoleId}
                        onSelect={setSelectedHole}
                    />

                    {/* KARTET (FULLSCREEN UNDER ALT) */}
                    <MapCanvas
                        toolsOpen={toolsOpen}
                        course={course}
                        selectedHoleId={selectedHoleId}
                        mode={mode}
                        onSetTee={setTee}
                        onSetBasket={setBasket}
                        onAddFairwayPoint={addFairwayPoint}
                        onMoveFairwayPoint={moveFairwayPoint}
                        onSetFairwayPointWidth={setFairwayPointWidth}
                        onRemoveFairwayPoint={removeFairwayPoint}
                        onSetTeeAngle={setTeeAngle}
                        featureTool={featureTool}
                        drawingCoordinates={drawingCoordinates}
                        selectedFeatureId={selectedFeatureId}
                        onAddFeatureCoordinate={(lng, lat) => { void addFeatureCoordinate(lng, lat); }}
                        onSelectFeature={selectFeature}
                        onSelectWeakFeature={selectWeakFeature}
                        onMoveFeatureVertex={(id, index, lng, lat, persist) => {
                            void moveFeatureVertex(id, index, lng, lat, persist);
                        }}
                    />

                    {selectedWeakFeature && currentWeakTargetHole && weakOriginHole && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
                            onClick={() => { if (!featureLinkPending) setWeakSelection(null); }}>
                            <div className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 p-5 text-white shadow-2xl"
                                onClick={(event) => event.stopPropagation()}>
                                <h2 className="text-lg font-bold">Use existing {weakFeatureLabel}?</h2>
                                <p className="mt-2 text-sm text-slate-300">
                                    This feature currently belongs to Hole {weakOriginHole.number}. Do you want to use it for Hole {currentWeakTargetHole.number} as well?
                                </p>
                                <div className="mt-5 flex justify-end gap-2">
                                    <button disabled={featureLinkPending} onClick={() => setWeakSelection(null)}
                                        className="rounded bg-slate-700 px-3 py-2 text-sm disabled:opacity-40">Cancel</button>
                                    <button disabled={featureLinkPending} onClick={async () => {
                                        const attached = await attachFeatureToHole(selectedWeakFeature.id, currentWeakTargetHole.id);
                                        if (attached) setWeakSelection(null);
                                    }} className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold disabled:opacity-40">
                                        {featureLinkPending ? "Adding…" : `Use on Hole ${currentWeakTargetHole.number}`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <LoadEditorData courseId={courseId} />
        </div>
    );
}
