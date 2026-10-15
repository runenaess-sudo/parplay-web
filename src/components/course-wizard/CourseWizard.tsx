"use client";
import { supabaseBrowser as db } from "@/lib/supabase-browser";
import { useCourseEditor } from "@/state/useCourseEditor";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import DirectionsForm, { type DirectionsValue } from "../../../app/club-manager/courses/[courseId]/directions/DirectionsForm";
import FacilitiesForm, { type FacilitiesValue } from "../../../app/club-manager/courses/[courseId]/facilities/FacilitiesForm";
import CourseImagesManager from "../../../app/club-manager/courses/[courseId]/images/CourseImagesManager";
import CourseEditor from "../../../app/create-course/editor/[courseId]/CourseEditor";
import { createStepNavigationLock, requireConfirmedCourseId } from "./basicCourseSave";
import LayoutPreview from "./LayoutPreview";
import LayoutSetup from "./LayoutSetup";
import { BasicStep, ContactStep, PublishStep, emptyBasic, emptyContact } from "./WizardForms";
import { WizardStepContext } from "./WizardStep";

const steps = ["Basic Information", "Holes", "Layout Setup", "Preview Layout", "Facilities", "Directions", "Contact Person", "Images", "Publish"];
const emptyFacilities: FacilitiesValue = { toilets: false, water: false, parking: false, kiosk: false, benches: false, trashcans: false, signage: false, dog_friendly: false, lighting: false, wheelchair_friendly: false, terrain: "", surface: "", opening_hours: "", description: "", tee_type: "", basket_type: "" };
const emptyDirections: DirectionsValue = { parking_latitude: "", parking_longitude: "", parking_description: "", general_directions: "", public_transport: "", walking_path: "", entrance_description: "" };
type Hole = { id: string; number: number; par: number; distance: number | null };
type Layout = { id: string; name: string; published: boolean };
type ImageRow = { id: string; image_url: string; description: string | null; sort_order: number };
type Initial = { basic: typeof emptyBasic; facilities: FacilitiesValue; directions: DirectionsValue; contact: typeof emptyContact; images: ImageRow[] };
function Section({ index, active, scope, saves, children }: { index: number; active: number; scope: string; saves: React.RefObject<Map<number, () => Promise<unknown>>>; children: ReactNode }) {
  const context = useMemo(() => {
    const callbacks = new Set<() => Promise<unknown>>();
    return {
      scope, register: (save: () => Promise<unknown>) => {
        callbacks.add(save);
        saves.current.set(index, async () => { for (const callback of callbacks) await callback(); });
        return () => { callbacks.delete(save); if (!callbacks.size) saves.current.delete(index); };
      }
    };
  }, [scope, saves, index]);
  return <WizardStepContext.Provider value={context}><section hidden={index !== active} aria-label={steps[index]}>{children}</section></WizardStepContext.Provider>;
}
export default function CourseWizard({ userId, initialCourseId }: { userId: string; initialCourseId: string | null }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(initialCourseId);
  const [active, setActive] = useState(0);
  const [visited, setVisited] = useState<number[]>([0]);
  const [initial, setInitial] = useState<Initial | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigationLock = useRef(createStepNavigationLock()).current;
  const [holes, setHoles] = useState<Hole[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [drafts, setDrafts] = useState<{ id: string; name: string }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const saves = useRef(new Map<number, () => Promise<unknown>>());
  const [scope, setScope] = useState(`parplay:wizard:${userId}:${initialCourseId ?? "new"}`);
  const currentId = useRef(initialCourseId);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const membership = await db.rpc("current_parplay_membership_v1");
        if (membership.error) throw membership.error;
        if (live) setIsAdmin(membership.data === "admin");
        if (!initialCourseId) {
          const own = await db.from("courses").select("id,name").eq("created_by", userId);
          if (own.error) throw own.error;
          const publications = own.data.length ? await db.from("course_first_publications").select("course_id").in("course_id", own.data.map(c => c.id)) : { data: [], error: null };
          if (publications.error) throw publications.error;
          const published = new Set((publications.data ?? []).map(p => p.course_id));
          if (live) { setDrafts(own.data.filter(c => !published.has(c.id))); setInitial({ basic: emptyBasic, facilities: emptyFacilities, directions: emptyDirections, contact: emptyContact, images: [] }); }
          return;
        }
        const results = await Promise.all([
          db.from("courses").select("name,location,latitude,longitude,description").eq("id", initialCourseId).single(),
          db.from("course_facilities").select("*").eq("course_id", initialCourseId).maybeSingle(),
          db.from("course_directions").select("*").eq("course_id", initialCourseId).maybeSingle(),
          db.from("course_contacts").select("*").eq("course_id", initialCourseId).maybeSingle(),
          db.from("course_images").select("id,image_url,description,sort_order").eq("course_id", initialCourseId).order("sort_order"),
        ]);
        for (const result of results) if (result.error) throw result.error;
        const normalize = <T extends Record<string, string | boolean>>(defaults: T, row: Record<string, unknown> | null): T => Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, typeof value === "boolean" ? row?.[key] === true : String(row?.[key] ?? value)])) as T;
        if (live) setInitial({ basic: normalize(emptyBasic, results[0].data), facilities: normalize(emptyFacilities, results[1].data), directions: normalize(emptyDirections, results[2].data), contact: normalize(emptyContact, results[3].data), images: (results[4].data ?? []) as ImageRow[] });
      } catch { if (live) setError("Course information could not be loaded. Reload to try again; no data has been changed."); }
    })();
    return () => { live = false; };
  }, [initialCourseId, userId]);
  async function refresh(id: string) {
    const [h, l] = await Promise.all([db.from("holes").select("id,number,par,distance").eq("course_id", id).order("number"), db.from("course_layouts").select("id,name,published").eq("course_id", id).order("created_at")]);
    if (h.error || l.error) throw h.error || l.error;
    setHoles(h.data ?? []); setLayouts(l.data ?? []);
  }
  async function navigate(next: number) {
    if (!navigationLock.acquire()) return;
    setBusy(true); setError("");
    try {
      try {
        const save = saves.current.get(active);
        const saved = await save?.();
        if (active === 0) requireConfirmedCourseId(saved, currentId.current);
        if (active === 1) {
          const state = useCourseEditor.getState();
          if (state.course?.id === courseId && state.selectedHoleId && !await state.saveHole(state.selectedHoleId)) throw new Error("Hole save failed");
        }
      } catch (error) {
        if (active !== 0) {
          setError("Some changes could not be saved to the server. Your draft is still available in its step.");
        } else {
          if (!saves.current.has(active) || (error instanceof Error && error.message === "Step 1 did not confirm a saved course.")) {
            setError("The course save was not confirmed. Review Step 1 and try again.");
          }
          return;
        }
      }
      try { if (currentId.current) await refresh(currentId.current); } catch { setError("Could not refresh saved holes and layouts. Your draft is still here."); }
      if (next === 8 && currentId.current) {
        try { for (const [index, save] of Array.from(saves.current)) if (index !== active) await save(); }
        catch { setError("Some changes could not be saved. Review the affected step before publishing."); }
      }
      setVisited(v => v.includes(next) ? v : [...v, next]); setActive(next);
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    } finally {
      navigationLock.release();
      setBusy(false);
    }
  }
  const created = (id: string) => {
    currentId.current = id; setCourseId(id); setDrafts([]);
    const nextScope = `parplay:wizard:${userId}:${id}`;
    if (scope !== nextScope) {
      try { for (const key of Object.keys(sessionStorage)) if (key.startsWith(`${scope}:`)) { sessionStorage.setItem(nextScope + key.slice(scope.length), sessionStorage.getItem(key)!); sessionStorage.removeItem(key); } } catch { /* Mounted draft remains available. */ }
      setScope(nextScope);
      window.history.replaceState(null, "", `/create-course/new?courseId=${encodeURIComponent(id)}`);
    }
  };
  const prerequisite = <p className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-300">This step is open. Save the course name and location in Basic Information to attach holes, layouts and images to your course.</p>;
  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-blue-300">Course builder</p><h1 className="mt-2 text-3xl font-semibold">Create Course</h1><p className="mt-2 text-slate-400">Move freely between steps. Incomplete information can be finished before publishing.</p></div><Link className="text-blue-300" href={courseId ? `/club-manager/courses/${courseId}` : "/create-course/edit"}>{courseId ? "Course Overview" : "My Course Builds"}</Link></div>
    <nav aria-label="Course creation steps" className="mb-8 grid grid-cols-3 gap-2 lg:grid-cols-9">{steps.map((label, i) => <button key={label} type="button" disabled={busy} onClick={() => void navigate(i)} aria-current={active === i ? "step" : undefined} className={`rounded-xl border p-3 text-left transition disabled:cursor-wait disabled:opacity-60 ${active === i ? "border-blue-400 bg-blue-500/15 text-white" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-400"}`}><span className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${active === i ? "bg-blue-500" : "bg-slate-700"}`}>{i + 1}</span><span className="text-xs">{label}</span></button>)}</nav>
    {busy && <p role="status" className="mb-4 text-blue-300">{active === 0 ? "Validating and saving course…" : "Saving changes…"}</p>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-500/10 p-4 text-red-300">{error}</p>}
    {!initial ? <p>Loading course…</p> : <>
      {drafts.length > 0 && <aside className="mb-6 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4"><p className="text-amber-200">You have courses that have never been published. Continue an existing build. Creation limits are checked when saving a new course.</p>{drafts.map(d => <Link key={d.id} className="mt-2 block text-blue-300" href={`/create-course/new?courseId=${d.id}`}>Continue {d.name || "course"} →</Link>)}</aside>}
      <h2 className="mb-4 text-xl font-semibold">{active + 1}. {steps[active]}</h2>
      <fieldset disabled={busy} className={busy ? "pointer-events-none" : ""}>
        {visited.map(index => <Section key={index} index={index} active={active} scope={scope} saves={saves}>
          {index === 0 && <BasicStep initial={initial.basic} userId={userId} courseId={courseId} isAdmin={isAdmin} created={created} />}
          {index === 1 && (courseId ? <CourseEditor courseId={courseId} embedded /> : prerequisite)}
          {index === 2 && <><LayoutSetup courseId={courseId ?? ""} holes={holes} layouts={layouts} onSaved={() => { if (courseId) void refresh(courseId).catch(() => setError("Layout saved, but the list could not be refreshed.")); }} />{!courseId && prerequisite}</>}
          {index === 3 && (courseId ? <LayoutPreview layouts={layouts} active={active === 3} /> : prerequisite)}
          {index === 4 && <FacilitiesForm courseId={courseId ?? ""} initialValue={initial.facilities} />}
          {index === 5 && <DirectionsForm courseId={courseId ?? ""} initialValue={initial.directions} />}
          {index === 6 && <ContactStep initial={initial.contact} courseId={courseId} />}
          {index === 7 && (courseId ? <CourseImagesManager courseId={courseId} initialImages={initial.images} /> : prerequisite)}
          {index === 8 && <PublishStep courseId={courseId} active={active === 8} onPublished={() => { try { for (const key of Object.keys(sessionStorage)) if (key.startsWith(`${scope}:`)) sessionStorage.removeItem(key); } catch { /* Optional draft cache. */ } router.push(`/club-manager/courses/${courseId}`); router.refresh(); }} />}
        </Section>)}
      </fieldset>
      <footer className="mt-8 flex justify-between border-t border-slate-800 pt-6"><button type="button" className="rounded-xl border border-slate-700 px-5 py-3 disabled:opacity-40" disabled={active === 0 || busy} onClick={() => void navigate(active - 1)}>Previous</button>{active < 8 && <button type="button" className="rounded-xl bg-blue-600 px-5 py-3 font-semibold disabled:cursor-wait disabled:opacity-50" disabled={busy} onClick={() => void navigate(active + 1)}>{active === 0 ? "Save & Continue" : "Next"}</button>}</footer>
    </>}
  </main>;
}
