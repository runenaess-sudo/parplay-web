'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { physicalMarkers, type MarkerConfig, type MarkerPoint } from '@/lib/physicalCourseMarkers';
import type { FairwayCoordinate } from '@/utils/fairwayCorridor';
import { publicCourseCorridors } from '@/lib/publicCourseCorridors';
import PhysicalPointsMap from '../../app/create-course/editor/[courseId]/PhysicalPointsMap';
export default function CourseConfigurationMap({courseId,layoutId,preview=false}:{courseId:string;layoutId?:string;preview?:boolean}) {
 const [result,setResult]=useState<{key:string;data:{tees:MarkerPoint[];baskets:MarkerPoint[];configs:(MarkerConfig & {fairway?:FairwayCoordinate[]})[]}}|null>(null);const [error,setError]=useState('');
 const key=courseId+':'+(layoutId||'course');
 useEffect(()=>{let active=true;void supabaseBrowser.rpc('get_course_configuration_map_v1',{p_course_id:courseId,p_layout_id:layoutId||null}).then(({data,error})=>{if(!active)return;if(error){setError('Configuration map unavailable. The map reader migration may not be installed.');return;}setError('');setResult({key,data});});return()=>{active=false;};},[courseId,layoutId,key]);
 if(error)return <p role="alert" className="p-3 text-sm text-amber-200">{error}</p>;
 if(result?.key!==key)return <p className="p-3 text-sm">Loading configurations...</p>;
 const valid=(lng:unknown,lat:unknown):boolean=>typeof lng==='number' && typeof lat==='number' && Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng)<=180 && Math.abs(lat)<=90;
 const markers=physicalMarkers(result.data).map(marker=>{
  if(marker.kind!=='tee')return marker;
  // The reader already restricts configurations to the selected layout.
  const configs=result.data.configs.filter(c=>c.tee_id===marker.id).sort((a,b)=>Number(Boolean(b.is_default))-Number(Boolean(a.is_default)) || (a.number ?? 0)-(b.number ?? 0) || a.id.localeCompare(b.id));
  for(const config of configs){
   const first=Array.isArray(config.fairway)?config.fairway.find(p=>valid(p.lng,p.lat) && (p.lng!==marker.longitude || p.lat!==marker.latitude)):undefined;
   const basket=result.data.baskets.find(p=>p.id===config.basket_id);
   const lng=first?.lng ?? basket?.longitude,lat=first?.lat ?? basket?.latitude;
   if(!valid(lng,lat) || (lng===marker.longitude && lat===marker.latitude))continue;
   const rad=Math.PI/180,delta=((lng as number)-marker.longitude)*rad,a=marker.latitude*rad,b=(lat as number)*rad;
   const heading=(Math.atan2(Math.sin(delta)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(delta))/rad+360)%360;
   return {...marker,heading};
  }
  return marker;
 });
 return <div><p className="p-2 text-sm text-slate-300">{preview?'Shaded corridors are visual illustrations, not surveyed fairway boundaries.':(layoutId?'Selected layout only. ':'')+'Shaded corridors are visual illustrations, not surveyed fairway boundaries. Shared points retain one identity; click a marker for its configurations.'}</p><div className="h-96"><PhysicalPointsMap key={key} markers={markers} hideBasketLabels preview={preview} publicView={preview} corridors={publicCourseCorridors(result.data)}/></div></div>;
}
