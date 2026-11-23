'use client';
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { FeatureCollection, Polygon } from 'geojson';
import type { PhysicalMarker } from '@/lib/physicalCourseMarkers';
export default function PhysicalPointsMap({markers,onPlace,hideBasketLabels=false,preview=false,publicView=false,corridors}:{publicView?:boolean;corridors?:FeatureCollection<Polygon>;markers:PhysicalMarker[];onPlace?:(lng:number,lat:number)=>void;hideBasketLabels?:boolean;preview?:boolean}) {
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
  const rendered=mountPhysicalMarkers(instance,markers,hideBasketLabels,preview,publicView);
  if(markers.length&&!fitted.current){const bounds=new mapboxgl.LngLatBounds();markers.forEach(p=>bounds.extend([p.longitude,p.latitude]));instance.fitBounds(bounds,{padding:50,maxZoom:18,duration:0});fitted.current=true;}
  return()=>rendered.forEach(m=>m.remove());
 },[markers,hideBasketLabels,preview,publicView]);
 useEffect(()=>{
  const instance=map.current;if(!instance||!corridors)return;
  const draw=()=>{
   if(instance.getSource('public-corridors'))return;
   instance.addSource('public-corridors',{type:'geojson',data:corridors});
   instance.addLayer({id:'public-corridors-fill',type:'fill',source:'public-corridors',paint:{'fill-color':'#fbbf24','fill-opacity':0.12}});
  };
  if(instance.isStyleLoaded())draw();else instance.on('load',draw);
  return()=>{instance.off('load',draw);if(map.current!==instance)return;if(instance.getLayer('public-corridors-fill'))instance.removeLayer('public-corridors-fill');if(instance.getSource('public-corridors'))instance.removeSource('public-corridors');};
 },[corridors]);
 return <div ref={container} className="h-full min-h-64 w-full" aria-label="Course tee and basket map"/>;
}

export function mountPhysicalMarkers(instance: mapboxgl.Map, markers: PhysicalMarker[], hideBasketLabels = false, preview = false, publicView = false) {
 return markers.map(p=>{
   const element=document.createElement('button');element.type='button';element.title=p.title;element.setAttribute('aria-label',p.title);
   Object.assign(element.style,{width:'40px',height:'40px',border:'2px solid '+(p.selected?'#22D3EE':'#FFFFFF'),borderRadius:'3px',background:p.color || '#17202D',boxShadow:p.selected?'0 0 0 3px #22D3EE':'none',color:'#FFFFFF',fontSize:'10px'});
   const image=document.createElement('img');image.src=p.kind==='tee'?'/icons/teepad.png':'/icons/basket_hvit.png';image.alt='';image.style.cssText='height:22px;width:22px;object-fit:contain;margin:auto';element.append(image);
   if(preview) {
     Object.assign(element.style,{width:'28px',height:'28px',border:'none',background:'transparent',boxShadow:'none',padding:'0'});
     const content=document.createElement('span');content.style.cssText='position:relative;display:block;width:28px;height:28px';content.append(image);element.append(content);
     if(p.kind==='tee') {
       image.style.cssText=publicView?'height:16px;width:16px;object-fit:contain;margin:auto':'height:28px;width:28px;object-fit:contain';
       const number=document.createElement('span');number.textContent=p.holeNumbers || '';
       number.style.cssText='position:absolute;inset:'+(publicView?'12px -8px -8px':'0')+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;text-shadow:0 1px 2px black';
       content.append(number);
     }
   } else if(hideBasketLabels && p.kind==='basket') {
     Object.assign(element.style,{border:'none',background:'transparent',boxShadow:'none',padding:'0'});
   } else {
     element.append(document.createTextNode(p.kind==='tee'?'TEE':'BASKET'));
   }
   if(p.kind==='tee' && (publicView || hideBasketLabels)) {
     Object.assign(element.style,{border:'none',background:'transparent',boxShadow:'none',padding:'0'});
     element.childNodes.forEach(node=>{if(node.nodeType===3)node.remove();});
   }
   element.addEventListener('mousedown',e=>e.stopPropagation());
   const marker=new mapboxgl.Marker({element}).setLngLat([p.longitude,p.latitude]).setPopup(new mapboxgl.Popup().setText(p.title)).addTo(instance);
   element.addEventListener('click',e=>{e.stopPropagation();marker.togglePopup();});
   return marker;
  });
}
