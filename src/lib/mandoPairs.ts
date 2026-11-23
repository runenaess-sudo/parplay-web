import type { FeatureCollection, LineString } from "geojson";
import type { HoleFeature } from "@/types/holeFeatures";

// A connector is presentation only; never infer a pair from proximity.
export function mandoPairLines(holes: { id: string; hole_features?: HoleFeature[] }[]): FeatureCollection<LineString> {
    const features: FeatureCollection<LineString>["features"] = [];
    for (const hole of holes) {
        const groups = new Map<string, Map<string, HoleFeature>>();
        for (const point of hole.hole_features ?? []) {
            const group = point.properties?.group_id;
            if (point.feature_type !== "MANDO" || point.properties?.pass_side !== "BETWEEN" || typeof group !== "string" || !group) continue;
            const members = groups.get(group) ?? new Map<string, HoleFeature>();
            members.set(point.id, point); groups.set(group, members);
        }
        for (const [group, members] of groups) {
            const pair = [...members.values()];
            if (pair.length !== 2 || pair.some(p => p.geometry?.type !== "Point" || p.geometry.coordinates.length !== 2 || !p.geometry.coordinates.every(Number.isFinite))) continue;
            features.push({ type: "Feature", properties: { groupId: group, holeId: hole.id },
                geometry: { type: "LineString", coordinates: pair.map(p => (p.geometry as GeoJSON.Point).coordinates) } });
        }
    }
    return { type: "FeatureCollection", features };
}
