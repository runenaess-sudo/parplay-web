export type FairwayCoordinate = {
    lng: number;
    lat: number;
    width?: number | null;
    [key: string]: unknown;
};

type XY = { x: number; y: number; width: number };
type LngLat = [number, number];

const EARTH_RADIUS_M = 6371000;
const MIN_POINT_DISTANCE_M = 0.25;
export const DEFAULT_FAIRWAY_WIDTH_M = 6;

export function validFairwayWidth(value: unknown, fallback = DEFAULT_FAIRWAY_WIDTH_M) {
    const width = Number(value);
    return Number.isFinite(width) && width > 0 && width <= 100 ? width : fallback;
}

function validCoordinate(point: FairwayCoordinate | null | undefined): point is FairwayCoordinate {
    return Boolean(point)
        && Number.isFinite(point!.lng)
        && Number.isFinite(point!.lat)
        && point!.lng >= -180
        && point!.lng <= 180
        && point!.lat >= -90
        && point!.lat <= 90;
}

export function fairwayDistanceMeters(a: FairwayCoordinate, b: FairwayCoordinate) {
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const deltaLat = (b.lat - a.lat) * Math.PI / 180;
    const deltaLng = (b.lng - a.lng) * Math.PI / 180;
    const sinLat = Math.sin(deltaLat / 2);
    const sinLng = Math.sin(deltaLng / 2);
    const h = Math.min(1, sinLat * sinLat
        + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng);
    return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function normalized(x: number, y: number) {
    const length = Math.hypot(x, y);
    return length > 0 ? { x: x / length, y: y / length } : null;
}

function projection(reference: FairwayCoordinate) {
    const cosLatitude = Math.cos(reference.lat * Math.PI / 180);
    return {
        toXY(point: FairwayCoordinate, width: number): XY {
            return {
                x: (point.lng - reference.lng) * Math.PI / 180 * EARTH_RADIUS_M * cosLatitude,
                y: (point.lat - reference.lat) * Math.PI / 180 * EARTH_RADIUS_M,
                width,
            };
        },
        toLngLat(point: XY): LngLat {
            return [
                reference.lng + point.x / (EARTH_RADIUS_M * cosLatitude) * 180 / Math.PI,
                reference.lat + point.y / EARTH_RADIUS_M * 180 / Math.PI,
            ];
        },
    };
}

export function buildFairwayCorridor(
    tee: FairwayCoordinate | null | undefined,
    fairway: FairwayCoordinate[],
    basket: FairwayCoordinate | null | undefined,
    fallbackWidth = DEFAULT_FAIRWAY_WIDTH_M,
): LngLat[] | null {
    if (!validCoordinate(tee) || !validCoordinate(basket)) return null;
    const validFairway = fairway.filter(validCoordinate);
    const resolvedFallback = validFairwayWidth(fallbackWidth);
    const firstWidth = validFairwayWidth(validFairway[0]?.width, resolvedFallback);
    const lastWidth = validFairwayWidth(validFairway.at(-1)?.width, resolvedFallback);
    const source = [
        { ...tee, width: firstWidth },
        ...validFairway.map((point) => ({
            ...point,
            width: validFairwayWidth(point.width, resolvedFallback),
        })),
        { ...basket, width: lastWidth },
    ];
    const cleaned = source.filter((point, index) =>
        index === 0 || fairwayDistanceMeters(source[index - 1], point) > MIN_POINT_DISTANCE_M
    );
    if (cleaned.length < 2) return null;

    const projected = projection(cleaned[0]);
    const points = cleaned.map((point) => projected.toXY(point, validFairwayWidth(point.width, resolvedFallback)));
    const directions = points.slice(0, -1).map((point, index) =>
        normalized(points[index + 1].x - point.x, points[index + 1].y - point.y)
    );
    if (directions.some((direction) => direction === null)) return null;

    const left: XY[] = [];
    const right: XY[] = [];
    points.forEach((point, index) => {
        const previousDirection = directions[Math.max(0, index - 1)]!;
        const nextDirection = directions[Math.min(directions.length - 1, index)]!;
        const previousNormal = { x: -previousDirection.y, y: previousDirection.x };
        const nextNormal = { x: -nextDirection.y, y: nextDirection.x };
        let offset = nextNormal;
        let offsetDistance = point.width;

        if (index > 0 && index < points.length - 1) {
            const miter = normalized(
                previousNormal.x + nextNormal.x,
                previousNormal.y + nextNormal.y,
            );
            if (miter) {
                const denominator = Math.abs(miter.x * nextNormal.x + miter.y * nextNormal.y);
                offset = miter;
                offsetDistance = Math.min(point.width / Math.max(denominator, 0.35), point.width * 2.5);
            }
        }

        left.push({ ...point, x: point.x + offset.x * offsetDistance, y: point.y + offset.y * offsetDistance });
        right.push({ ...point, x: point.x - offset.x * offsetDistance, y: point.y - offset.y * offsetDistance });
    });

    const ring = [...left, ...right.reverse()].map(projected.toLngLat);
    ring.push(ring[0]);
    return ring;
}

export function fairwayWidthHandles(
    tee: FairwayCoordinate | null | undefined,
    fairway: FairwayCoordinate[],
    selectedIndex: number,
    basket: FairwayCoordinate | null | undefined,
    fallbackWidth = DEFAULT_FAIRWAY_WIDTH_M,
): [LngLat, LngLat] | null {
    const center = fairway[selectedIndex];
    if (!validCoordinate(center) || !validCoordinate(tee) || !validCoordinate(basket)) return null;
    const previous = selectedIndex === 0 ? tee : fairway[selectedIndex - 1];
    const next = selectedIndex === fairway.length - 1 ? basket : fairway[selectedIndex + 1];
    const candidates: [FairwayCoordinate, FairwayCoordinate][] = [
        [previous, next],
        [previous, center],
        [center, next],
        [tee, basket],
    ];
    const tangentPair = candidates.find(([from, to]) =>
        validCoordinate(from) && validCoordinate(to)
        && fairwayDistanceMeters(from, to) > MIN_POINT_DISTANCE_M
    );
    if (!tangentPair) return null;

    const projected = projection(center);
    const from = projected.toXY(tangentPair[0], 0);
    const to = projected.toXY(tangentPair[1], 0);
    const tangent = normalized(to.x - from.x, to.y - from.y);
    if (!tangent) return null;
    const normal = { x: -tangent.y, y: tangent.x };
    const width = validFairwayWidth(center.width, validFairwayWidth(fallbackWidth));
    return [
        projected.toLngLat({ x: normal.x * width, y: normal.y * width, width }),
        projected.toLngLat({ x: -normal.x * width, y: -normal.y * width, width }),
    ];
}
