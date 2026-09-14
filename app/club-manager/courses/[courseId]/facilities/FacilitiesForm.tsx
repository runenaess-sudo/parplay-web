"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type BooleanKey = "toilets" | "water" | "parking" | "kiosk" | "benches" | "trashcans" | "signage" | "dog_friendly" | "lighting" | "wheelchair_friendly";
type TextKey = "terrain" | "surface" | "opening_hours" | "description" | "tee_type" | "basket_type";
export type FacilitiesValue = Record<BooleanKey, boolean> & Record<TextKey, string>;

const toggles: Array<{ key: BooleanKey; label: string; symbol: string }> = [
    { key: "toilets", label: "Toilets", symbol: "WC" }, { key: "water", label: "Drinking water", symbol: "H₂O" },
    { key: "parking", label: "Parking", symbol: "P" }, { key: "kiosk", label: "Kiosk / Pro shop", symbol: "SHOP" },
    { key: "benches", label: "Benches", symbol: "SEAT" }, { key: "trashcans", label: "Trash cans", symbol: "BIN" },
    { key: "signage", label: "Signage / Course map", symbol: "MAP" }, { key: "dog_friendly", label: "Dog friendly", symbol: "DOG" },
    { key: "lighting", label: "Lighting", symbol: "LUX" }, { key: "wheelchair_friendly", label: "Wheelchair friendly", symbol: "ACCESS" },
];
const fields: Array<{ key: TextKey; label: string; placeholder: string; multiline?: boolean }> = [
    { key: "terrain", label: "Terrain", placeholder: "Forest, park, open, mixed…" },
    { key: "surface", label: "Surface", placeholder: "Grass, gravel, woodland…" },
    { key: "tee_type", label: "Tee type", placeholder: "Turf, rubber, concrete…" },
    { key: "basket_type", label: "Basket type", placeholder: "Manufacturer or basket model…" },
    { key: "opening_hours", label: "Opening hours", placeholder: "For example 08:00–22:00" },
    { key: "description", label: "Additional information", placeholder: "Anything visitors should know about the facilities", multiline: true },
];

export default function FacilitiesForm({ courseId, initialValue }: { courseId: string; initialValue: FacilitiesValue }) {
    const [value, setValue] = useState(initialValue);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    function toggle(key: BooleanKey) { setValue((current) => ({ ...current, [key]: !current[key] })); setSaved(false); }
    function text(key: TextKey, next: string) { setValue((current) => ({ ...current, [key]: next })); setSaved(false); }
    async function save() {
        if (saving) return;
        setSaving(true); setError(null); setSaved(false);
        const { error: saveError } = await supabaseBrowser.rpc("upsert_course_facilities_v1", {
            p_course_id: courseId,
            p_toilets: value.toilets, p_water: value.water, p_parking: value.parking, p_kiosk: value.kiosk,
            p_benches: value.benches, p_trashcans: value.trashcans, p_signage: value.signage,
            p_dog_friendly: value.dog_friendly, p_lighting: value.lighting, p_wheelchair_friendly: value.wheelchair_friendly,
            p_terrain: value.terrain, p_surface: value.surface, p_opening_hours: value.opening_hours,
            p_description: value.description, p_tee_type: value.tee_type, p_basket_type: value.basket_type,
        });
        if (saveError) setError("Facilities could not be saved. Your changes are still here.");
        else setSaved(true);
        setSaving(false);
    }

    return <div className="mt-6 space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20"><div><h2 className="text-lg font-semibold">Available facilities</h2><p className="mt-1 text-sm text-gray-400">Select everything visitors can expect at the course.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{toggles.map((item) => <button key={item.key} type="button" role="switch" aria-checked={value[item.key]} onClick={() => toggle(item.key)} className={`flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-300/40 ${value[item.key] ? "border-blue-400/50 bg-blue-500/15" : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"}`}><span className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-[10px] font-black tracking-wide ${value[item.key] ? "bg-blue-500 text-white" : "bg-white/10 text-gray-400"}`}>{item.symbol}</span><span className="flex-1 text-sm font-semibold">{item.label}</span><span className={`h-5 w-9 rounded-full p-0.5 transition ${value[item.key] ? "bg-blue-500" : "bg-white/15"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${value[item.key] ? "translate-x-4" : ""}`} /></span></button>)}</div></section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20"><h2 className="text-lg font-semibold">Course conditions &amp; information</h2><p className="mt-1 text-sm text-gray-400">These fields are free text, matching the current course model.</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map((field) => <label key={field.key} className={field.multiline ? "sm:col-span-2" : ""}><span className="text-sm font-semibold text-gray-300">{field.label}</span>{field.multiline ? <textarea value={value[field.key]} onChange={(event) => text(field.key, event.target.value)} rows={5} placeholder={field.placeholder} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/15" /> : <input value={value[field.key]} onChange={(event) => text(field.key, event.target.value)} placeholder={field.placeholder} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/15" />}</label>)}</div></section>
        <section className="sticky bottom-4 rounded-2xl border border-white/10 bg-[#10131a]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur"><div className="flex flex-wrap items-center justify-between gap-3"><div>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}{saved && <p role="status" className="text-sm text-emerald-300">Facilities saved.</p>}{!error && !saved && <p className="text-sm text-gray-500">Save to update the public course information.</p>}</div><button type="button" onClick={save} disabled={saving} className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300/50 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving…" : "Save facilities"}</button></div></section>
    </div>;
}
