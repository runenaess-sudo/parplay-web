'use client';
import { useRef, useState } from 'react';
import { supabaseBrowser as db } from '@/lib/supabase-browser';
import { calculateHoleLength } from '@/utils/holeLength';
import { MapCanvas } from './MapCanvas';
import { configurationName, matchingConfiguration, pointName, sortedPoints, type Configuration, type PhysicalPoint } from './alternateHole';

type Data = { tees: PhysicalPoint[]; baskets: PhysicalPoint[]; configs: Configuration[] };
const noop = () => {};
export default function AddAlternateHole({ courseId, holeId, number }: { courseId: string; holeId: string; number: number }) {
 const dialog = useRef<HTMLDialogElement>(null);
 const lock = useRef(false);
 const requestId = useRef<string | null>(null);
 const [submitted,setSubmitted] = useState(false);
 const [data,setData] = useState<Data | null>(null);
 const [teeId,setTee] = useState('');
 const [basketId,setBasket] = useState('');
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 const [saved,setSaved] = useState('');
 const tee=data?.tees.find(p=>p.id===teeId);
 const basket=data?.baskets.find(p=>p.id===basketId);
 async function read() {
  const result=await db.rpc('get_course_variant_editor_v5',{p_course_id:courseId});
  if(result.error) throw result.error;
  return result.data as Data;
 }
 async function open() {
  if(lock.current) return;
  lock.current=true;setBusy(true);setError('');setSaved('');setData(null);setTee('');setBasket('');requestId.current=null;setSubmitted(false);
  dialog.current?.showModal();
  try { setData(await read()); } catch(e) { setError(e instanceof Error ? e.message : (e as {message?:string}).message || 'Could not load physical points. Close and try again.'); }
  finally {lock.current=false;setBusy(false);}
 }
 async function save() {
  if(lock.current || saved || !tee || !basket) return;
  lock.current=true;setBusy(true);setError('');
  try {
   if(![tee.latitude,tee.longitude,basket.latitude,basket.longitude].every(v=>typeof v==='number' && Number.isFinite(v))) throw new Error('Both points need valid saved coordinates.');
   // Fresh authorized read catches combinations created since this panel opened.
   const fresh=await read();
   const existing=matchingConfiguration(fresh.configs,holeId,teeId,basketId);
   if(existing && existing.id!==requestId.current) throw new Error('This tee/basket combination already exists: '+configurationName(existing,number));
   if(existing) {
    setSaved(configurationName(existing,number));setData(fresh);
   } else {
    const main=fresh.configs.find(c=>c.hole_id===holeId && c.is_default);
    if(!main) throw new Error('Save the main hole before adding an alternate.');
    requestId.current ??= crypto.randomUUID();
    setSubmitted(true);
    const result=await db.rpc('save_hole_variant_draft_v5',{
     p_hole_id:holeId,
     p_config:{id:requestId.current,tee_id:teeId,basket_id:basketId,label:((tee.label || 'Tee')+' ? '+(basket.label || 'Basket')).slice(0,40),par:main.par,
      distance:Math.round(calculateHoleLength([[tee.longitude,tee.latitude],[basket.longitude,basket.latitude]])),fairway:[],tee_angle:main.tee_angle},
     p_tee:null,p_basket:null,
    });
    if(result.error) throw result.error;
    // The write succeeded even if the follow-up read fails. Never offer a second insert.
    setSaved('Alternate saved');
    try { const latest=await read();setData(latest);const created=latest.configs.find(c=>c.id===requestId.current);if(created)setSaved(configurationName(created,number)); }
    catch {setError('Saved, but the server label could not be refreshed. Close and reload the configurations.');}
   }
   window.dispatchEvent(new Event('hole-alternate-saved'));
  } catch(e) { setError(e instanceof Error ? e.message : (e as {message?:string}).message || 'Could not save. Retry uses the same configuration ID.'); }
  finally {lock.current=false;setBusy(false);}
 }
 const preview={id:courseId,holes:[{id:holeId,number,tee_latitude:tee?.latitude,tee_longitude:tee?.longitude,basket_latitude:basket?.latitude,basket_longitude:basket?.longitude,fairway:[],hole_features:[]}]};
 return <>
  <button type="button" onClick={()=>void open()} className="min-h-11 w-full rounded-lg border border-cyan-400/40 bg-cyan-950 px-3 py-2 text-sm font-semibold text-cyan-100">+ Add Alternate Hole</button>
  <dialog ref={dialog} onCancel={e=>{if(lock.current)e.preventDefault();}} onKeyDown={e=>e.stopPropagation()} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl border border-slate-600 bg-slate-950 p-4 text-slate-100 backdrop:bg-black/70">
   <h2 className="text-lg font-bold">Add Alternate Hole — Hole {number}</h2>
   <p className="my-2 text-sm text-slate-300">Reuse existing course points. This preview does not change your current map edits. The server assigns the alternate letter when numbering is available.</p>
   {error && <p role="alert" className="my-2 text-sm text-red-300">{error}</p>}
   {saved && <p role="status" className="my-2 text-emerald-300">Saved: {saved}. Select it in the editor when ready; your previous map edits are still intact.</p>}
   {busy && !data && <p>Loading course points…</p>}
   {data && <>
    <div className="grid gap-3 sm:grid-cols-2">{(['tee','basket'] as const).map(kind=><label key={kind} className="text-sm">Select {kind==='tee'?'Tee':'Basket'}
     <select disabled={busy || !!saved || submitted} value={kind==='tee'?teeId:basketId} onChange={e=>(kind==='tee'?setTee:setBasket)(e.target.value)} className="mt-1 min-h-11 w-full rounded bg-slate-800 p-2">
      <option value="">Select {kind}</option>{sortedPoints(data[kind==='tee'?'tees':'baskets'],holeId).map(p=><option value={p.id} key={p.id}>{pointName(p)}</option>)}
     </select></label>)}</div>
    <div className="relative my-3 h-72 overflow-hidden rounded-lg border border-slate-700" aria-label="Alternate hole preview">
     <MapCanvas key={teeId+':'+basketId} readOnly course={preview} selectedHoleId={holeId} mode="none" featureTool={null} drawingCoordinates={[]} selectedFeatureId={null}
      onSetTee={noop} onSetBasket={noop} onAddFairwayPoint={noop} onMoveFairwayPoint={noop} onSetFairwayPointWidth={noop} onRemoveFairwayPoint={noop} onSetTeeAngle={noop} onAddFeatureCoordinate={noop} onSelectFeature={noop} onSelectWeakFeature={noop} onMoveFeatureVertex={noop}/>
    </div>
   </>}
   <div className="flex justify-end gap-2">
    <button disabled={busy} onClick={()=>dialog.current?.close()} className="min-h-11 rounded bg-slate-700 px-4 disabled:opacity-40">{saved?'Close':'Cancel'}</button>
    <button disabled={busy || !!saved || !tee || !basket} onClick={()=>void save()} className="min-h-11 rounded bg-cyan-700 px-4 disabled:opacity-40">{busy?'Saving…':'Save Alternate'}</button>
   </div>
  </dialog>
 </>;
}
