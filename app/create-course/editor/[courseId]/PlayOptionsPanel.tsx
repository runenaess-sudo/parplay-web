'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useCourseEditor } from '@/state/useCourseEditor';
import { calculateHoleLength } from '@/utils/holeLength';

const label = (name: string | null) => !name || name === 'Primary' ? 'Main' : name;
export default function PlayOptionsPanel() {
 const course = useCourseEditor(s => s.course);
 const holeId = useCourseEditor(s => s.selectedHoleId);
 const [data, setData] = useState<any>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [name, setName] = useState('');
 const [existingBasket, setExistingBasket] = useState('');
 const [adding, setAdding] = useState<'choose' | 'tee' | 'basket' | 'shared' | null>(null);
 const requestIds = useRef<{ physical: string; config: string } | null>(null);
 function closeAdd() { setAdding(null); setName(''); setExistingBasket(''); requestIds.current = null; }
 const hole = course?.holes.find((h: any) => h.id === holeId);
 const current = data?.configs.find((c: any) => c.id === hole?.play_config_id);
 async function refresh() {
  const result = await supabaseBrowser.rpc('get_course_variant_editor_v5', { p_course_id: course.id });
  if (result.error) throw result.error;
  setData(result.data); return result.data;
 }
 useEffect(() => {
  let active = true;
  if (course?.id) void supabaseBrowser.rpc('get_course_variant_editor_v5', { p_course_id: course.id }).then(result => {
   if (!active) return;
   if (result.error) setError(result.error.message); else { setData(result.data); setError(''); }
  });
  return () => { active = false; };
 }, [course?.id, holeId, hole?.play_config_id]);
 async function run(action: () => Promise<void>) {
  if (busy) return;
  setBusy(true); setError('');
  try { await action(); } catch (e: any) { setError(e.message || 'Could not save.'); } finally { setBusy(false); }
 }
 async function select(id: string) {
  const result = await supabaseBrowser.rpc('resolve_hole_play_config_v1', { p_hole_id: holeId, p_preview_config_id: id });
  if (result.error) throw result.error;
  if (useCourseEditor.getState().selectedHoleId !== holeId) return;
  useCourseEditor.setState(s => ({ course: { ...s.course, holes: s.course.holes.map((h: any) => h.id === holeId
   ? { ...h, ...result.data, hole_features: result.data.features } : h) }, mode: 'none', featureTool: null, selectedFeatureId: null, drawingCoordinates: [] }));
 }
 async function add(kind: 'tee' | 'basket' | 'shared') {
  if (!current) throw new Error('Save Main first.');
  requestIds.current ??= { physical: crypto.randomUUID(), config: crypto.randomUUID() };
  if (kind !== 'shared' && !name.trim()) throw new Error('Enter a name first.');
  let tee = data.tees.find((t: any) => t.id === current.tee_id);
  let basket = data.baskets.find((b: any) => b.id === (kind === 'shared' ? existingBasket : current.basket_id));
  let physical = null;
  if (kind !== 'shared') {
   physical = { id: requestIds.current.physical, label: name.trim(), latitude: hole[`${kind}_latitude`], longitude: hole[`${kind}_longitude`], elevation: hole[`${kind}_elevation`] };
   if (kind === 'tee') tee = physical; else basket = physical;
  }
  if (!tee || !basket || tee.latitude == null || tee.longitude == null || basket.latitude == null || basket.longitude == null) throw new Error('Set positions on the map first.');
  const id = requestIds.current.config;
  const result = await supabaseBrowser.rpc('save_hole_variant_draft_v5', {
   p_hole_id: holeId, p_config: { id, tee_id: tee.id, basket_id: basket.id, label: `${label(tee.label)} → ${label(basket.label)}`.slice(0,40), par: current.par,
    distance: Math.round(calculateHoleLength([[tee.longitude,tee.latitude],[basket.longitude,basket.latitude]])), fairway: [], tee_angle: current.tee_angle },
   p_tee: kind === 'tee' ? physical : null, p_basket: kind === 'basket' ? physical : null,
  });
  if (result.error) throw result.error;
  await refresh(); await select(id); closeAdd();
 }
 const button = 'min-h-11 w-full rounded bg-slate-700 px-3 py-2 text-left text-sm disabled:opacity-40';
 if (!hole) return null;
 return <div className="space-y-4 p-3 text-slate-100">
  {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  {!data && <button className={button} onClick={() => void run(async () => { await refresh(); })}>Load play options</button>}
  {data && <>
   <section className="space-y-2"><h3 className="font-bold">PLAY OPTIONS</h3>
    <select aria-label="Play option" disabled={busy} value={hole.play_config_id || ''} className="min-h-11 w-full rounded bg-slate-800 p-2 text-sm"
     onChange={e => { const id = e.target.value; if (window.confirm('Switch play option? Save current map changes first; unsaved changes will be discarded.')) void run(() => select(id)); }}>
     {data.configs.filter((c: any) => c.hole_id === holeId).map((c: any) => <option key={c.id} value={c.id}>
      {label(data.tees.find((t: any) => t.id === c.tee_id)?.label)} → {label(data.baskets.find((b: any) => b.id === c.basket_id)?.label)}
      {c.id !== current?.id ? ` · ${c.distance} m · Par ${c.par}` : ''}
     </option>)}
    </select>
    <p className="px-2 text-sm text-slate-300">{hole.distance ?? current?.distance ?? 0} m · Par {hole.par ?? 3}</p>
    <details className="rounded border border-white/10 p-2 text-sm"><summary className="min-h-8 cursor-pointer">Edit par</summary>
    <label className="flex items-center justify-between gap-3 py-2">Par<input disabled={busy} type="number" min={1} max={10} value={hole.par ?? 3} className="ml-2 w-16 rounded bg-slate-800 p-2"
     onChange={e => { const par = Number(e.target.value); useCourseEditor.setState(s => ({ course: { ...s.course, holes: s.course.holes.map((h: any) => h.id === holeId ? { ...h, par } : h) } })); }} /></label></details>
   </section>
   <button disabled={busy || !current} className={button} onClick={() => { closeAdd(); setAdding('choose'); }}>+ Add play option</button>
   {adding && <section aria-label="Add play option" className="space-y-2 rounded-xl border border-white/20 bg-slate-900/80 p-3">
    {adding === 'choose' ? <>
     <button className={button} onClick={() => setAdding('tee')}>New tee</button>
     <button className={button} onClick={() => setAdding('basket')}>New basket</button>
     <button className={button} onClick={() => setAdding('shared')}>Use existing basket</button>
    </> : adding === 'shared' ? <>
     <label className="block text-sm">Course baskets<select aria-label="Existing basket" disabled={busy} value={existingBasket} onChange={e => setExistingBasket(e.target.value)} className="mt-2 min-h-11 w-full rounded bg-slate-800 p-2 text-sm">
      <option value="">Select basket</option>{data.baskets.map((b: any) => <option key={b.id} value={b.id}>{label(b.label)} · Holes {[...new Set(b.usage.map((u: any) => u.number))].join(', ') || 'none'} · {b.usage.length} play options</option>)}
     </select></label>
     <button disabled={busy || !existingBasket} className={button} onClick={() => void run(() => add('shared'))}>USE BASKET</button>
    </> : <>
     <p className="text-xs text-slate-300">Set the {adding} position on the map, then create this option. The current {adding === 'tee' ? 'basket' : 'tee'} is reused.</p>
     <input aria-label={`New ${adding} name`} disabled={busy} placeholder="Name" maxLength={40} value={name} onChange={e => setName(e.target.value)} className="min-h-11 w-full rounded bg-slate-800 p-2 text-sm" />
     <button disabled={busy || !name.trim()} className={button} onClick={() => void run(() => add(adding))}>Create play option</button>
    </>}
    <button disabled={busy} className={button} onClick={closeAdd}>Cancel</button>
   </section>}
   {(['tee','basket'] as const).map(kind => <section key={kind} className="space-y-2"><h3 className="font-bold">{kind === 'tee' ? 'TEES' : 'BASKETS'}</h3>
    {data[kind === 'tee' ? 'tees' : 'baskets'].filter((object: any) => object.id === current?.[kind === 'tee' ? 'tee_id' : 'basket_id']).map((object: any) => <details key={object.id} className="rounded border border-white/10 p-2 text-sm"><summary className="min-h-11 cursor-pointer break-words py-2">{label(object.label)} <span className="text-xs text-slate-400">· Current option · Manage</span></summary>
     <p className="text-xs text-slate-400">Used by holes {[...new Set(object.usage.map((u: any) => u.number))].join(', ') || 'none'}</p>
     <button disabled={busy} className={button} onClick={() => {
      const next = window.prompt('Name (maximum 40 characters)', label(object.label));
      if (next == null) return;
      void run(async () => { const result = await supabaseBrowser.rpc('save_course_physical_object_v5', { p_course_id: course.id, p_kind: kind, p_id: object.id, p_label: next,
       p_lat: object.latitude, p_lon: object.longitude, p_elevation: object.elevation }); if (result.error) throw result.error; await refresh(); });
     }}>Rename</button>
     <button disabled={busy} className={button} onClick={() => {
      if (!window.confirm(`Move ${label(object.label)} to the current map ${kind} position? This affects all ${object.usage.length} current play options using it. Played rounds remain unchanged.`)) return;
      void run(async () => { const result = await supabaseBrowser.rpc('save_course_physical_object_v5', {
       p_course_id: course.id, p_kind: kind, p_id: object.id, p_label: label(object.label),
       p_lat: hole[`${kind}_latitude`], p_lon: hole[`${kind}_longitude`], p_elevation: hole[`${kind}_elevation`], p_confirm_shared: true,
      }); if (result.error) throw result.error; await refresh(); if (current) await select(current.id); });
     }}>Move to map position</button>
    </details>)}
    <button disabled={busy || !current} className={button} onClick={() => { closeAdd(); setAdding(kind); }}>+ Add {kind}</button>
    {kind === 'basket' && <button disabled={busy || !current} className={button} onClick={() => { closeAdd(); setAdding('shared'); }}>Use existing basket</button>}
   </section>)}
   <details className="space-y-2 rounded border border-white/10 p-2"><summary className="min-h-11 cursor-pointer py-2 text-sm">Manage feature sharing</summary><p className="text-xs text-slate-400">Link existing course features to this play option. Shared geometry stays linked.</p>
    {data.features.filter((f: any) => f.explicit && hole.hole_features?.some((x: any) => x.id === f.id)).map((f: any) => <button key={f.id} disabled={busy || !current} className={button} onClick={() => void run(async () => {
     const result = await supabaseBrowser.rpc('set_play_config_feature_link_v5', { p_feature_id: f.id, p_config_id: current.id, p_linked: false });
     if (result.error) throw result.error; await refresh(); await select(current.id);
    })}>Remove {f.feature_type} from this option</button>)}
    {data.features.filter((f: any) => !hole.hole_features?.some((x: any) => x.id === f.id)).map((f: any) => <button key={f.id} disabled={busy || !current} className={button} onClick={() => void run(async () => {
     const result = await supabaseBrowser.rpc('set_play_config_feature_link_v5', { p_feature_id: f.id, p_config_id: current.id, p_linked: true });
     if (result.error) throw result.error; await refresh(); await select(current.id);
    })}>+ {f.feature_type} {f.description || ''}</button>)}
   </details>
  </>}
 </div>;
}
