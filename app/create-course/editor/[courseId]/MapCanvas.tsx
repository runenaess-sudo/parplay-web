"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */

import { editableCoordinates, type HoleFeature, type HoleFeatureType } from "@/types/holeFeatures";
import {
    buildFairwayCorridor,
    fairwayDistanceMeters,
    fairwayWidthHandles,
} from "@/utils/fairwayCorridor";
import type { Feature, Geometry, LineString, Point, Polygon } from "geojson";
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
    onSetFairwayPointWidth: (holeId: string, index: number, width: number) => void;
    onRemoveFairwayPoint: (holeId: string, index: number) => void;
    onSetTeeAngle: (holeId: string, angle: number) => void;
    featureTool: HoleFeatureType | null;
    drawingCoordinates: [number, number][];
    selectedFeatureId: string | null;
    onAddFeatureCoordinate: (lng: number, lat: number) => void;
    onSelectFeature: (id: string | null) => void;
    onMoveFeatureVertex: (id: string, index: number, lng: number, lat: number, persist?: boolean) => void;
};

export function MapCanvas({
    course,
    selectedHoleId,
    mode,
    onSetTee,
    onSetBasket,
    onAddFairwayPoint,
    onMoveFairwayPoint,
    onSetFairwayPointWidth,
    onRemoveFairwayPoint,
    onSetTeeAngle,
    featureTool,
    drawingCoordinates,
    selectedFeatureId,
    onAddFeatureCoordinate,
    onSelectFeature,
    onMoveFeatureVertex,
}: MapCanvasProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    const courseRef = useRef<any>(course);
    const selectedHoleRef = useRef<string | null>(selectedHoleId);
    const modeRef = useRef<EditorMode>(mode);
    const featureToolRef = useRef<HoleFeatureType | null>(featureTool);
    const drawingCoordinatesRef = useRef<[number, number][]>(drawingCoordinates);
    const selectedFeatureRef = useRef<string | null>(selectedFeatureId);
    const selectedFairwayPointRef = useRef<{ holeId: string; index: number } | null>(null);

    const updatePointsRef = useRef<() => void>(() => { });

    useEffect(() => {
        courseRef.current = course;
    }, [course]);

    useEffect(() => {
        selectedHoleRef.current = selectedHoleId;
        selectedFairwayPointRef.current = null;
        updatePointsRef.current();
    }, [selectedHoleId]);

    useEffect(() => {
        modeRef.current = mode;
        if (mode !== "points") {
            selectedFairwayPointRef.current = null;
            updatePointsRef.current();
        }
    }, [mode]);

    useEffect(() => { featureToolRef.current = featureTool; }, [featureTool]);
    useEffect(() => { drawingCoordinatesRef.current = drawingCoordinates; }, [drawingCoordinates]);
    useEffect(() => { selectedFeatureRef.current = selectedFeatureId; }, [selectedFeatureId]);

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
            const id = e.id as string;

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

        map.on("load", async () => {
            const preload: [string, string][] = [
                ["teepad-icon", "/icons/teepad.png"],
                ["basket-icon", "/icons/basket_hvit.png"],
                ["point-icon", "/icons/point.png"],
            ];

            const loadIcon = (id: string, src: string) =>
                new Promise<void>((resolve) => {
                    if (map.hasImage(id)) return resolve();
                    map.loadImage(src, (err, img) => {
                        if (!err && img && !map.hasImage(id)) {
                            map.addImage(id, img);
                        }
                        resolve();
                    });
                });

            await Promise.all(preload.map(([id, src]) => loadIcon(id, src)));

            const addStripePattern = (id: string, color: [number, number, number, number]) => {
                if (map.hasImage(id)) return;
                const width = 8;
                const data = new Uint8Array(width * width * 4);
                for (let y = 0; y < width; y += 1) {
                    for (let x = 0; x < width; x += 1) {
                        if ((x + y) % width < 2) {
                            const offset = (y * width + x) * 4;
                            data.set(color, offset);
                        }
                    }
                }
                map.addImage(id, { width, height: width, data }, { pixelRatio: 1 });
            };
            addStripePattern("ob-hatch", [255, 255, 255, 180]);
            addStripePattern("hazard-hatch", [140, 140, 140, 190]);

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

            map.addSource("fairway-width-source", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });
            map.addSource("fairway-width-label-source", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            for (const id of ["hole-feature-area-source", "hole-feature-line-source", "hole-feature-stake-source", "hole-feature-point-source", "hole-feature-vertex-source", "hole-feature-draft-source"]) {
                map.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            }

            map.addLayer({
                id: "fairway-area-layer",
                type: "fill",
                source: "fairway-area-source",
                paint: {
                    "fill-color": "#00ff88",
                    "fill-opacity": 0.2,
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
                    "icon-size": 0.2,
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

            map.addLayer({
                id: "hole-feature-area-layer",
                type: "fill",
                source: "hole-feature-area-source",
                paint: {
                    "fill-pattern": ["match", ["get", "featureType"], "OB_AREA", "ob-hatch", "hazard-hatch"],
                    "fill-opacity": 0.72,
                },
            });

            map.addLayer({
                id: "fairway-width-line-layer",
                type: "line",
                source: "fairway-width-source",
                filter: ["==", ["geometry-type"], "LineString"],
                paint: {
                    "line-color": "#facc15",
                    "line-width": 2,
                    "line-dasharray": [2, 1],
                },
            });

            map.addLayer({
                id: "fairway-width-handle-layer",
                type: "circle",
                source: "fairway-width-source",
                filter: ["==", ["geometry-type"], "Point"],
                paint: {
                    "circle-radius": 7,
                    "circle-color": "#facc15",
                    "circle-stroke-color": "#111827",
                    "circle-stroke-width": 2,
                },
            });
            map.addLayer({
                id: "fairway-width-label-layer",
                type: "symbol",
                source: "fairway-width-label-source",
                layout: {
                    "text-field": ["get", "label"],
                    "text-size": 14,
                    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                    "text-offset": [0, -1.4],
                    "text-anchor": "bottom",
                    "text-allow-overlap": true,
                },
                paint: {
                    "text-color": "#ffffff",
                    "text-halo-color": "#111827",
                    "text-halo-width": 2,
                },
            });
            map.addLayer({
                id: "hole-feature-area-outline-layer",
                type: "line",
                source: "hole-feature-area-source",
                paint: {
                    "line-color": ["match", ["get", "featureType"], "OB_AREA", "#ffffff", "#9ca3af"],
                    "line-width": 3,
                },
            });
            map.addLayer({
                id: "hole-feature-line-layer",
                type: "line",
                source: "hole-feature-line-source",
                paint: { "line-color": "#ffffff", "line-width": 3, "line-dasharray": [1, 1] },
            });
            map.addLayer({
                id: "hole-feature-stake-layer",
                type: "circle",
                source: "hole-feature-stake-source",
                paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": "#111827", "circle-stroke-width": 2 },
            });
            map.addLayer({
                id: "hole-feature-point-layer",
                type: "circle",
                source: "hole-feature-point-source",
                paint: {
                    "circle-radius": 12,
                    "circle-color": ["match", ["get", "featureType"], "MANDO", "#facc15", "#2563eb"],
                    "circle-stroke-color": "#111827",
                    "circle-stroke-width": 2,
                },
            });
            map.addLayer({
                id: "hole-feature-point-label-layer",
                type: "symbol",
                source: "hole-feature-point-source",
                layout: {
                    "text-field": ["match", ["get", "featureType"], "MANDO", "M", "DZ"],
                    "text-size": 11,
                    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                },
                paint: { "text-color": "#111827" },
            });
            map.addLayer({
                id: "hole-feature-vertex-layer",
                type: "circle",
                source: "hole-feature-vertex-source",
                paint: { "circle-radius": 6, "circle-color": "#f59e0b", "circle-stroke-color": "#111827", "circle-stroke-width": 2 },
            });
            map.addLayer({
                id: "hole-feature-draft-line-layer",
                type: "line",
                source: "hole-feature-draft-source",
                paint: { "line-color": "#f59e0b", "line-width": 3, "line-dasharray": [2, 1] },
            });
            map.addLayer({
                id: "hole-feature-draft-point-layer",
                type: "circle",
                source: "hole-feature-draft-source",
                paint: { "circle-radius": 5, "circle-color": "#f59e0b", "circle-stroke-color": "#111827", "circle-stroke-width": 1 },
            });

            const updatePoints = () => {
                const teeFeatures: Feature<Point>[] = [];
                const basketFeatures: Feature<Point>[] = [];
                const fairwayFeatures: Feature<Point>[] = [];
                const fairwayLineFeatures: Feature<LineString>[] = [];
                const fairwayAreaFeatures: Feature<Polygon>[] = [];
                const fairwayWidthFeatures: Feature<Point | LineString>[] = [];
                const areaFeatures: Feature<Polygon>[] = [];
                const lineFeatures: Feature<LineString>[] = [];
                const stakeFeatures: Feature<Point>[] = [];
                const pointFeatures: Feature<Point>[] = [];
                const vertexFeatures: Feature<Point>[] = [];

                courseRef.current.holes.forEach((hole: any) => {
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

                        const corridor = buildFairwayCorridor(
                            { lng: hole.tee_longitude, lat: hole.tee_latitude },
                            hole.fairway ?? [],
                            { lng: hole.basket_longitude, lat: hole.basket_latitude },
                            hole.fairway_width ?? 6,
                        );
                        if (corridor) {
                            fairwayAreaFeatures.push({
                                type: "Feature",
                                properties: { holeId: hole.id },
                                geometry: { type: "Polygon", coordinates: [corridor] },
                            });
                        }
                    }
                });

                const selectedFairwayPoint = selectedFairwayPointRef.current;
                if (selectedFairwayPoint) {
                    const hole = courseRef.current.holes.find((item: any) => item.id === selectedFairwayPoint.holeId);
                    const points = hole?.fairway ?? [];
                    const handles = hole ? fairwayWidthHandles(
                        { lng: hole.tee_longitude, lat: hole.tee_latitude },
                        points,
                        selectedFairwayPoint.index,
                        { lng: hole.basket_longitude, lat: hole.basket_latitude },
                        hole.fairway_width ?? 6,
                    ) : null;
                    if (handles) {
                        fairwayWidthFeatures.push({
                            type: "Feature",
                            properties: { holeId: hole.id, index: selectedFairwayPoint.index },
                            geometry: { type: "LineString", coordinates: handles },
                        });
                        handles.forEach((coordinates, side) => fairwayWidthFeatures.push({
                            type: "Feature",
                            properties: { holeId: hole.id, index: selectedFairwayPoint.index, side },
                            geometry: { type: "Point", coordinates },
                        }));
                    }
                }

                const selectedHole = courseRef.current.holes.find((hole: any) => hole.id === selectedHoleRef.current);
                ((selectedHole?.hole_features ?? []) as HoleFeature[]).forEach((feature) => {
                    if (!feature.geometry) return;
                    const geoFeature = {
                        type: "Feature" as const,
                        properties: { featureId: feature.id, featureType: feature.feature_type },
                        geometry: feature.geometry,
                    } as Feature<Geometry>;
                    if (feature.geometry.type === "Polygon") areaFeatures.push(geoFeature as Feature<Polygon>);
                    if (feature.geometry.type === "LineString") {
                        lineFeatures.push(geoFeature as Feature<LineString>);
                        feature.geometry.coordinates.forEach((coordinate, index) => stakeFeatures.push({
                            type: "Feature",
                            properties: { featureId: feature.id, featureType: feature.feature_type, vertexIndex: index },
                            geometry: { type: "Point", coordinates: coordinate },
                        }));
                    }
                    if (feature.geometry.type === "Point") pointFeatures.push(geoFeature as Feature<Point>);
                    if (feature.id === selectedFeatureRef.current) {
                        editableCoordinates(feature).forEach((coordinate, index) => vertexFeatures.push({
                            type: "Feature",
                            properties: { featureId: feature.id, vertexIndex: index },
                            geometry: { type: "Point", coordinates: coordinate },
                        }));
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
                (map.getSource("fairway-width-source") as mapboxgl.GeoJSONSource).setData({
                    type: "FeatureCollection",
                    features: fairwayWidthFeatures,
                });
                (map.getSource("hole-feature-area-source") as mapboxgl.GeoJSONSource).setData({ type: "FeatureCollection", features: areaFeatures });
                (map.getSource("hole-feature-line-source") as mapboxgl.GeoJSONSource).setData({ type: "FeatureCollection", features: lineFeatures });
                (map.getSource("hole-feature-stake-source") as mapboxgl.GeoJSONSource).setData({ type: "FeatureCollection", features: stakeFeatures });
                (map.getSource("hole-feature-point-source") as mapboxgl.GeoJSONSource).setData({ type: "FeatureCollection", features: pointFeatures });
                (map.getSource("hole-feature-vertex-source") as mapboxgl.GeoJSONSource).setData({ type: "FeatureCollection", features: vertexFeatures });
                const draft = drawingCoordinatesRef.current;
                const draftFeatures: Feature<Point | LineString>[] = draft.map((coordinate, index) => ({
                    type: "Feature", properties: { index }, geometry: { type: "Point", coordinates: coordinate },
                }));
                if (draft.length >= 2) draftFeatures.push({
                    type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: draft },
                });
                (map.getSource("hole-feature-draft-source") as mapboxgl.GeoJSONSource).setData({ type: "FeatureCollection", features: draftFeatures });
            };

            updatePointsRef.current = updatePoints;
            updatePoints();

            map.on("click", (e) => {
                const holeId = selectedHoleRef.current;
                const currentMode = modeRef.current;
                if (!holeId) return;

                const lng = e.lngLat.lng;
                const lat = e.lngLat.lat;

                if (featureToolRef.current && featureToolRef.current !== "INFO") {
                    onAddFeatureCoordinate(lng, lat);
                    return;
                }

                if (currentMode === "tee") {
                    onSetTee(holeId, lng, lat);
                } else if (currentMode === "basket") {
                    onSetBasket(holeId, lng, lat);
                } else if (currentMode === "points") {
                    const existingControl = map.queryRenderedFeatures(e.point, {
                        layers: ["fairway-layer", "fairway-width-handle-layer"],
                    });
                    if (existingControl.length > 0) return;
                    onAddFairwayPoint(holeId, lng, lat);
                }

            });

            for (const layer of ["hole-feature-area-layer", "hole-feature-area-outline-layer", "hole-feature-line-layer", "hole-feature-stake-layer", "hole-feature-point-layer", "hole-feature-point-label-layer"]) {
                map.on("click", layer, (event) => {
                    const id = event.features?.[0]?.properties?.featureId;
                    if (typeof id === "string") onSelectFeature(id);
                });
            }

            map.on("click", "fairway-layer", (event) => {
                if (modeRef.current !== "points") return;
                const holeId = event.features?.[0]?.properties?.holeId;
                const index = Number(event.features?.[0]?.properties?.index);
                if (typeof holeId !== "string" || !Number.isInteger(index)) return;
                selectedFairwayPointRef.current = { holeId, index };
                updatePointsRef.current();
            });

            map.on("mousedown", "fairway-width-handle-layer", (event) => {
                const holeId = event.features?.[0]?.properties?.holeId;
                const index = Number(event.features?.[0]?.properties?.index);
                if (typeof holeId !== "string" || !Number.isInteger(index)) return;
                const hole = courseRef.current.holes.find((item: any) => item.id === holeId);
                const center = hole?.fairway?.[index];
                if (!center) return;
                event.preventDefault();
                map.dragPan.disable();
                map.getCanvas().style.cursor = "ew-resize";

                const setWidthLabel = (lng: number, lat: number, halfWidth: number) => {
                    (map.getSource("fairway-width-label-source") as mapboxgl.GeoJSONSource).setData({
                        type: "FeatureCollection",
                        features: [{
                            type: "Feature",
                            properties: { label: `${Math.round(halfWidth * 2)} m` },
                            geometry: { type: "Point", coordinates: [lng, lat] },
                        }],
                    });
                };
                const clearWidthLabel = () => {
                    (map.getSource("fairway-width-label-source") as mapboxgl.GeoJSONSource).setData({
                        type: "FeatureCollection",
                        features: [],
                    });
                };

                const updateWidth = (moveEvent: mapboxgl.MapMouseEvent) => {
                    const width = Math.max(1, Math.min(100, fairwayDistanceMeters(
                        center,
                        { lng: moveEvent.lngLat.lng, lat: moveEvent.lngLat.lat },
                    )));
                    onSetFairwayPointWidth(holeId, index, width);
                    setWidthLabel(moveEvent.lngLat.lng, moveEvent.lngLat.lat, width);
                };
                const initialWidth = fairwayDistanceMeters(center, {
                    lng: event.lngLat.lng,
                    lat: event.lngLat.lat,
                });
                setWidthLabel(event.lngLat.lng, event.lngLat.lat, initialWidth);
                const onUp = (upEvent: mapboxgl.MapMouseEvent) => {
                    updateWidth(upEvent);
                    clearWidthLabel();
                    map.dragPan.enable();
                    map.getCanvas().style.cursor = "";
                    map.off("mousemove", updateWidth);
                    map.off("mouseup", onUp);
                };
                map.on("mousemove", updateWidth);
                map.on("mouseup", onUp);
            });

            map.on("mousedown", "hole-feature-vertex-layer", (event) => {
                const featureId = event.features?.[0]?.properties?.featureId;
                const vertexIndex = Number(event.features?.[0]?.properties?.vertexIndex);
                if (typeof featureId !== "string" || !Number.isInteger(vertexIndex)) return;
                event.preventDefault();
                map.dragPan.disable();
                map.getCanvas().style.cursor = "grabbing";
                const onMove = (moveEvent: mapboxgl.MapMouseEvent) => {
                    onMoveFeatureVertex(featureId, vertexIndex, moveEvent.lngLat.lng, moveEvent.lngLat.lat, false);
                };
                const onUp = (upEvent: mapboxgl.MapMouseEvent) => {
                    map.dragPan.enable();
                    map.getCanvas().style.cursor = "";
                    map.off("mousemove", onMove);
                    map.off("mouseup", onUp);
                    onMoveFeatureVertex(featureId, vertexIndex, upEvent.lngLat.lng, upEvent.lngLat.lat, true);
                };
                map.on("mousemove", onMove);
                map.on("mouseup", onUp);
            });

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

                }
            });

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

                // ⭐ Disable map panning while dragging
                map.dragPan.disable();
                map.getCanvas().style.cursor = "grabbing";

                const onMove = (ev: mapboxgl.MapMouseEvent) => {
                    const lng = ev.lngLat.lng;
                    const lat = ev.lngLat.lat;
                    onMoveFairwayPoint(holeId, index, lng, lat);
                };

                const onUp = () => {
                    map.dragPan.enable();   // ⭐ Re-enable panning
                    map.getCanvas().style.cursor = "";
                    map.off("mousemove", onMove);
                    map.off("mouseup", onUp);
                };

                map.on("mousemove", onMove);
                map.on("mouseup", onUp);
            });

            map.on("mousedown", (e) => {
                const features = map.queryRenderedFeatures(e.point, {
                    layers: ["tee-layer"],
                });

                const hit = features[0];
                if (!hit) return;

                const holeId = hit.properties?.holeId;
                if (!holeId) return;

                map.dragPan.disable();
                map.getCanvas().style.cursor = "grabbing";

                const onMove = (ev: mapboxgl.MapMouseEvent) => {
                    const lng = ev.lngLat.lng;
                    const lat = ev.lngLat.lat;
                    onSetTee(holeId, lng, lat);
                };

                const onUp = () => {
                    map.dragPan.enable();
                    map.getCanvas().style.cursor = "";
                    map.off("mousemove", onMove);
                    map.off("mouseup", onUp);
                };

                map.on("mousemove", onMove);
                map.on("mouseup", onUp);
            });

            map.on("mousedown", (e) => {
                const features = map.queryRenderedFeatures(e.point, {
                    layers: ["basket-layer"],
                });

                const hit = features[0];
                if (!hit) return;

                const holeId = hit.properties?.holeId;
                if (!holeId) return;

                map.dragPan.disable();
                map.getCanvas().style.cursor = "grabbing";

                const onMove = (ev: mapboxgl.MapMouseEvent) => {
                    const lng = ev.lngLat.lng;
                    const lat = ev.lngLat.lat;
                    onSetBasket(holeId, lng, lat);
                };

                const onUp = () => {
                    map.dragPan.enable();
                    map.getCanvas().style.cursor = "";
                    map.off("mousemove", onMove);
                    map.off("mouseup", onUp);
                };

                map.on("mousemove", onMove);
                map.on("mouseup", onUp);
            });

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
            });
        });

        return () => map.remove();
    }, []);

    useEffect(() => {
        updatePointsRef.current();
    }, [course, drawingCoordinates, selectedFeatureId]);

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

        // ⭐ SAFE AREA ZOOM
        map.fitBounds(bounds, {
            padding: {
                top: 120,     // hull-list overlay
                bottom: 80,
                right: 20,
                left: 140,   // flytende panel safe area
            },
            duration: 600,
        });
    }, [selectedHoleId]);


    return (
        <div
            ref={ref}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
            }}
        />
    );
}
