"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Toast } from "@/components/Toast";
import { useCourseEditor } from "@/state/useCourseEditor";
import { featureTypeLabel, HOLE_FEATURE_TYPES, type HoleFeature } from "@/types/holeFeatures";
import { useState } from "react";

function FeatureDetails({ feature, onSave, onDelete }: {
    feature: HoleFeature;
    onSave: (description: string) => void;
    onDelete: () => void;
}) {
    const [comment, setComment] = useState(feature.description ?? "");
    return (
        <div className="space-y-2 rounded border border-white/10 p-2">
            <p className="text-xs font-bold">{featureTypeLabel(feature.feature_type)}</p>
            <textarea value={comment} maxLength={2000} onChange={(event) => setComment(event.target.value)}
                placeholder="Comment or rule description" className="min-h-20 w-full rounded bg-slate-900 p-2 text-xs text-white" />
            <div className="flex gap-2">
                <button onClick={() => onSave(comment)} className="flex-1 rounded bg-blue-700 px-2 py-1.5 text-xs font-semibold">Save comment</button>
                <button onClick={onDelete} className="rounded bg-red-800 px-2 py-1.5 text-xs font-semibold">Delete</button>
            </div>
            {feature.geometry && <p className="text-[10px] text-neutral-400">Drag its map vertices to correct geometry.</p>}
        </div>
    );
}

export default function EditorPanel() {
    const course = useCourseEditor((s) => s.course);
    const selectedHoleId = useCourseEditor((s) => s.selectedHoleId);
    const mode = useCourseEditor((s) => s.mode);
    const featureTool = useCourseEditor((s) => s.featureTool);
    const drawingCoordinates = useCourseEditor((s) => s.drawingCoordinates);
    const selectedFeatureId = useCourseEditor((s) => s.selectedFeatureId);

    const setMode = useCourseEditor((s) => s.setMode);
    const saveHole = useCourseEditor((s) => s.saveHole);
    const createNewHole = useCourseEditor((s) => s.createNewHole);
    const startFeatureTool = useCourseEditor((s) => s.startFeatureTool);
    const finishFeatureDrawing = useCourseEditor((s) => s.finishFeatureDrawing);
    const cancelFeatureDrawing = useCourseEditor((s) => s.cancelFeatureDrawing);
    const selectFeature = useCourseEditor((s) => s.selectFeature);
    const updateFeatureComment = useCourseEditor((s) => s.updateFeatureComment);
    const deleteFeature = useCourseEditor((s) => s.deleteFeature);

    const toast = useCourseEditor((s) => s.toast);
    const clearToast = useCourseEditor((s) => s.clearToast);
    const [toolsOpen, setToolsOpen] = useState(false);

    const hole = course?.holes.find((h: any) => h.id === selectedHoleId);
    const features = (hole?.hole_features ?? []) as HoleFeature[];
    const selectedFeature = features.find((feature) => feature.id === selectedFeatureId) ?? null;

    const elevationStats = (() => {
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
    })();

    if (!course) return null;

    return (
        <>
            {toast && <Toast message={toast} onClose={clearToast} />}

            {/* Flytende panel-innhold */}
            <div className="relative w-full h-full overflow-y-auto text-white p-4 space-y-6">

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

                <div className="space-y-3 pt-4 border-t border-white/10">
                    <button
                        onClick={() => setToolsOpen((open) => !open)}
                        className="w-full px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 font-bold tracking-wide"
                    >
                        TOOLS {toolsOpen ? "▲" : "▼"}
                    </button>

                    {toolsOpen && hole && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                {HOLE_FEATURE_TYPES.map((type) => (
                                    <button
                                        key={type}
                                        onClick={async () => {
                                            startFeatureTool(type);
                                            if (type === "INFO") await finishFeatureDrawing();
                                        }}
                                        className={`px-2 py-2 rounded text-xs font-semibold ${featureTool === type
                                            ? "bg-amber-500 text-black"
                                            : "bg-neutral-800/70 hover:bg-neutral-700/70"}`}
                                    >
                                        {featureTypeLabel(type)}
                                    </button>
                                ))}
                            </div>

                            {featureTool && featureTool !== "INFO" && (
                                <div className="rounded border border-amber-400/40 bg-amber-950/30 p-2 text-xs">
                                    <p>Click map points for {featureTypeLabel(featureTool)}.</p>
                                    <p className="mt-1 text-neutral-300">Points: {drawingCoordinates.length}</p>
                                    <div className="mt-2 flex gap-2">
                                        {featureTool !== "MANDO" && featureTool !== "DROPZONE" && (
                                            <button onClick={() => finishFeatureDrawing()} className="flex-1 rounded bg-green-700 px-2 py-1.5">
                                                Finish
                                            </button>
                                        )}
                                        <button onClick={cancelFeatureDrawing} className="flex-1 rounded bg-neutral-700 px-2 py-1.5">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                {features.length === 0 && <p className="text-xs text-neutral-400">No features on this hole.</p>}
                                {features.map((feature) => (
                                    <button
                                        key={feature.id}
                                        onClick={() => selectFeature(feature.id)}
                                        className={`w-full rounded px-2 py-2 text-left text-xs ${selectedFeatureId === feature.id
                                            ? "bg-blue-700"
                                            : "bg-neutral-900/70 hover:bg-neutral-800"}`}
                                    >
                                        <span className="font-bold">{featureTypeLabel(feature.feature_type)}</span>
                                        {feature.description && <span className="block truncate text-neutral-300">{feature.description}</span>}
                                    </button>
                                ))}
                            </div>

                            {selectedFeature && (
                                <FeatureDetails key={selectedFeature.id} feature={selectedFeature}
                                    onSave={(description) => { void updateFeatureComment(selectedFeature.id, description); }}
                                    onDelete={() => {
                                        if (window.confirm(`Delete ${featureTypeLabel(selectedFeature.feature_type)}?`)) {
                                            void deleteFeature(selectedFeature.id);
                                        }
                                    }} />
                            )}
                        </div>
                    )}
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
