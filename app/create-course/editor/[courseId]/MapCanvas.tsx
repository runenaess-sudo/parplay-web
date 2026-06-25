"use client";

import * as turf from "@turf/turf";
import type { Feature, LineString, Point, Polygon } from "geojson";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type EditorMode = "none" | "tee" | "basket" | "points";

type MapCanvasProps = {
    course: any;
    selectedHoleId: string | null;
    mode: EditorMode;
    onSetTee: (holeId: string, lng: number, lat: number) => void;
    onSetBasket: (holeId: string, lng: number, lat: number) => void;
    onAddFairwayPoint: (holeId: string, lng: number, lat: number) => void;
    onMoveFairwayPoint: (holeId: string, index: number, lng: number, lat: number) => void;
    onRemoveFairwayPoint: (holeId: string, index: number) => void;
    onSetTeeAngle: (holeId: string, angle: number) => void;
};

export function MapCanvas({
    course,
    selectedHoleId,
    mode,
    onSetTee,
    onSetBasket,
    onAddFairwayPoint,
    onMoveFairwayPoint,
    onRemoveFairwayPoint,
    onSetTeeAngle,
}: MapCanvasProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    const courseRef = useRef<any>(course);
    const selectedHoleRef = useRef<string | null>(selectedHoleId);
    const modeRef = useRef<EditorMode>(mode);

    const updatePointsRef = useRef<() => void>(() => { });

    const draggingPointRef = useRef<{
        holeId: string;
        index: number;
    } | null>(null);

    useEffect(() => {
        courseRef.current = course;
    }, [course]);

    useEffect(() => {
        selectedHoleRef.current = selectedHoleId;
    }, [selectedHoleId]);

    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

    useEffect(() => {
        if (!ref.current) return;

        const map = new mapboxgl.Map({
            container: ref.current,
            style: "mapbox://styles/mapbox/satellite-v9",
            center: [10.5, 60.0],
            zoom: 14,
        });

        mapRef.current = map;

        map.on("styleimagemissing", (e) => {
            const id = e.id;

            const sources: Record<string, string> = {
                "teepad-icon": "/icons/teepad.png",
                "basket-icon": "/icons/basket_hvit.png",
                "point-icon": "/icons/point.png",
            };

            const src = sources[id];
            if (!src) return;

            map.loadImage(src, (err, img) => {
                if (!err && img && !map.hasImage(id)) {
                    map.addImage(id, img);
                }
            });
        });

        map.on("load", () => {
            const preload: [string, string][] = [
                ["teepad-icon", "/icons/teepad.png"],
                ["basket-icon", "/icons/basket_hvit.png"],
                ["point-icon", "/icons/point.png"],
            ];

            preload.forEach(([id, src]) => {
                map.loadImage(src, (err, img) => {
                    if (!err && img && !map.hasImage(id)) {
                        map.addImage(id, img);
                    }
                });
            });

            // SOURCES
            map.addSource("tee-source", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            map.addSource("basket-source", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            map.addSource("fairway-source", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            map.addSource("fairway-line-source", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            map.addSource("fairway-area-source", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            // LAYERS
            map.addLayer({
                id: "fairway-area-layer",
                type: "fill",
                source: "fairway-area-source",
                paint: {
                    "fill-color": "#00ff88",
                    "fill-opacity": 0.20,
                },
            });

            map.addLayer({
                id: "fairway-line-layer",
                type: "line",
                source: "fairway-line-source",
                paint: {
                    "line-color": "#00ff88",
                    "line-width": 3,
                },
            });

            map.addLayer({
                id: "tee-layer",
                type: "symbol",
                source: "tee-source",
                layout: {
                    "icon-image": "teepad-icon",
                    "icon-size": 0.22,
                    "icon-anchor": "bottom",
                    "icon-rotate": ["get", "angle"],
                },
            });

            map.addLayer({
                id: "basket-layer",
                type: "symbol",
                source: "basket-source",
                layout: {
                    "icon-image": "basket-icon",
                    "icon-size": 0.20,
                    "icon-anchor": "bottom",
                },
            });

            map.addLayer({
                id: "fairway-layer",
                type: "symbol",
                source: "fairway-source",
                layout: {
                    "icon-image": "point-icon",
                    "icon-size": 0.12,
                    "icon-anchor": "center",
                },
            });

            const updatePoints = () => {
                const teeFeatures: Feature<Point>[] = [];
                const basketFeatures: Feature<Point>[] = [];
                const fairwayFeatures: Feature<Point>[] = [];
                const fairwayLineFeatures: Feature<LineString>[] = [];
                const fairwayAreaFeatures: Feature<Polygon>[] = [];

                courseRef.current.holes.forEach((hole: any) => {
                    // Tee
                    if (hole.tee_latitude && hole.tee_longitude) {
                        teeFeatures.push({
                            type: "Feature",
                            properties: {
                                holeId: hole.id,
                                angle: hole.tee_angle ?? 0,
                            },
                            geometry: {
                                type: "Point",
                                coordinates: [hole.tee_longitude, hole.tee_latitude],
                            },
                        });
                    }

                    // Basket
                    if (hole.basket_latitude && hole.basket_longitude) {
                        basketFeatures.push({
                            type: "Feature",
                            properties: { holeId: hole.id },
                            geometry: {
                                type: "Point",
                                coordinates: [hole.basket_longitude, hole.basket_latitude],
                            },
                        });
                    }

                    // Fairway points
                    (hole.fairway ?? []).forEach((p: any, idx: number) => {
                        fairwayFeatures.push({
                            type: "Feature",
                            properties: { holeId: hole.id, index: idx },
                            geometry: {
                                type: "Point",
                                coordinates: [p.lng, p.lat],
                            },
                        });
                    });

                    // Fairway line: tee -> points -> basket
                    const lineCoords: [number, number][] = [];

                    if (hole.tee_latitude && hole.tee_longitude) {
                        lineCoords.push([hole.tee_longitude, hole.tee_latitude]);
                    }

                    (hole.fairway ?? []).forEach((p: any) => {
                        lineCoords.push([p.lng, p.lat]);
                    });

                    if (hole.basket_latitude && hole.basket_longitude) {
                        lineCoords.push([hole.basket_longitude, hole.basket_latitude]);
                    }

                    if (lineCoords.length >= 2) {
                        const line: Feature<LineString> = {
                            type: "Feature",
                            properties: { holeId: hole.id },
                            geometry: {
                                type: "LineString",
                                coordinates: lineCoords,
                            },
                        };

                        fairwayLineFeatures.push(line);

                        // Fairway slør (6m buffer på hver side)
                        try {
                            const turfLine = turf.lineString(lineCoords);
                            const buffered = turf.buffer(turfLine, 6, {
                                units: "meters",
                            }) as Feature<Polygon>;

                            fairwayAreaFeatures.push({
                                type: "Feature",
                                properties: { holeId: hole.id },
                                geometry: buffered.geometry,
                            });
                        } catch {
                            // Ignorer buffer-feil hvis noe er rart med koordinater
                        }
                    }
                });

                (map.getSource("tee-source") as mapboxgl.GeoJSONSource).setData({
                    type: "FeatureCollection",
                    features: teeFeatures,
                });

                (map.getSource("basket-source") as mapboxgl.GeoJSONSource).setData({
                    type: "FeatureCollection",
                    features: basketFeatures,
                });

                (map.getSource("fairway-source") as mapboxgl.GeoJSONSource).setData({
                    type: "FeatureCollection",
                    features: fairwayFeatures,
                });

                (map.getSource("fairway-line-source") as mapboxgl.GeoJSONSource).setData({
                    type: "FeatureCollection",
                    features: fairwayLineFeatures,
                });

                (map.getSource("fairway-area-source") as mapboxgl.GeoJSONSource).setData({
                    type: "FeatureCollection",
                    features: fairwayAreaFeatures,
                });
            };

            updatePointsRef.current = updatePoints;
            updatePoints();

            // LEFT CLICK: add / set
            map.on("click", (e) => {
                const holeId = selectedHoleRef.current;
                const currentMode = modeRef.current;
                if (!holeId) return;

                const lng = e.lngLat.lng;
                const lat = e.lngLat.lat;

                if (currentMode === "tee") {
                    onSetTee(holeId, lng, lat);
                } else if (currentMode === "basket") {
                    onSetBasket(holeId, lng, lat);
                } else if (currentMode === "points") {
                    onAddFairwayPoint(holeId, lng, lat);
                }

                updatePointsRef.current();
            });

            // RIGHT CLICK: remove point (in points mode)
            map.on("contextmenu", (e) => {
                const holeId = selectedHoleRef.current;
                const currentMode = modeRef.current;
                if (!holeId) return;
                if (currentMode !== "points") return;

                e.preventDefault();

                const features = map.queryRenderedFeatures(e.point, {
                    layers: ["fairway-layer"],
                });

                const hit = features[0];
                if (!hit) return;

                const props = hit.properties as any;
                const hitHoleId = props?.holeId;
                const index = props?.index;

                if (hitHoleId && typeof index === "number") {
                    onRemoveFairwayPoint(hitHoleId, index);
                    updatePointsRef.current();
                }
            });

            // DRAG POINTS (left mouse)
            map.on("mousedown", (e) => {
                const currentMode = modeRef.current;
                if (currentMode !== "points") return;

                const features = map.queryRenderedFeatures(e.point, {
                    layers: ["fairway-layer"],
                });

                const hit = features[0];
                if (!hit) return;

                const props = hit.properties as any;
                const holeId = props?.holeId;
                const index = props?.index;

                if (!holeId || typeof index !== "number") return;

                draggingPointRef.current = { holeId, index };

                map.getCanvas().style.cursor = "grabbing";

                const onMove = (ev: mapboxgl.MapMouseEvent) => {
                    const lng = ev.lngLat.lng;
                    const lat = ev.lngLat.lat;
                    const drag = draggingPointRef.current;
                    if (!drag) return;

                    onMoveFairwayPoint(drag.holeId, drag.index, lng, lat);
                    updatePointsRef.current();
                };

                const onUp = () => {
                    draggingPointRef.current = null;
                    map.getCanvas().style.cursor = "";
                    map.off("mousemove", onMove);
                    map.off("mouseup", onUp);
                };

                map.on("mousemove", onMove);
                map.on("mouseup", onUp);
            });

            // SIMPLE TEE ROTATION: scroll in tee mode
            map.on("wheel", (e) => {
                const holeId = selectedHoleRef.current;
                const currentMode = modeRef.current;
                if (!holeId) return;
                if (currentMode !== "tee") return;

                e.preventDefault();

                const delta = e.originalEvent.deltaY;
                const course = courseRef.current;
                const hole = course.holes.find((h: any) => h.id === holeId);
                if (!hole) return;

                const currentAngle = hole.tee_angle ?? 0;
                const newAngle = (currentAngle + (delta > 0 ? 5 : -5) + 360) % 360;

                onSetTeeAngle(holeId, newAngle);
                updatePointsRef.current();
            });
        });

        return () => map.remove();
    }, []);

    useEffect(() => {
        updatePointsRef.current();
    }, [course]);

    // AUTOZOOM TO SELECTED HOLE
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!courseRef.current || !courseRef.current.holes) return;

        const holeId = selectedHoleRef.current;
        if (!holeId) return;

        const hole = courseRef.current.holes.find((h: any) => h.id === holeId);
        if (!hole) return;

        const coords: [number, number][] = [];

        if (hole.tee_latitude && hole.tee_longitude) {
            coords.push([hole.tee_longitude, hole.tee_latitude]);
        }

        (hole.fairway ?? []).forEach((p: any) => {
            coords.push([p.lng, p.lat]);
        });

        if (hole.basket_latitude && hole.basket_longitude) {
            coords.push([hole.basket_longitude, hole.basket_latitude]);
        }

        if (coords.length === 0) return;

        const bounds = coords.reduce(
            (b: any, c: any) => b.extend(c),
            new mapboxgl.LngLatBounds(coords[0], coords[0])
        );

        map.fitBounds(bounds, { padding: 120, duration: 600 });
    }, [selectedHoleId]);

    return (
        <div className="w-full h-full">
            <div ref={ref} className="w-full h-full" />
        </div>
    );
}
