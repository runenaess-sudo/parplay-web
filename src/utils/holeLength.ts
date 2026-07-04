import * as turf from "@turf/turf";

export function calculateHoleLength(lineCoords: [number, number][]) {
    const validCoords = lineCoords.filter(
        (coord): coord is [number, number] =>
            Array.isArray(coord) &&
            coord.length === 2 &&
            Number.isFinite(coord[0]) &&
            Number.isFinite(coord[1])
    );

    if (validCoords.length < 2) {
        return 0;
    }

    const line = turf.lineString(validCoords);
    const km = turf.length(line, { units: "kilometers" });
    return Math.round(km * 1000);
}
