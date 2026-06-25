import * as turf from "@turf/turf";

export function calculateHoleLength(lineCoords: [number, number][]) {
    const line = turf.lineString(lineCoords);
    const km = turf.length(line, { units: "kilometers" });
    return Math.round(km * 1000);
}
