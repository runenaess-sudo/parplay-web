import type { LineString, Point, Polygon } from "geojson";

export const HOLE_FEATURE_TYPES = [
    "OB_AREA",
    "HAZARD_AREA",
    "OB_LINE",
    "MANDO",
    "DROPZONE",
    "INFO",
] as const;

export type HoleFeatureType = (typeof HOLE_FEATURE_TYPES)[number];
export type SpatialHoleFeatureType = Exclude<HoleFeatureType, "INFO">;
export type HoleFeatureGeometry = Point | LineString | Polygon;

export type HoleFeature = {
    id: string;
    hole_id: string;
    feature_type: HoleFeatureType;
    geometry: HoleFeatureGeometry | null;
    description: string | null;
    properties: Record<string, unknown>;
    sort_order: number;
    created_at?: string;
    updated_at?: string;
};

export function featureTypeLabel(type: HoleFeatureType) {
    return type.replaceAll("_", " ");
}

export function minimumVertexCount(type: SpatialHoleFeatureType) {
    if (type === "OB_AREA" || type === "HAZARD_AREA") return 3;
    if (type === "OB_LINE") return 2;
    return 1;
}

export function geometryFromCoordinates(
    type: SpatialHoleFeatureType,
    coordinates: [number, number][],
): HoleFeatureGeometry {
    if (type === "MANDO" || type === "DROPZONE") {
        return { type: "Point", coordinates: coordinates[0] };
    }
    if (type === "OB_LINE") {
        return { type: "LineString", coordinates };
    }
    const first = coordinates[0];
    return { type: "Polygon", coordinates: [[...coordinates, first]] };
}

export function editableCoordinates(feature: HoleFeature): [number, number][] {
    if (!feature.geometry) return [];
    const asCoordinate = (position: number[]) => [position[0], position[1]] as [number, number];
    if (feature.geometry.type === "Point") return [asCoordinate(feature.geometry.coordinates)];
    if (feature.geometry.type === "LineString") return feature.geometry.coordinates.map(asCoordinate);
    return feature.geometry.coordinates[0].slice(0, -1).map(asCoordinate);
}
