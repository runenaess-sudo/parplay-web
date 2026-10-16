'use client';
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { PhysicalMarker } from '@/lib/physicalCourseMarkers';
export default function PhysicalPointsMap({markers,onPlace}:{markers:PhysicalMarker[];onPlace?:(lng:number,lat:number)=>void}) {
 const container=useRef<HTMLDivElement>(null);const map=useRef<mapboxgl.Map|null>(null);const place=useRef(onPlace);const fitted=useRef(false);
 useEffect(()=>{place.current=onPlace;},[onPlace]);
 useEffect(()=>{
  if(!container.current)return;
  mapboxgl.accessToken=process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
  const instance=new mapboxgl.Map({container:container.current,style:'mapbox://styles/mapbox/satellite-v9',center:[10.5,60],zoom:14});map.current=instance;
  instance.on('click',e=>place.current?.(e.lngLat.lng,e.lngLat.lat));
  const observer=new ResizeObserver(()=>instance.resize());observer.observe(container.current);
  return()=>{observer.disconnect();instance.remove();map.current=null;};
 },[]);
 useEffect(()=>{
  const instance=map.current;if(!instance)return;
  const rendered=mountPhysicalMarkers(instance,markers);
  if(markers.length&&!fitted.current){const bounds=new mapboxgl.LngLatBounds();markers.forEach(p=>bounds.extend([p.longitude,p.latitude]));instance.fitBounds(bounds,{padding:50,maxZoom:18,duration:0});fitted.current=true;}
  return()=>rendered.forEach(m=>m.remove());
 },[markers]);
 return <div ref={container} className="h-full min-h-64 w-full" aria-label="Course tee and basket map"/>;
}

export function mountPhysicalMarkers(instance: mapboxgl.Map, markers: PhysicalMarker[]) {
 return markers.map(p=>{
   const element=document.createElement('button');element.type='button';element.title=p.title;element.setAttribute('aria-label',p.title);
   Object.assign(element.style,{width:'40px',height:'40px',border:'2px solid '+(p.selected?'#22D3EE':'#FFFFFF'),borderRadius:'3px',background:p.color || '#17202D',boxShadow:p.selected?'0 0 0 3px #22D3EE':'none',color:'#FFFFFF',fontSize:'10px'});
   const image=document.createElement('img');image.src=p.kind==='tee'?'/icons/teepad.png':'/icons/basket_hvit.png';image.alt='';image.style.cssText='height:22px;width:22px;object-fit:contain;margin:auto';element.append(image);
   element.append(document.createTextNode(p.kind==='tee'?'TEE':'BASKET'));element.addEventListener('mousedown',e=>e.stopPropagation());
   const marker=new mapboxgl.Marker({element}).setLngLat([p.longitude,p.latitude]).setPopup(new mapboxgl.Popup().setText(p.title)).addTo(instance);
   element.addEventListener('click',e=>{e.stopPropagation();marker.togglePopup();});
   return marker;
  });
}
