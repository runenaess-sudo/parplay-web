// app/courses/editor/[courseId]/MapCanvas.tsx
"use client";

import { useCourseEditor } from "@/src/state/useCourseEditor";
import { useEffect, useRef } from "react";

// Minimal Feature types
type PointFeature = {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties?: Record<string, any>;
};

type PolygonFeature = {
    type: "Feature";
    geometry: { type: "Polygon"; coordinates: [number[][]] };
    properties?: Record<string, any>;
};

export function MapCanvas() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const mapboxRef = useRef<null | typeof import("mapbox-gl")>(null);
    const holes = useCourseEditor((s) => s.holes);
    const selectedHoleId = useCourseEditor((s) => s.selectedHoleId);
    const mapMode = useCourseEditor((s) => s.mapMode);
    const selectedFairwayIndex = useCourseEditor((s) => s.selectedFairwayIndex);
    const setSelectedFairwayIndex = useCourseEditor((s) => s.setSelectedFairwayIndex);

    const selectedHole = holes.find((h) => h.id === selectedHoleId) || null;

    // INIT MAP (lazy import av mapbox-gl)
    useEffect(() => {
        if (!mapContainer.current) return;

        let isCancelled = false;

        async function init() {
            const mod = await import("mapbox-gl");
            mapboxRef.current = mod; // hele modulen
            const mapboxgl = mod.default;

            mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

            if (!mapContainer.current || isCancelled) return;

            const map = new mapboxgl.Map({
                container: mapContainer.current,
                style: "mapbox://styles/mapbox/satellite-streets-v12",
                center: [10.5, 60.0],
                zoom: 13,
            });

            mapRef.current = map;

            map.on("load", () => {
                map.loadImage("/icons/teepad.png", (err, image) => {
                    if (!err && image && !map.hasImage("teepad")) {
                        map.addImage("teepad", image);
                    }
                });

                map.loadImage("/icons/basket_hvit.png", (err, image) => {
                    if (!err && image && !map.hasImage("basket")) {
                        map.addImage("basket", image);
                    }
                });

                map.loadImage("/icons/point.png", (err, image) => {
                    if (!err && image && !map.hasImage("fairway-point")) {
                        map.addImage("fairway-point", image);
                    }
                });

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

                map.addSource("fairway-polygon-source", {
                    type: "geojson",
                    data: { type: "FeatureCollection", features: [] },
                });

                map.addLayer({
                    id: "tee-layer",
                    type: "symbol",
                    source: "tee-source",
                    layout: {
                        "icon-image": "teepad",
                        "icon-size": 0.5,
                        "icon-anchor": "bottom",
                    },
                });

                map.addLayer({
                    id: "basket-layer",
                    type: "symbol",
                    source: "basket-source",
                    layout: {
                        "icon-image": "basket",
                        "icon-size": 0.5,
                        "icon-anchor": "bottom",
                    },
                });

                map.addLayer({
                    id: "fairway-points-layer",
                    type: "symbol",
                    source: "fairway-source",
                    layout: {
                        "icon-image": "fairway-point",
                        "icon-size": 0.4,
                        "icon-anchor": "center",
                    },
                });

                map.addLayer({
                    id: "fairway-polygon-fill",
                    type: "fill",
                    source: "fairway-polygon-source",
                    paint: {
                        "fill-color": "#00ff00",
                        "fill-opacity": 0.25,
                    },
                });

                map.addLayer({
                    id: "fairway-polygon-outline",
                    type: "line",
                    source: "fairway-polygon-source",
                    paint: {
                        "line-color": "#00ff00",
                        "line-width": 2,
                    },
                });

                // SELECT FAIRWAY POINT
                map.on("click", "fairway-points-layer", (e) => {
                    if (mapMode !== "edit-fairway") return;

                    const feature = e.features?.[0] as any;
                    if (!feature) return;

                    const index = feature.properties?.index;
                    if (typeof index === "number") {
                        setSelectedFairwayIndex(index);
                    }
                });

                // DRAG FAIRWAY POINTS
                let isDragging = false;

                map.on("mousedown", "fairway-points-layer", (e) => {
                    if (mapMode !== "edit-fairway") return;
                    if (!selectedHole) return;

                    const feature = e.features?.[0] as any;
                    if (!feature) return;

                    const index = feature.properties?.index;
                    if (typeof index !== "number") return;

                    setSelectedFairwayIndex(index);
                    isDragging = true;
                    map.getCanvas().style.cursor = "grabbing";
                });

                map.on("mousemove", (e) => {
                    if (!isDragging || selectedFairwayIndex === null || !selectedHole) return;

                    const lng = e.lngLat.lng;
                    const lat = e.lngLat.lat;

                    selectedHole.fairway![selectedFairwayIndex] = { lng, lat };
                });

                map.on("mouseup", () => {
                    isDragging = false;
                    map.getCanvas().style.cursor = "";
                });
            });
        }

        init();

        return () => {
            isCancelled = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [mapMode, selectedHole, selectedFairwayIndex, setSelectedFairwayIndex]);

    // HANDLE MAP CLICKS
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const handleClick = (e: mapboxgl.MapMouseEvent) => {
            if (!selectedHole) return;

            const lng = e.lngLat.lng;
            const lat = e.lngLat.lat;

            if (mapMode === "set-tee") selectedHole.tee = { lng, lat };
            if (mapMode === "set-basket") selectedHole.basket = { lng, lat };

            if (mapMode === "add-fairway") {
                if (!selectedHole.fairway) selectedHole.fairway = [];
                selectedHole.fairway.push({ lng, lat });
            }
        };

        map.on("click", handleClick);

        return () => {
            map.off("click", handleClick);
        };
    }, [mapMode, selectedHole]);

    // UPDATE ICONS + POLYGON + AUTOZOOM
    useEffect(() => {
        const map = mapRef.current;
        const mapboxgl = mapboxRef.current;
        if (!map || !selectedHole || !mapboxgl) return;

        // Tee
        const teeFeature: PointFeature | null = selectedHole.tee
            ? {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [selectedHole.tee.lng, selectedHole.tee.lat],
                },
            }
            : null;

        (map.getSource("tee-source") as mapboxgl.GeoJSONSource)?.setData({
            type: "FeatureCollection",
            features: teeFeature ? [teeFeature] : [],
        });

        // Basket
        const basketFeature: PointFeature | null = selectedHole.basket
            ? {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [selectedHole.basket.lng, selectedHole.basket.lat],
                },
            }
            : null;

        (map.getSource("basket-source") as mapboxgl.GeoJSONSource)?.setData({
            type: "FeatureCollection",
            features: basketFeature ? [basketFeature] : [],
        });

        // Fairway points
        const fairway = selectedHole.fairway ?? [];

        const fairwayPoints: PointFeature[] = fairway.map((p, index) => ({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [p.lng, p.lat],
            },
            properties: { index },
        }));

        (map.getSource("fairway-source") as mapboxgl.GeoJSONSource)?.setData({
            type: "FeatureCollection",
            features: fairwayPoints,
        });

        // FAIRWAY POLYGON
        const polygon: PolygonFeature[] =
            fairway.length >= 3
                ? [
                    {
                        type: "Feature",
                        geometry: {
                            type: "Polygon",
                            coordinates: [fairway.map((p) => [p.lng, p.lat])],
                        },
                        properties: {},
                    },
                ]
                : [];

        (map.getSource("fairway-polygon-source") as mapboxgl.GeoJSONSource)?.setData({
            type: "FeatureCollection",
            features: polygon,
        });

        // AUTO-ZOOM
        const coords: [number, number][] = [];

        if (selectedHole.tee) coords.push([selectedHole.tee.lng, selectedHole.tee.lat]);
        if (selectedHole.basket)
            coords.push([selectedHole.basket.lng, selectedHole.basket.lat]);

        fairway.forEach((p) => coords.push([p.lng, p.lat]));

        if (coords.length > 0) {
            const bounds = coords.reduce(
                (b, c) => b.extend(c),
                new mapboxgl.LngLatBounds(coords[0], coords[0])
            );

            map.fitBounds(bounds, { padding: 80, duration: 300 });
        }
    }, [selectedHole, selectedFairwayIndex]);

    return <div ref={mapContainer} className="absolute inset-0" />;
}
