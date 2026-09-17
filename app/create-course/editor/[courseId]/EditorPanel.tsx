"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Toast } from "@/components/Toast";
import { useCourseEditor } from "@/state/useCourseEditor";
import {
    featureTypeLabel,
    HOLE_FEATURE_TYPES,
    isMandoPassSide,
    isObLineSide,
    isSharedHoleFeatureType,
    type HoleFeature,
    type ObLineSide,
} from "@/types/holeFeatures";
import { useState } from "react";

function FeatureDetails({ feature, mandoPartners, originHoleNumber, currentHoleNumber,
    applicableHoleNumbers, linkPending, onSave, onDelete, onDetach, onMandoSide, onPairMando, onObLineSide }: {
    feature: HoleFeature;
    mandoPartners: HoleFeature[];
    originHoleNumber: number | null;
    currentHoleNumber: number;
    applicableHoleNumbers: number[];
    linkPending: boolean;
    onSave: (description: string) => void;
    onDelete: () => void;
    onDetach?: () => void;
    onMandoSide: (side: "LEFT" | "RIGHT") => void;
    onPairMando: (partnerId: string) => void;
    onObLineSide: (side: ObLineSide) => void;
}) {
    const [comment, setComment] = useState(feature.description ?? "");
    const [mandoPartnerId, setMandoPartnerId] = useState("");
    const mandoSide = isMandoPassSide(feature.properties?.pass_side)
        ? feature.properties.pass_side
        : null;
    const obLineSide = isObLineSide(feature.properties?.ob_side)
        ? feature.properties.ob_side
        : null;
    const choiceClass = (selected: boolean) =>
        `flex-1 rounded px-2 py-1.5 text-xs font-semibold ${selected
            ? "bg-amber-500 text-black"
            : "bg-neutral-700 hover:bg-neutral-600"}`;

    return (
        <div className="space-y-2 rounded border border-white/10 p-2">
            <p className="text-xs font-bold">{featureTypeLabel(feature.feature_type)}</p>
            {onDetach && originHoleNumber != null && (
                <p className="text-[11px] text-sky-300">Shared from Hole {originHoleNumber}</p>
            )}
            {!onDetach && applicableHoleNumbers.length > 1 && (
                <p className="text-[11px] text-sky-300">Used on Holes {applicableHoleNumbers.join(", ")}</p>
            )}
            {feature.feature_type === "MANDO" && (
                <div className="space-y-2 rounded bg-slate-900/70 p-2">
                    <p className="text-xs font-semibold">Required passing side</p>
                    <div className="flex gap-2">
                        <button onClick={() => onMandoSide("LEFT")} className={choiceClass(mandoSide === "LEFT")}>Left</button>
                        <button onClick={() => onMandoSide("RIGHT")} className={choiceClass(mandoSide === "RIGHT")}>Right</button>
                    </div>
                    <p className="text-[10px] text-neutral-400">For a double mando, select the other mando point. Both points will require passage between them.</p>
                    <div className="flex gap-2">
                        <select
                            value={mandoPartnerId}
                            onChange={(event) => setMandoPartnerId(event.target.value)}
                            className="min-w-0 flex-1 rounded bg-slate-800 px-2 py-1.5 text-xs text-white"
                        >
                            <option value="">Select second mando</option>
                            {mandoPartners.map((partner, index) => (
                                <option key={partner.id} value={partner.id}>
                                    Mando {index + 1}{partner.description ? ` — ${partner.description}` : ""}
                                </option>
                            ))}
                        </select>
                        <button
                            disabled={!mandoPartnerId}
                            onClick={() => onPairMando(mandoPartnerId)}
                            className="rounded bg-blue-700 px-2 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Pair
                        </button>
                    </div>
                    {mandoSide === "BETWEEN" && typeof feature.properties?.group_id === "string" && (
                        <p className="break-all text-[10px] text-emerald-300">Double mando group: {feature.properties.group_id}</p>
                    )}
                </div>
            )}
            {feature.feature_type === "OB_LINE" && (
                <div className="space-y-2 rounded bg-slate-900/70 p-2">
                    <p className="text-xs font-semibold">OB side</p>
                    <p className="text-[10px] text-neutral-400">Left/right is viewed from the tee toward the basket.</p>
                    <div className="flex gap-2">
                        <button onClick={() => onObLineSide("LEFT")} className={choiceClass(obLineSide === "LEFT")}>Left</button>
                        <button onClick={() => onObLineSide("RIGHT")} className={choiceClass(obLineSide === "RIGHT")}>Right</button>
                    </div>
                </div>
            )}
            <textarea value={comment} maxLength={2000} onChange={(event) => setComment(event.target.value)}
                placeholder="Comment or rule description" className="min-h-20 w-full rounded bg-slate-900 p-2 text-xs text-white" />
            <div className="flex gap-2">
                <button onClick={() => onSave(comment)} className="flex-1 rounded bg-blue-700 px-2 py-1.5 text-xs font-semibold">Save comment</button>
                <button onClick={onDelete} className="rounded bg-red-800 px-2 py-1.5 text-xs font-semibold">Delete</button>
            </div>
            {onDetach && (
                <button disabled={linkPending} onClick={onDetach}
                    className="w-full rounded border border-amber-500/50 px-2 py-1.5 text-xs font-semibold text-amber-200 disabled:opacity-40">
                    Remove from Hole {currentHoleNumber}
                </button>
            )}
            {feature.geometry && <p className="text-[10px] text-neutral-400">Drag its map vertices to correct geometry.</p>}
        </div>
    );
}

export default function EditorPanel({ toolsOnly = false }: { toolsOnly?: boolean }) {
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
    const setMandoPassSide = useCourseEditor((s) => s.setMandoPassSide);
    const pairMandos = useCourseEditor((s) => s.pairMandos);
    const setObLineSide = useCourseEditor((s) => s.setObLineSide);
    const deleteFeature = useCourseEditor((s) => s.deleteFeature);
    const detachFeatureFromHole = useCourseEditor((s) => s.detachFeatureFromHole);
    const featureLinkPending = useCourseEditor((s) => s.featureLinkPending);

    const toast = useCourseEditor((s) => s.toast);
    const clearToast = useCourseEditor((s) => s.clearToast);
    const [toolsOpen, setToolsOpen] = useState(true);

    const hole = course?.holes.find((h: any) => h.id === selectedHoleId);
    const features = (hole?.hole_features ?? []) as HoleFeature[];
    const selectedFeature = features.find((feature) => feature.id === selectedFeatureId) ?? null;
    const selectedOriginHole = selectedFeature
        ? course?.holes.find((item: any) => item.id === (selectedFeature.origin_hole_id ?? selectedFeature.hole_id))
        : null;
    const selectedApplicableHoleNumbers = selectedFeature
        ? course?.holes
            .filter((item: any) => (selectedFeature.applicable_hole_ids ?? [selectedFeature.hole_id]).includes(item.id))
            .map((item: any) => item.number) ?? []
        : [];
    const selectedFeatureIsLinked = Boolean(selectedFeature && isSharedHoleFeatureType(selectedFeature.feature_type) && selectedHoleId
        && (selectedFeature.origin_hole_id ?? selectedFeature.hole_id) !== selectedHoleId);

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
            {!toolsOnly && toast && <Toast message={toast} onClose={clearToast} />}

            {/* Flytende panel-innhold */}
            <div className="relative w-full h-full overflow-y-auto text-white p-4 space-y-6">

                {!toolsOnly && <>
                {/* Course info */}
                <div>
                    <h2 className="text-xl font-bold">{course.name}</h2>
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

                </>}
                {toolsOnly && <div className="space-y-3 pt-4 border-t border-white/10">
                    <button
                        onClick={() => setToolsOpen((open) => !open)}
                        className="w-full px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 font-bold tracking-wide"
                    >
                        FEATURES {toolsOpen ? "▲" : "▼"}
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
                                <p className="text-xs text-neutral-400">Current features</p>
                                {features.length === 0 && <p className="text-xs text-neutral-400">No features on this variation.</p>}
                                {features.map((feature) => (
                                    <button
                                        key={feature.id}
                                        onClick={() => selectFeature(feature.id)}
                                        className={`w-full rounded px-2 py-2 text-left text-xs ${selectedFeatureId === feature.id
                                            ? "bg-blue-700"
                                            : "bg-neutral-900/70 hover:bg-neutral-800"}`}
                                    >
                                        <span className="font-bold">{featureTypeLabel(feature.feature_type)}</span>
                                        {feature.description && <span className="text-neutral-300"> · {feature.description}</span>}
                                    </button>
                                ))}
                            </div>

                            {selectedFeature && (
                                <FeatureDetails key={selectedFeature.id} feature={selectedFeature}
                                    mandoPartners={features.filter((feature) =>
                                        feature.feature_type === "MANDO" && feature.id !== selectedFeature.id)}
                                    originHoleNumber={selectedOriginHole?.number ?? null}
                                    currentHoleNumber={hole.number}
                                    applicableHoleNumbers={selectedApplicableHoleNumbers}
                                    linkPending={featureLinkPending}
                                    onSave={(description) => { void updateFeatureComment(selectedFeature.id, description); }}
                                    onMandoSide={(side) => { void setMandoPassSide(selectedFeature.id, side); }}
                                    onPairMando={(partnerId) => { void pairMandos(selectedFeature.id, partnerId); }}
                                    onObLineSide={(side) => { void setObLineSide(selectedFeature.id, side); }}
                                    onDetach={selectedFeatureIsLinked ? () => {
                                        if (window.confirm(`Remove this feature from Hole ${hole.number}? The physical feature will remain on its other holes.`)) {
                                            void detachFeatureFromHole(selectedFeature.id, hole.id);
                                        }
                                    } : undefined}
                                    onDelete={() => {
                                        const message = selectedApplicableHoleNumbers.length > 1
                                            ? "Delete this physical feature from every hole using it?"
                                            : `Delete ${featureTypeLabel(selectedFeature.feature_type)}?`;
                                        if (window.confirm(message)) {
                                            void deleteFeature(selectedFeature.id);
                                        }
                                    }} />
                            )}
                        </div>
                    )}
                </div>

                }
                {/* Hole info + Save */}
                {!toolsOnly && hole && (
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
