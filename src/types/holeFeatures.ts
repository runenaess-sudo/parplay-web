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
export type MandoPassSide = "LEFT" | "RIGHT" | "BETWEEN";
export type ObLineSide = "LEFT" | "RIGHT";

export const MANDO_PASS_SIDES = ["LEFT", "RIGHT", "BETWEEN"] as const satisfies readonly MandoPassSide[];
export const OB_LINE_SIDES = ["LEFT", "RIGHT"] as const satisfies readonly ObLineSide[];

export type HoleFeature = {
    id: string;
    hole_id: string;
    origin_hole_id?: string;
    applicable_hole_ids?: string[];
    feature_type: HoleFeatureType;
    geometry: HoleFeatureGeometry | null;
    description: string | null;
    properties: Record<string, unknown>;
    sort_order: number;
    created_at?: string;
    updated_at?: string;
};

export const SHARED_HOLE_FEATURE_TYPES = ["OB_LINE", "OB_AREA", "HAZARD_AREA"] as const;

export function isSharedHoleFeatureType(type: HoleFeatureType) {
    return SHARED_HOLE_FEATURE_TYPES.includes(type as (typeof SHARED_HOLE_FEATURE_TYPES)[number]);
}

export function featureTypeLabel(type: HoleFeatureType) {
    return type.replaceAll("_", " ");
}

export function isMandoPassSide(value: unknown): value is MandoPassSide {
    return MANDO_PASS_SIDES.includes(value as MandoPassSide);
}

export function isObLineSide(value: unknown): value is ObLineSide {
    return OB_LINE_SIDES.includes(value as ObLineSide);
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
