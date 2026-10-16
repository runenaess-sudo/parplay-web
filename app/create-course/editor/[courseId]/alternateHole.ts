export type PhysicalPoint = { id: string; label?: string; latitude: number; longitude: number; usage?: { hole_id: string; number: number }[] };
export type Configuration = { id: string; hole_id: string; tee_id: string; basket_id: string; is_default?: boolean; alternate_suffix?: string; label?: string; par: number; tee_angle?: number };
export function configurationName(config: Configuration, number: number) {
 return config.alternate_suffix ? 'Hole ' + number + config.alternate_suffix + (config.is_default ? ' - Main' : ' - Alternate') : (config.is_default ? 'Hole ' + number + ' - Main' : 'Alternate - ' + (config.label || config.id));
}
export function sortedPoints(points: PhysicalPoint[], holeId: string) {
 return [...points].sort((a,b) => Number(b.usage?.some(u=>u.hole_id===holeId) ?? false)-Number(a.usage?.some(u=>u.hole_id===holeId) ?? false) || (a.label || a.id).localeCompare(b.label || b.id));
}
export function pointName(point: PhysicalPoint) {
 return (point.label || 'Unnamed point') + ' - holes ' + ([...new Set(point.usage?.map(u=>u.number) || [])].join(', ') || 'unassigned') + ' / ' + point.id.slice(0,8);
}
export function matchingConfiguration(configs: Configuration[], holeId: string, tee: string, basket: string) {
 return configs.find(c=>c.hole_id===holeId && c.tee_id===tee && c.basket_id===basket);
}
