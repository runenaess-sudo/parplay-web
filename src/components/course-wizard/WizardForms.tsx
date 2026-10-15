"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser as db } from "@/lib/supabase-browser";
import { useWizardDraft, useWizardSave } from "./WizardStep";
import { CourseLocationMap } from "../../../app/(site)/courses/[courseId]/CourseLocationMap";

export const emptyBasic = { name: "", location: "", latitude: "", longitude: "", description: "" };
export const emptyContact = { name: "", email: "", phone: "", club: "", role: "", description: "", owner_contact_status: "" };
const fieldClass = "mt-2 w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-slate-100 focus:border-blue-400";
const buttonClass = "rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50";
function fields<T extends Record<string, string>>(value: T, set: (value: T) => void, labels: Partial<Record<keyof T, string>>) {
  return Object.entries(labels).map(([key, label]) => <label key={key} className="block text-sm text-slate-300">{label}{key === "description" ? <textarea className={fieldClass} rows={4} value={value[key]} onChange={e => set({ ...value, [key]: e.target.value })} /> : <input className={fieldClass} value={value[key]} onChange={e => set({ ...value, [key]: e.target.value })} />}</label>);
}
const creationMessages: Record<string, string> = {
  COURSE_DAILY_LIMIT_REACHED: "You have reached today's course creation limit. You can continue an existing course.",
  COURSE_UNFINISHED_EXISTS: "Finish or continue your existing unpublished course before creating another. Open My Course Builds to continue.",
  COURSE_CREATION_NOT_ALLOWED: "Your account cannot create this course. Existing course management access is unchanged.",
};
export function BasicStep({ initial, userId, courseId, isAdmin, created }: { initial: typeof emptyBasic; userId: string; courseId: string | null; isAdmin: boolean; created: (id: string) => void }) {
  const [value, setValue, markSaved] = useWizardDraft("basic", initial);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const idRef = useRef(courseId);
  const saved = useRef(JSON.stringify(initial));
  // A stable INSERT id also makes retries after a lost response idempotent.
  const insertId = useRef<string | null>(null);
  async function save() {
    if (busy.current) return;
    if (!value.name.trim() || !value.location.trim()) { setMessage("Your draft is retained. Enter a real course name and location to save it."); return; }
    if (idRef.current && saved.current === JSON.stringify(value)) return;
    busy.current = true; setSaving(true); setMessage("Saving…");
    try {
      const lat = value.latitude.trim() ? Number(value.latitude.replace(",", ".")) : null;
      const lng = value.longitude.trim() ? Number(value.longitude.replace(",", ".")) : null;
      if ((lat === null) !== (lng === null) || (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) || (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))) throw new Error("Enter a valid coordinate pair, or leave both coordinates empty.");
      if (!idRef.current && insertId.current) {
        const retry = await db.from("courses").select("id").eq("id", insertId.current).eq("created_by", userId).maybeSingle();
        if (retry.error) throw retry.error;
        if (retry.data) { idRef.current = retry.data.id; created(retry.data.id); }
      }
      if (!isAdmin && lat !== null && lng !== null) {
        const nearby = await db.from("courses").select("id,name,latitude,longitude");
        if (nearby.error) throw nearby.error;
        const rad = (v: number) => v * Math.PI / 180;
        const match = nearby.data.find(c => c.id !== idRef.current && c.latitude != null && c.longitude != null && 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin(rad(c.latitude - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(c.latitude)) * Math.sin(rad(c.longitude - lng) / 2) ** 2))) < 200);
        if (match) throw new Error(`A course already exists within 200 metres: ${match.name}. Check the location before creating another course.`);
      }
      const payload = { name: value.name.trim(), location: value.location.trim(), description: value.description.trim(), latitude: lat, longitude: lng };
      insertId.current ??= crypto.randomUUID();
      const result = idRef.current ? await db.from("courses").update(payload).eq("id", idRef.current).select("id").single() : await db.from("courses").insert({ ...payload, id: insertId.current, created_by: userId, status: "draft", is_published: false }).select("id").single();
      if (result.error) throw result.error;
      idRef.current = result.data.id; markSaved(); created(result.data.id); saved.current = JSON.stringify(value); setMessage("Basic information saved.");
    } catch (e) { const text = String((e as { message?: string }).message ?? "Could not save. Your draft is retained."); setMessage(creationMessages[text] ?? text); throw e; }
    finally { busy.current = false; setSaving(false); }
  }
  useWizardSave(save);
  function gps() {
    if (!navigator.geolocation) { setMessage("Location unavailable. Enter coordinates manually."); return; }
    navigator.geolocation.getCurrentPosition(p => setValue(v => ({ ...v, latitude: String(p.coords.latitude), longitude: String(p.coords.longitude) })), () => setMessage("Location unavailable. Enter coordinates manually."));
  }
  const lat = Number(value.latitude.replace(",", ".")), lng = Number(value.longitude.replace(",", "."));
  return <div className="max-w-3xl space-y-5">{fields(value, setValue, { name: "Course name", location: "City / area", latitude: "Latitude", longitude: "Longitude", description: "Description" })}<button className="text-blue-300" onClick={gps}>Use my position</button>{value.latitude && value.longitude && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && <CourseLocationMap latitude={lat} longitude={lng} name={value.name || "Course location"} />}<p className="text-sm text-slate-400">A real name and location are needed to save a course. You can open every step before completing them.</p><button className={buttonClass} disabled={saving} onClick={() => void save().catch(() => {})}>{saving ? "Saving…" : "Save basic information"}</button>{message && <p role="status">{message}</p>}</div>;
}

export function ContactStep({ initial, courseId }: { initial: typeof emptyContact; courseId: string | null }) {
  const [value, setValue, markSaved] = useWizardDraft("contact", initial);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const saved = useRef(JSON.stringify(initial));
  async function save() {
    if (!courseId || busy.current || saved.current === JSON.stringify(value)) return;
    busy.current = true;
    try {
      const { error } = await db.from("course_contacts").upsert({ ...value, course_id: courseId, owner_contact_status: value.owner_contact_status || null }, { onConflict: "course_id" });
      if (error) throw error;
      if (value.owner_contact_status === "unknown" || (value.name.trim() && value.email.trim() && value.phone.trim())) {
        const progress = await db.from("courses").update({ has_contact: true }).eq("id", courseId).select("id").single();
        if (progress.error) throw progress.error;
      }
      saved.current = JSON.stringify(value); markSaved(); setMessage("Contact information saved.");
    } catch (e) { setMessage("Contact could not be saved. Your draft is still here."); throw e; }
    finally { busy.current = false; }
  }
  useWizardSave(save);
  return <div className="max-w-3xl space-y-5"><fieldset><legend className="mb-3">Do you know who manages this course?</legend>{[["known", "Yes, I have contact information"], ["unknown", "No, the contact is unknown"]].map(([v, label]) => <label key={v} className="mr-5 inline-flex gap-2"><input type="radio" name="contact-status" checked={value.owner_contact_status === v} onChange={() => setValue({ ...value, owner_contact_status: v })} />{label}</label>)}</fieldset>{value.owner_contact_status !== "unknown" && fields(value, setValue, { name: "Contact name", email: "Email", phone: "Phone", club: "Club", role: "Role", description: "Additional information" })}<p className="text-sm text-slate-400">For a known owner, Basic and Pro creators need name, email and phone before publication.</p><button className={buttonClass} onClick={() => void save().catch(() => {})}>Save contact</button>{message && <p role="status">{message}</p>}</div>;
}

export function PublishStep({ courseId, active, onPublished }: { courseId: string | null; active: boolean; onPublished: () => void }) {
  const [checks, setChecks] = useState<[string, boolean][]>([]);
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const busy = useRef(false);
  const [previouslyPublished, setPreviouslyPublished] = useState(false);
  const [firstPublicationVerified, setFirstPublicationVerified] = useState(false);
  useEffect(() => {
    if (!courseId || !active) return;
    let live = true;
    void (async () => {
      const [course, holes, layouts, contact, history] = await Promise.all([
        db.from("courses").select("name,created_by,is_published,published_at,has_facilities,has_images,has_directions").eq("id", courseId).single(),
        db.from("holes").select("id", { count: "exact", head: true }).eq("course_id", courseId),
        db.from("course_layouts").select("id", { count: "exact", head: true }).eq("course_id", courseId),
        db.from("course_contacts").select("name,email,phone,owner_contact_status").eq("course_id", courseId).maybeSingle(),
        db.from("course_first_publications").select("course_id").eq("course_id", courseId).maybeSingle(),
      ]);
      if (!live) return;
      if ([course, holes, layouts, contact, history].some(r => r.error)) { setMessage("Could not refresh publication information. Try reopening this step."); return; }
      const auth = await db.auth.getUser();
      if (!live) return;
      // History is contributor-only under existing RLS. An empty result for a
      // different manager must never be treated as proof of first publication.
      setFirstPublicationVerified(!auth.error && course.data?.created_by === auth.data.user?.id);
      setPreviouslyPublished(Boolean(history.data || course.data?.is_published || course.data?.published_at));
      setChecks([["Basic information", Boolean(course.data?.name?.trim())], ["Holes", (holes.count ?? 0) > 0], ["Layouts", (layouts.count ?? 0) > 0], ["Facilities", course.data?.has_facilities === true], ["Directions", course.data?.has_directions === true], ["Images", course.data?.has_images === true], ["Owner contact", contact.data?.owner_contact_status === "unknown" || Boolean(contact.data?.owner_contact_status === "known" && contact.data?.name?.trim() && contact.data?.email?.trim() && contact.data?.phone?.trim())]]);
    })();
    return () => { live = false; };
  }, [active, courseId]);
  async function publish() {
    if (!courseId || busy.current || previouslyPublished || !firstPublicationVerified) return;
    busy.current = true; setPublishing(true); setMessage("");
    try {
      const history = await db.from("course_first_publications").select("course_id").eq("course_id", courseId).maybeSingle();
      if (history.error) throw history.error;
      if (history.data) { setPreviouslyPublished(true); return; }
      const result = await db.rpc("publish_course_v1", { p_course_id: courseId });
      if (result.error) throw result.error;
      onPublished();
    } catch (e) { setMessage(String((e as { message?: string }).message ?? "Publication failed. Your course remains saved.")); }
    finally { busy.current = false; setPublishing(false); }
  }
  return <div className="max-w-3xl space-y-5"><p className="text-slate-300">Publication checks the saved course. Missing information does not prevent you from visiting other steps.</p>{!courseId && <p>Save Basic Information to create your course before publishing.</p>}<ul className="divide-y divide-slate-800">{checks.map(([name, ready]) => <li key={name} className="flex justify-between py-3"><span>{name}</span><span className={ready ? "text-emerald-300" : "text-amber-300"}>{ready ? "Ready" : "Needs attention"}</span></li>)}</ul>{previouslyPublished ? <p>This course has already been published. Manage its visibility from Course Overview.</p> : <><button className={buttonClass} disabled={!courseId || publishing || !firstPublicationVerified} onClick={() => void publish()}>{publishing ? "Publishing…" : "Publish course"}</button>{courseId && !firstPublicationVerified && checks.length > 0 && <p className="text-amber-300">First publication could not be verified for your account. Continue managing this course from Course Overview.</p>}</>}{message && <p role="alert" className="text-red-300">{message}</p>}</div>;
}
