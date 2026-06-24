"use client";

import type { Feature, Point } from "geojson";
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
    const updatePointsRef = useRef<() => void>(() => { });

    // ⭐ NEW: refs for live state
    const selectedHoleRef = useRef<string | null>(null);
    const modeRef = useRef<EditorMode>("none");

    // keep refs updated
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

            // UPDATE POINTS FUNCTION
            const updatePoints = () => {
                const teeFeatures: Feature<Point>[] = [];
                const basketFeatures: Feature<Point>[] = [];
                const fairwayFeatures: Feature<Point>[] = [];

                course.holes.forEach((hole: any) => {
                    if (hole.tee_latitude && hole.tee_longitude) {
                        teeFeatures.push({
                            type: "Feature",
                            properties: {},
                            geometry: {
                                type: "Point",
                                coordinates: [hole.tee_longitude, hole.tee_latitude],
                            },
                        });
                    }

                    if (hole.basket_latitude && hole.basket_longitude) {
                        basketFeatures.push({
                            type: "Feature",
                            properties: {},
                            geometry: {
                                type: "Point",
                                coordinates: [hole.basket_longitude, hole.basket_latitude],
                            },
                        });
                    }

                    (hole.fairway_points ?? []).forEach((p: any) => {
                        fairwayFeatures.push({
                            type: "Feature",
                            properties: {},
                            geometry: {
                                type: "Point",
                                coordinates: [p.lng, p.lat],
                            },
                        });
                    });
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
            };

            updatePointsRef.current = updatePoints;
            updatePoints();

            // ⭐ CLICK LOGIC — now uses refs (LIVE state)
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

    // ZOOM TO COURSE WHEN LOADED
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!course || !course.holes) return;

        const coords = course.holes.flatMap((h: any) => {
            if (
                h.tee_latitude == null ||
                h.tee_longitude == null ||
                h.basket_latitude == null ||
                h.basket_longitude == null
            ) {
                return [];
            }

            return [
                [h.tee_longitude, h.tee_latitude],
                [h.basket_longitude, h.basket_latitude],
            ];
        });

        if (coords.length === 0) return;

        const bounds = coords.reduce(
            (b: any, c: any) => b.extend(c),
            new mapboxgl.LngLatBounds(coords[0], coords[0])
        );

        map.fitBounds(bounds, { padding: 80, duration: 800 });
    }, [course]);

    return (
        <div className="w-full h-full">
            <div ref={ref} className="w-full h-full" />
        </div>
    );
}
