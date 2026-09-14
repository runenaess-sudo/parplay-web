"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type CourseHole = {
    id: string;
    number: number;
    par: number;
    distance: number | null;
};

type InitialLayout = {
    name: string;
    description: string;
    difficulty: number;
    selectedHoleIds: string[];
};

export default function AddLayoutForm({ courseId, holes, clubId, layoutId, initialLayout }: {
    courseId: string;
    holes: CourseHole[];
    clubId: string | null;
    layoutId?: string;
    initialLayout?: InitialLayout;
}) {
    const router = useRouter();
    const editing = Boolean(layoutId);
    const [name, setName] = useState(initialLayout?.name ?? "");
    const [description, setDescription] = useState(initialLayout?.description ?? "");
    const [difficulty, setDifficulty] = useState(initialLayout?.difficulty ?? 3);
    const [selectedHoleIds, setSelectedHoleIds] = useState<string[]>(initialLayout?.selectedHoleIds ?? []);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const holesById = useMemo(() => new Map(holes.map((hole) => [hole.id, hole])), [holes]);
    const selectedHoles = useMemo(
        () => selectedHoleIds.map((id) => holesById.get(id)).filter((hole): hole is CourseHole => Boolean(hole)),
        [holesById, selectedHoleIds],
    );
    const totals = useMemo(() => selectedHoles.reduce((current, hole) => ({
        par: current.par + hole.par,
        distance: current.distance + (hole.distance ?? 0),
    }), { par: 0, distance: 0 }), [selectedHoles]);

    function toggleHole(holeId: string) {
        setSelectedHoleIds((current) => current.includes(holeId)
            ? current.filter((id) => id !== holeId)
            : [...current, holeId]);
    }

    function moveHole(index: number, direction: -1 | 1) {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= selectedHoleIds.length) return;
        setSelectedHoleIds((current) => {
            const next = [...current];
            [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
            return next;
        });
    }

    async function saveLayout(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        const trimmedName = name.trim();
        if (!trimmedName) {
            setError("Layout name is required.");
            return;
        }
        if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
            setError("Difficulty must be between 1 and 5.");
            return;
        }
        if (selectedHoleIds.length === 0) {
            setError("Select at least one hole.");
            return;
        }
        if (new Set(selectedHoleIds).size !== selectedHoleIds.length) {
            setError("A hole can only be included once.");
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const payload = {
                p_course_id: courseId,
                p_name: trimmedName,
                p_description: description.trim() || null,
                p_difficulty: difficulty,
                p_hole_ids: selectedHoleIds,
            };
            const { error: rpcError } = layoutId
                ? await supabaseBrowser.rpc("update_course_layout_v1", { ...payload, p_layout_id: layoutId })
                : await supabaseBrowser.rpc("create_course_layout_v1", payload);
            if (rpcError) {
                setError(rpcError.message || "Layout could not be created.");
                return;
            }
            const query = clubId ? `?clubId=${encodeURIComponent(clubId)}` : "";
            router.push(`/club-manager/courses/${courseId}/layouts${query}`);
            router.refresh();
        } catch {
            setError("Layout could not be created. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    const panelClass = "rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 sm:p-6";
    const inputClass = "mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-gray-500 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15";

    return <form onSubmit={saveLayout} className="mt-6 space-y-5">
        <section className={panelClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Step 1</p>
            <h2 className="mt-1 text-xl font-semibold">Layout details</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-200">
                    Name
                    <input required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Main layout" />
                </label>
                <label className="text-sm font-medium text-gray-200">
                    Difficulty
                    <select value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))} className={inputClass}>
                        {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value} className="bg-gray-950">{value}</option>)}
                    </select>
                </label>
                <label className="text-sm font-medium text-gray-200 sm:col-span-2">
                    Description
                    <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={`${inputClass} resize-y`} placeholder="Optional layout description" />
                </label>
            </div>
        </section>

        <section className={panelClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Step 2</p>
            <h2 className="mt-1 text-xl font-semibold">Choose holes</h2>
            <p className="mt-2 text-sm text-gray-400">Select course holes, then arrange their playing order.</p>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                    <h3 className="text-sm font-semibold text-gray-200">Available course holes</h3>
                    <div className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
                        {holes.map((hole) => {
                            const selected = selectedHoleIds.includes(hole.id);
                            return <button key={hole.id} type="button" onClick={() => toggleHole(hole.id)}
                                aria-pressed={selected}
                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${selected ? "border-blue-400/60 bg-blue-500/15" : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/5"}`}>
                                <span className="font-semibold text-white">Hole {hole.number}</span>
                                <span className="text-xs text-gray-400">Par {hole.par}{hole.distance != null ? ` · ${hole.distance} m` : ""}</span>
                            </button>;
                        })}
                        {holes.length === 0 && <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-gray-400">This course has no holes to add.</p>}
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-gray-200">Layout order</h3>
                    <div className="mt-2 space-y-2">
                        {selectedHoles.map((hole, index) => <div key={hole.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-200">{index + 1}</span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-white">Hole {hole.number}</p>
                                <p className="text-xs text-gray-400">Par {hole.par}{hole.distance != null ? ` · ${hole.distance} m` : ""}</p>
                            </div>
                            <button type="button" onClick={() => moveHole(index, -1)} disabled={index === 0} aria-label={`Move hole ${hole.number} up`} className="rounded-lg border border-white/10 px-2 py-1 text-sm text-gray-200 transition hover:bg-white/10 disabled:opacity-30">↑</button>
                            <button type="button" onClick={() => moveHole(index, 1)} disabled={index === selectedHoles.length - 1} aria-label={`Move hole ${hole.number} down`} className="rounded-lg border border-white/10 px-2 py-1 text-sm text-gray-200 transition hover:bg-white/10 disabled:opacity-30">↓</button>
                            <button type="button" onClick={() => toggleHole(hole.id)} aria-label={`Remove hole ${hole.number}`} className="rounded-lg border border-red-400/20 px-2 py-1 text-sm text-red-200 transition hover:bg-red-500/10">×</button>
                        </div>)}
                        {selectedHoles.length === 0 && <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-gray-400">Select at least one hole.</p>}
                    </div>
                </div>
            </div>
        </section>

        <section className={panelClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Step 3</p>
            <h2 className="mt-1 text-xl font-semibold">Review &amp; save</h2>
            <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm sm:grid-cols-4">
                <div className="sm:col-span-2"><p className="text-xs text-gray-500">Layout</p><p className="mt-1 font-semibold text-white">{name.trim() || "Not named"}</p></div>
                <div><p className="text-xs text-gray-500">Difficulty</p><p className="mt-1 font-semibold text-white">{difficulty}</p></div>
                <div><p className="text-xs text-gray-500">Holes</p><p className="mt-1 font-semibold text-white">{selectedHoles.length}</p></div>
                <div><p className="text-xs text-gray-500">Total par</p><p className="mt-1 font-semibold text-white">{totals.par}</p></div>
                <div><p className="text-xs text-gray-500">Known distance</p><p className="mt-1 font-semibold text-white">{totals.distance} m</p></div>
                <div className="sm:col-span-2"><p className="text-xs text-gray-500">Playing order</p><p className="mt-1 text-gray-200">{selectedHoles.map((hole) => hole.number).join(" → ") || "No holes selected"}</p></div>
            </div>

            {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
            <div className="mt-5 flex justify-end">
                <button type="submit" disabled={saving || holes.length === 0} className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300/50 disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? (editing ? "Saving layout..." : "Creating layout...") : (editing ? "Save Layout" : "Create Layout")}
                </button>
            </div>
        </section>
    </form>;
}
