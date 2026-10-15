"use client";
import { useContext, useEffect, useMemo, useState } from "react";
import AddLayoutForm from "../../../app/club-manager/courses/[courseId]/layouts/new/AddLayoutForm";
import { supabaseBrowser as db } from "@/lib/supabase-browser";
import { WizardStepContext } from "./WizardStep";

type InitialLayout = { name: string; description: string; difficulty: number; selectedHoleIds: string[] };
export default function LayoutSetup({ courseId, holes, layouts, onSaved }: {
  courseId: string;
  holes: { id: string; number: number; par: number; distance: number | null }[];
  layouts: { id: string; name: string; published: boolean }[];
  onSaved: () => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const id = choice ?? layouts.find(l => !l.published)?.id ?? "new";
  const [loaded, setLoaded] = useState<{ id: string; data: InitialLayout } | null>(null);
  const [error, setError] = useState("");
  const parent = useContext(WizardStepContext);
  const context = useMemo(() => parent ? { ...parent, scope: `${parent.scope}:layout:${id}` } : null, [parent, id]);
  useEffect(() => {
    if (id === "new") return;
    let live = true;
    void (async () => {
      const [layout, membership] = await Promise.all([
        db.from("course_layouts").select("name,description,difficulty,published").eq("id", id).eq("course_id", courseId).single(),
        db.from("layout_holes").select("hole_id,locked").eq("layout_id", id).order("order_index"),
      ]);
      if (!live) return;
      if (layout.error || membership.error || layout.data?.published || membership.data?.some(h => h.locked)) { setError("This layout could not be opened for editing. Published and locked layouts are preserved."); return; }
      setLoaded({ id, data: { name: layout.data.name ?? "", description: layout.data.description ?? "", difficulty: layout.data.difficulty ?? 3, selectedHoleIds: membership.data.map(h => h.hole_id) } }); setError("");
    })();
    return () => { live = false; };
  }, [id, courseId]);
  async function select(next: string) { setChoice(next); }
  return <div>{layouts.length > 0 && <label>Layout to configure<select className="ml-3 rounded-lg border border-slate-700 bg-slate-900 p-2" value={id} onChange={e => void select(e.target.value)}><option value="new">New layout</option>{layouts.filter(l => !l.published).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}{error && <p role="alert" className="text-red-300">{error}</p>}{id === "new" || loaded?.id === id ? <WizardStepContext.Provider value={context}><AddLayoutForm key={id} courseId={courseId} holes={holes} clubId={null} layoutId={id === "new" ? undefined : id} initialLayout={loaded?.id === id ? loaded.data : undefined} onSaved={(savedId) => {
    try { if (context) for (const key of Object.keys(sessionStorage)) if (key.startsWith(`${context.scope}:`)) sessionStorage.removeItem(key); } catch { /* Optional cache. */ }
    setChoice(savedId); onSaved();
  }} /></WizardStepContext.Provider> : <p>Loading layout…</p>}</div>;
}
