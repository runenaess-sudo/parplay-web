import type { FeatureCollection, Polygon } from 'geojson';
import type { MarkerConfig, MarkerPoint } from './physicalCourseMarkers';
import { buildFairwayCorridor, type FairwayCoordinate } from '@/utils/fairwayCorridor';
// Presentation only; a straight fallback is not a surveyed fairway. Never saved.
export function publicCourseCorridors(data: {tees: MarkerPoint[]; baskets: MarkerPoint[]; configs: (MarkerConfig & {fairway?: FairwayCoordinate[]})[]}): FeatureCollection<Polygon> {
 const point=(p:MarkerPoint|undefined)=>p&&typeof p.longitude==='number'&&typeof p.latitude==='number'?{lng:p.longitude,lat:p.latitude}:null;
 return {type:'FeatureCollection',features:data.configs.flatMap(c=>{
  const ring=buildFairwayCorridor(point(data.tees.find(p=>p.id===c.tee_id)),Array.isArray(c.fairway)?c.fairway:[],point(data.baskets.find(p=>p.id===c.basket_id)));
  return ring?[{type:'Feature' as const,properties:{},geometry:{type:'Polygon' as const,coordinates:[ring]}}]:[];
 })};
}
