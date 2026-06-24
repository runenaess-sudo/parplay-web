"use client";

import type { Feature, LineString, Point } from "geojson";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type EditorMode = "none" | "tee" | "basket" | "fairway";

type MapCanvasProps = {
    course: any;
    selectedHoleId: string | null;
    mode: EditorMode;
    onSetTee: (holeId: string, lng: number, lat: number) => void;
    onSetBasket: (holeId: string, lng: number, lat: number) => void;
    onAddFairwayPoint: (holeId: string, lng: number, lat: number) => void;
};

export function MapCanvas({
    course,
    selectedHoleId,
    mode,
    onSetTee,
    onSetBasket,
    onAddFairwayPoint,
}: MapCanvasProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    // LIVE REFS FOR STATE
    const courseRef = useRef<any>(course);
    const selectedHoleRef = useRef<string | null>(selectedHoleId);
    const modeRef = useRef<EditorMode>(mode);

    const updatePointsRef = useRef<() => void>(() => { });

    // keep refs updated
    useEffect(() => {
        courseRef.current = course;
    }, [course]);

    useEffect(() => {
        selectedHoleRef.current = selectedHoleId;
    }, [selectedHoleId]);

    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

    // INIT MAP — only once
    useEffect(() => {
        if (!ref.current) return;

        const map = new mapboxgl.Map({
            container: ref.current,
            style: "mapbox://styles/mapbox/satellite-v9",
            center: [10.5, 60.0],
            zoom: 14,
        });

        mapRef.current = map;

        map.on("load", () => {
            console.log("EDITOR MAP LOADED");

            // ICONS
            map.loadImage("/icons/teepad.png", (err, img) => {
                if (!err && img && !map.hasImage("teepad-icon")) {
                    map.addImage("teepad-icon", img);
                }
            });

            map.loadImage("/icons/basket_hvit.png", (err, img) => {
                if (!err && img && !map.hasImage("basket-icon")) {
                    map.addImage("basket-icon", img);
                }
            });

            map.loadImage("/icons/point.png", (err, img) => {
                if (!err && img && !map.hasImage("point-icon")) {
                    map.addImage("point-icon", img);
                }
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

            // fairway line (tee -> points -> basket)
            map.addSource("fairway-line-source", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            // LAYERS
            map.addLayer({
                id: "tee-layer",
                type: "symbol",
                source: "tee-source",
                layout: {
                    "icon-image": "teepad-icon",
                    "icon-size": 0.18,
                    "icon-anchor": "bottom",
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

            map.addLayer({
                id: "fairway-line-layer",
                type: "line",
                source: "fairway-line-source",
                paint: {
                    "line-color": "#00ff88",
                    "line-width": 3,
                },
            });

            // HOLE LINES (tee -> basket)
            const drawHoleLines = () => {
                courseRef.current.holes.forEach((hole: any) => {
                    const id = `hole-${hole.id}`;

                    if (map.getLayer(id)) {
                        map.removeLayer(id);
                    }
                    if (map.getSource(id)) {
                        map.removeSource(id);
                    }

                    if (
                        hole.tee_latitude == null ||
                        hole.tee_longitude == null ||
                        hole.basket_latitude == null ||
                        hole.basket_longitude == null
                    ) {
                        return;
                    }

                    const line: Feature<LineString> = {
                        type: "Feature",
                        properties: {},
                        geometry: {
                            type: "LineString",
                            coordinates: [
                                [hole.tee_longitude, hole.tee_latitude],
                                [hole.basket_longitude, hole.basket_latitude],
                            ],
                        },
                    };

                    map.addSource(id, {
                        type: "geojson",
                        data: line,
                    });

                    map.addLayer({
                        id,
                        type: "line",
                        source: id,
                        paint: {
                            "line-color": "#00ff88",
                            "line-width": 2,
                        },
                    });
                });
            };

            // UPDATE POINTS FUNCTION
            const updatePoints = () => {
                const teeFeatures: Feature<Point>[] = [];
                const basketFeatures: Feature<Point>[] = [];
                const fairwayFeatures: Feature<Point>[] = [];

                const fairwayLineFeatures: Feature<LineString>[] = [];

                courseRef.current.holes.forEach((hole: any) => {
                    // tee
                    if (hole.tee_latitude && hole.tee_longitude) {
                        teeFeatures.push({
                            type: "Feature",
                            properties: { holeId: hole.id },
                            geometry: {
                                type: "Point",
                                coordinates: [hole.tee_longitude, hole.tee_latitude],
                            },
                        });
                    }

                    // basket
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

                    // fairway points
                    (hole.fairway_points ?? []).forEach((p: any, idx: number) => {
                        fairwayFeatures.push({
                            type: "Feature",
                            properties: { holeId: hole.id, index: idx },
                            geometry: {
                                type: "Point",
                                coordinates: [p.lng, p.lat],
                            },
                        });
                    });

                    // fairway line: tee -> points -> basket
                    const lineCoords: [number, number][] = [];

                    if (hole.tee_latitude && hole.tee_longitude) {
                        lineCoords.push([hole.tee_longitude, hole.tee_latitude]);
                    }

                    (hole.fairway_points ?? []).forEach((p: any) => {
                        lineCoords.push([p.lng, p.lat]);
                    });

                    if (hole.basket_latitude && hole.basket_longitude) {
                        lineCoords.push([hole.basket_longitude, hole.basket_latitude]);
                    }

                    if (lineCoords.length >= 2) {
                        fairwayLineFeatures.push({
                            type: "Feature",
                            properties: { holeId: hole.id },
                            geometry: {
                                type: "LineString",
                                coordinates: lineCoords,
                            },
                        });
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

                drawHoleLines();
            };

            updatePointsRef.current = updatePoints;
            updatePoints();

            // CLICK LOGIC — uses LIVE refs, NO ZOOM
            map.on("click", (e) => {
                const holeId = selectedHoleRef.current;
                const currentMode = modeRef.current;

                if (!holeId) return;

                const lng = e.lngLat.lng;
                const lat = e.lngLat.lat;

                if (currentMode === "tee") onSetTee(holeId, lng, lat);
                if (currentMode === "basket") onSetBasket(holeId, lng, lat);
                if (currentMode === "fairway") onAddFairwayPoint(holeId, lng, lat);

                updatePointsRef.current();
            });
        });

        return () => map.remove();
    }, []);

    // UPDATE POINTS WHEN COURSE CHANGES
    useEffect(() => {
        updatePointsRef.current();
    }, [course]);

    // AUTOZOOM TO SELECTED HOLE (UDisc-style)
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

        (hole.fairway_points ?? []).forEach((p: any) => {
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
