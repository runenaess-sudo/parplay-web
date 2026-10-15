"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { MapCanvas } from "../../../app/create-course/editor/[courseId]/MapCanvas";

type ResolvedHole = { id: string; number: number; par: number; distance: number | null };
const noop = () => {};
export default function LayoutPreview({ layouts, active }: { layouts: { id: string; name: string }[]; active: boolean }) {
  const [selected, setSelected] = useState("");
  const id = selected || layouts[0]?.id;
  const [holes, setHoles] = useState<ResolvedHole[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id || !active) return;
    let live = true;
    void supabaseBrowser.rpc("get_resolved_layout_holes_v1", { p_layout_id: id }).then(result => {
      if (!live) return;
      if (result.error || !Array.isArray(result.data)) { setHoles([]); setError("Layout preview could not be loaded."); }
      else { setHoles(result.data.map(h => ({ ...h, hole_features: h.features ?? [], fairway: Array.isArray(h.fairway) ? h.fairway : [] }))); setError(""); }
    });
    return () => { live = false; };
  }, [id, active, layouts]);
  if (!layouts.length) return <p className="text-slate-300">Save a layout in Layout Setup to preview it here.</p>;
  return <div className="space-y-4"><label className="block">Layout<select value={id} onChange={e => setSelected(e.target.value)} className="ml-3 rounded-lg border border-slate-700 bg-slate-900 p-2">{layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label><p>{holes.length} holes · Par {holes.reduce((sum, h) => sum + (h.par ?? 0), 0)} · {holes.reduce((sum, h) => sum + (h.distance ?? 0), 0)} m</p>{error && <p role="alert" className="text-red-300">{error}</p>}{active && holes.length > 0 && <div className="relative h-[60vh] min-h-96 overflow-hidden rounded-xl"><MapCanvas key={id} readOnly course={{ id, holes }} selectedHoleId={null} mode="none" featureTool={null} drawingCoordinates={[]} selectedFeatureId={null} onSetTee={noop} onSetBasket={noop} onAddFairwayPoint={noop} onMoveFairwayPoint={noop} onSetFairwayPointWidth={noop} onRemoveFairwayPoint={noop} onSetTeeAngle={noop} onAddFeatureCoordinate={noop} onSelectFeature={noop} onSelectWeakFeature={noop} onMoveFeatureVertex={noop} /></div>}</div>;
}
