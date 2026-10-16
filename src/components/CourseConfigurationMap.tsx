'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { physicalMarkers, type MarkerConfig, type MarkerPoint } from '@/lib/physicalCourseMarkers';
import PhysicalPointsMap from '../../app/create-course/editor/[courseId]/PhysicalPointsMap';
export default function CourseConfigurationMap({courseId,layoutId,preview=false}:{courseId:string;layoutId?:string;preview?:boolean}) {
 const [result,setResult]=useState<{key:string;data:{tees:MarkerPoint[];baskets:MarkerPoint[];configs:MarkerConfig[]}}|null>(null);const [error,setError]=useState('');
 const key=courseId+':'+(layoutId||'course');
 useEffect(()=>{let active=true;void supabaseBrowser.rpc('get_course_configuration_map_v1',{p_course_id:courseId,p_layout_id:layoutId||null}).then(({data,error})=>{if(!active)return;if(error){setError('Configuration map unavailable. The map reader migration may not be installed.');return;}setError('');setResult({key,data});});return()=>{active=false;};},[courseId,layoutId,key]);
 if(error)return <p role="alert" className="p-3 text-sm text-amber-200">{error}</p>;
 if(result?.key!==key)return <p className="p-3 text-sm">Loading configurations...</p>;
 const markers=physicalMarkers(result.data);
 return <div><p className="p-2 text-sm text-slate-300">{layoutId?'Selected layout only':'Course configurations'} - B blue, C red. Shared points retain one identity; click a marker for its configurations.</p><div className="h-96"><PhysicalPointsMap key={key} markers={markers} hideBasketLabels preview={preview}/></div></div>;
}
