'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import CourseConfigurationMap from '@/components/CourseConfigurationMap';
import { supabaseBrowser } from '@/lib/supabase-browser';
export type Layout = { id: string; name: string | null; description: string | null; hole_count: number | null; par_total: number | null; length_total: number | null; walk_length: number | null; difficulty: number | null; color: string | null; is_default: boolean | null; par_rating: number | null };

type Selection={selected:string;setSelected:(id:string)=>void};
const LayoutContext=createContext<Selection|null>(null);
export function PublicLayoutProvider({layouts,children}:{layouts:Layout[];children:ReactNode}){
 const [selected,setSelected]=useState(()=>layouts.find(l=>l.is_default)?.id??layouts[0]?.id??'');
 return <LayoutContext.Provider value={{selected,setSelected}}>{children}</LayoutContext.Provider>;
}
export function PublicCourseMap({courseId}:{courseId:string}){
 const {selected}=useContext(LayoutContext)!;
 return selected?<CourseConfigurationMap courseId={courseId} layoutId={selected} preview/>:<p className="p-4 text-sm text-gray-400">No public layout available.</p>;
}
function meaningfulNumber(value:number|null|undefined){return value!=null&&Number.isFinite(value)&&value>0;}
export function PublicCourseLayouts({layouts,courseId}:{layouts:Layout[];courseId:string}){
 const {selected,setSelected}=useContext(LayoutContext)!;
 return <>                {layouts.length > 0 && <section>
                    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-blue-300">Play</p><h2 className="mt-2 text-2xl font-bold text-white">Course layouts</h2></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {layouts.map((layout) => <button type="button" key={layout.id} aria-pressed={selected===layout.id} onClick={()=>setSelected(layout.id)} className={`group relative overflow-hidden rounded-2xl p-5 text-left transition hover:bg-white/[0.08] ${selected===layout.id?"bg-blue-500/10 ring-2 ring-blue-400":"bg-white/[0.055]"}`}>
                            <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: layout.color ?? "#2D6CDF" }} />
                            <div className="flex items-start justify-between gap-4"><div>
                                <h3 className="text-lg font-bold text-white">{layout.name?.trim() || "Course layout"}</h3>
                                {layout.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-400">{layout.description}</p>}
                            </div>{layout.is_default && <span className="shrink-0 rounded-full bg-blue-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-300">Default</span>}</div>
                            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-300">
                                {meaningfulNumber(layout.hole_count) && <span>{layout.hole_count} holes</span>}
                                {meaningfulNumber(layout.par_total) && <span>Par {layout.par_total}</span>}
                                {meaningfulNumber(layout.length_total) && <span>{layout.length_total} m</span>}
                                {meaningfulNumber(layout.walk_length) && <span>{layout.walk_length} m walk</span>}
                                {meaningfulNumber(layout.par_rating) && <span>Rating {layout.par_rating}</span>}
                            </div>
                        </button>)}
                    </div>
                    <HoleOverview layoutId={selected} />
                    <div className="mt-6 overflow-hidden rounded-2xl border border-white/10"><PublicCourseMap courseId={courseId} /></div>
                </section>}</>;
}
type Hole={hole_id:string;number:number;order_index:number;par:number|null;distance:number|null};
function HoleOverview({layoutId}:{layoutId:string}){
 const [result,setResult]=useState<{id:string;holes:Hole[];error:boolean}|null>(null);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   try{
    const {data,error}=await supabaseBrowser.rpc('get_public_layout_holes_v1',{p_layout_id:layoutId});
    if(active)setResult({id:layoutId,holes:!error&&Array.isArray(data)?data:[],error:!!error||!Array.isArray(data)});
   }catch{if(active)setResult({id:layoutId,holes:[],error:true});}
  })();
  return()=>{active=false;};
 },[layoutId]);
 return <div className="mt-6"><h3 className="mb-3 text-lg font-bold text-white">Hole overview</h3>
 {result?.id!==layoutId?<p className="text-sm text-gray-400">Loading holes...</p>:result.error?<p role="alert" className="text-sm text-amber-200">Hole overview is currently unavailable.</p>:!result.holes.length?<p className="text-sm text-gray-400">No holes in this layout.</p>:<div className="space-y-3">{Array.from({length:Math.ceil(result.holes.length/9)},(_,section)=>{
 const holes=[...result.holes].sort((a,b)=>a.order_index-b.order_index).slice(section*9,section*9+9);
 return <div key={section} className="overflow-x-auto rounded-xl border border-white/10">
  <table className="w-full border-collapse text-center text-sm tabular-nums" style={{minWidth:64+holes.length*44}}>
   <caption className="bg-white/[0.04] px-3 py-2 text-left text-xs font-semibold text-gray-400">Holes {holes[0].number}{holes.length>1 ? ' - '+holes[holes.length-1].number : ''}</caption>
   <thead className="bg-blue-500/10 text-white"><tr><th scope="col" className="sticky left-0 bg-[#182436] px-3 py-2 text-left text-xs font-medium text-gray-300">Hole</th>{holes.map(h=><th key={h.order_index} scope="col" className="px-2 py-2 font-bold">{h.number}</th>)}</tr></thead>
   <tbody className="divide-y divide-white/5 bg-white/[0.025] text-gray-200">
    <tr><th scope="row" className="sticky left-0 bg-[#171e2a] px-3 py-2 text-left text-xs font-medium text-gray-400">Par</th>{holes.map(h=><td key={h.order_index} className="px-2 py-2">{h.par??'N/A'}</td>)}</tr>
    <tr><th scope="row" className="sticky left-0 bg-[#171e2a] px-3 py-2 text-left text-xs font-medium text-gray-400">Meters</th>{holes.map(h=><td key={h.order_index} className="px-2 py-2">{h.distance??'N/A'}</td>)}</tr>
   </tbody>
  </table>
 </div>;
})}</div>}

 </div>;
}
