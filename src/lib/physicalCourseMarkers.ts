export type MarkerConfig = { id: string; hole_id: string; tee_id: string; basket_id: string; is_default?: boolean; alternate_ordinal?: number | null; alternate_suffix?: string | null; number?: number; label?: string | null };
export type MarkerPoint = { id: string; label?: string | null; latitude: number | null; longitude: number | null; marker_ordinal?: number | null; usage?: {hole_id: string; number: number}[] };
export type PhysicalMarker = { id: string; kind: 'tee' | 'basket'; latitude: number; longitude: number; ordinal: number | null; color: string | null; title: string; selected: boolean };
export function markerColor(ordinal: number | null) { return ordinal===1 ? null : ordinal===2 ? '#2563EB' : ordinal===3 ? '#DC2626' : '#64748B'; }
export function physicalMarkers(data: {tees: MarkerPoint[]; baskets: MarkerPoint[]; configs: MarkerConfig[]}, selectedIds: string[] = []): PhysicalMarker[] {
 return (['tee','basket'] as const).flatMap(kind=>[...new Map(data[kind==='tee'?'tees':'baskets'].map(p=>[p.id,p])).values()].flatMap(p=>{
  if(typeof p.latitude!=='number'||typeof p.longitude!=='number'||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude))return [];
  const configs=data.configs.filter(c=>c[kind==='tee'?'tee_id':'basket_id']===p.id);
  const values=configs.map(c=>c.is_default?1:c.alternate_ordinal).filter((v): v is number=>typeof v==='number' && v>0);
  const ordinal=p.marker_ordinal ?? (values.length?Math.min(...values):null);
  const names=configs.map(c=>String(c.number ?? p.usage?.find(u=>u.hole_id===c.hole_id)?.number ?? '')+(c.alternate_suffix || (c.is_default?'A':''))).filter(Boolean);
  return [{id:p.id,kind,latitude:p.latitude,longitude:p.longitude,ordinal,color:markerColor(ordinal),title:kind.toUpperCase()+' '+(p.label || '')+(names.length?' | '+[...new Set(names)].join(', '):''),selected:selectedIds.includes(p.id)}];
 }));
}
