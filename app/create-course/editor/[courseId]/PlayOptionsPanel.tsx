'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useCourseEditor } from '@/state/useCourseEditor';

import { configurationName } from './alternateHole';

const label = (name: string | null) => !name || name === 'Primary' ? 'Main' : name;
export default function PlayOptionsPanel() {
 const course = useCourseEditor(s => s.course);
 const holeId = useCourseEditor(s => s.selectedHoleId);
 const [data, setData] = useState<any>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [editing,setEditing] = useState<any>(null);
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
 useEffect(() => {
  const reload = () => { void refresh().catch(e => setError(e.message || 'Could not refresh configurations.')); };
  window.addEventListener('hole-alternate-saved', reload);
  return () => window.removeEventListener('hole-alternate-saved', reload);
 // Refresh depends only on the current course; no editor state is changed.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [course?.id]);
 async function run(action: () => Promise<void>) {
  if (busy) return;
  setBusy(true); setError('');
  try { await action(); } catch (e: any) { setError(e.message?.includes('VARIATION_USED_BY_LAYOUT') || e.code === '23503'
   ? 'This variation is used by a layout. Select another variation in that layout before removing it.' : e.message || 'Could not save.'); } finally { setBusy(false); }
 }
 async function select(id: string) {
  const result = await supabaseBrowser.rpc('resolve_hole_play_config_v1', { p_hole_id: holeId, p_preview_config_id: id });
  if (result.error) throw result.error;
  if (useCourseEditor.getState().selectedHoleId !== holeId) return;
  setEditing(null);
  useCourseEditor.setState(s => ({ course: { ...s.course, holes: s.course.holes.map((h: any) => h.id === holeId
   ? { ...h, ...result.data, hole_features: result.data.features } : h) }, mode: 'none', featureTool: null, selectedFeatureId: null, drawingCoordinates: [] }));
 }
 const button = 'min-h-11 w-full rounded bg-slate-700 px-3 py-2 text-left text-sm disabled:opacity-40';
 if (!hole) return null;
 return <div className="space-y-4 p-3 text-slate-100">
  {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  {!data && <button className={button} onClick={() => void run(async () => { await refresh(); })}>Load hole variations</button>}
  {data && <>
   <section className="space-y-2"><h3 className="font-bold">HOLE VARIATIONS</h3>
    <label htmlFor="hole-variation" className="block text-sm">Select Variation</label>
    <select id="hole-variation" aria-label="Select Variation" disabled={busy} value={hole.play_config_id || ''} className="min-h-11 w-full rounded bg-slate-800 p-2 text-sm"
     onChange={e => { const id = e.target.value; if (window.confirm('Switch variation? Save current map changes first; unsaved changes will be discarded.')) void run(() => select(id)); }}>
     {data.configs.filter((c: any) => c.hole_id === holeId).map((c: any) => <option key={c.id} value={c.id}>
      {configurationName(c, hole.number)}
      {c.id !== current?.id ? ` · ${c.distance} m · Par ${c.par}` : ''}
     </option>)}
    </select>
    <p className="px-2 text-sm text-slate-300">{hole.distance ?? current?.distance ?? 0} m · Par {hole.par ?? 3}</p>
    <details className="rounded border border-white/10 p-2 text-sm"><summary className="min-h-8 cursor-pointer">Edit par</summary>
    <label className="flex items-center justify-between gap-3 py-2">Par<input disabled={busy} type="number" min={1} max={10} value={hole.par ?? 3} className="ml-2 w-16 rounded bg-slate-800 p-2"
     onChange={e => { const par = Number(e.target.value); useCourseEditor.setState(s => ({ course: { ...s.course, holes: s.course.holes.map((h: any) => h.id === holeId ? { ...h, par } : h) } })); }} /></label></details>
   </section>
   {current && <details className="rounded border border-white/10 p-2 text-sm"><summary className="min-h-11 cursor-pointer py-2">Configuration details</summary>
    <button disabled={busy} className={button} onClick={() => setEditing({ ...current })}>Edit tee, basket, par and distance</button>
    {editing && <div className="space-y-2 py-2">
     {!current.is_default && (['tee','basket'] as const).map(kind => <label key={kind} className="block">Select {kind}
      <select aria-label={`Variation ${kind}`} value={editing[`${kind}_id`]} disabled={busy} className="min-h-11 w-full rounded bg-slate-800 p-2" onChange={e => setEditing({ ...editing, [`${kind}_id`]: e.target.value })}>
       {data[kind === 'tee' ? 'tees' : 'baskets'].map((o: any) => <option key={o.id} value={o.id}>{label(o.label)} · Used by holes {[...new Set(o.usage.map((u: any) => u.number))].join(', ') || 'none'}</option>)}
      </select></label>)}
     <label className="block">Par<input aria-label="Variation par" type="number" min={1} max={10} value={editing.par} disabled={busy} onChange={e => setEditing({ ...editing, par: Number(e.target.value) })} className="min-h-11 w-full rounded bg-slate-800 p-2" /></label>
     <label className="block">Distance (m)<input aria-label="Variation distance" type="number" min={0} max={10000} value={editing.distance} disabled={busy} onChange={e => setEditing({ ...editing, distance: Number(e.target.value) })} className="min-h-11 w-full rounded bg-slate-800 p-2" /></label>
     <button disabled={busy} className={button} onClick={() => void run(async () => {
      const result = await supabaseBrowser.rpc('save_hole_variant_draft_v5', { p_hole_id: holeId, p_config: { ...editing, label: label(editing.label) }, p_tee: null, p_basket: null });
      if (result.error) throw result.error; await refresh(); await select(current.id); setEditing(null);
     })}>Save</button><button disabled={busy} className={button} onClick={() => setEditing(null)}>Cancel</button>
    </div>}
    {!current.is_default && <button disabled={busy} className={button} onClick={() => {
     if (!window.confirm('Remove Variation? Physical tees and baskets remain available. Played rounds keep their history.')) return;
     void run(async () => { const result = await supabaseBrowser.rpc('remove_hole_variation_v5', { p_config_id: current.id });
      if (result.error) throw result.error; const next = await refresh(); await select(next.configs.find((c: any) => c.hole_id === holeId && c.is_default).id); setEditing(null);
     });
    }}>Remove Variation</button>}
   </details>}
   {(['tee','basket'] as const).map(kind => <section key={kind} className="space-y-2"><h3 className="font-bold">{kind === 'tee' ? 'TEE' : 'BASKET'}</h3>
    {data[kind === 'tee' ? 'tees' : 'baskets'].filter((object: any) => object.id === current?.[kind === 'tee' ? 'tee_id' : 'basket_id']).map((object: any) => <div key={object.id} className="relative rounded border border-white/10 p-2 text-sm"><p className="pr-11">{label(object.label)}</p>
     <p className="pr-11 text-xs text-slate-400">Used by holes {[...new Set(object.usage.map((u: any) => u.number))].join(', ') || 'none'}</p>
     <details><summary aria-label={`Manage ${kind} ${label(object.label)}`} className="absolute right-0 top-0 min-h-11 w-11 cursor-pointer list-none py-2 text-center">⋯</summary>
     <button disabled={busy} className={button} onClick={() => {
      const next = window.prompt('Name (maximum 40 characters)', label(object.label));
      if (next == null) return;
      if (object.usage.length > 1 && !window.confirm(`Rename shared ${kind} "${label(object.label)}"? Used by holes ${[...new Set(object.usage.map((u: any) => u.number))].join(', ')}. The new name will appear everywhere this ${kind} is used.`)) return;
      void run(async () => { const result = await supabaseBrowser.rpc('save_course_physical_object_v5', { p_course_id: course.id, p_kind: kind, p_id: object.id, p_label: next,
       p_lat: object.latitude, p_lon: object.longitude, p_elevation: object.elevation }); if (result.error) throw result.error; await refresh(); });
     }}>Rename</button>
     <button disabled={busy} className={button} onClick={() => {
      if (!window.confirm(`Move ${label(object.label)} to the current map ${kind} position? Used by holes ${[...new Set(object.usage.map((u: any) => u.number))].join(', ')}. This affects every variation using it. Played rounds remain unchanged.`)) return;
      void run(async () => { const result = await supabaseBrowser.rpc('save_course_physical_object_v5', {
       p_course_id: course.id, p_kind: kind, p_id: object.id, p_label: label(object.label),
       p_lat: hole[`${kind}_latitude`], p_lon: hole[`${kind}_longitude`], p_elevation: hole[`${kind}_elevation`], p_confirm_shared: true,
      }); if (result.error) throw result.error; await refresh(); if (current) await select(current.id); });
     }}>Move on map</button>
    </details></div>)}
   </section>)}
   <details className="space-y-2 rounded border border-white/10 p-2"><summary className="min-h-11 cursor-pointer py-2 text-sm">Manage feature sharing</summary><p className="text-xs text-slate-400">Link existing course features to this variation. Shared geometry stays linked.</p>
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
