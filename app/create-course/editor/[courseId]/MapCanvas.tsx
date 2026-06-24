"use client";

import { useCourseEditor } from "@/src/state/useCourseEditor";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export function MapCanvas() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    const holes = useCourseEditor((s) => s.holes);
    const selectedHoleId = useCourseEditor((s) => s.selectedHoleId);
    const mapMode = useCourseEditor((s) => s.mapMode);
    const selectedFairwayIndex = useCourseEditor((s) => s.selectedFairwayIndex);

    const selectedHole = holes.find((h) => h.id === selectedHoleId) || null;

    // INIT MAP (kun én gang)
    useEffect(() => {
        if (!mapContainer.current) return;
        if (mapRef.current) return;

        const map = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/satellite-streets-v12",
            center: [10.5, 60.0],
            zoom: 16,
        });

        mapRef.current = map;

        map.on("load", () => {
            console.log("MAP LOADED");
        });

        // ⭐ Cleanup MÅ være i blokk, ellers får du TS-feilen
        return () => {
            map.remove();
        };
    }, []);

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
        if (!map || !selectedHole) return;

        const teeSource = map.getSource("tee-source") as mapboxgl.GeoJSONSource | undefined;
        const basketSource = map.getSource("basket-source") as mapboxgl.GeoJSONSource | undefined;
        const fairwaySource = map.getSource("fairway-source") as mapboxgl.GeoJSONSource | undefined;
        const polySource = map.getSource("fairway-polygon-source") as mapboxgl.GeoJSONSource | undefined;

        // Tee
        if (teeSource) {
            teeSource.setData({
                type: "FeatureCollection",
                features: selectedHole.tee
                    ? [
                        {
                            type: "Feature",
                            geometry: {
                                type: "Point",
                                coordinates: [selectedHole.tee.lng, selectedHole.tee.lat],
                            },
                        },
                    ]
                    : [],
            });
        }

        // Basket
        if (basketSource) {
            basketSource.setData({
                type: "FeatureCollection",
                features: selectedHole.basket
                    ? [
                        {
                            type: "Feature",
                            geometry: {
                                type: "Point",
                                coordinates: [selectedHole.basket.lng, selectedHole.basket.lat],
                            },
                        },
                    ]
                    : [],
            });
        }

        // Fairway points
        if (fairwaySource) {
            fairwaySource.setData({
                type: "FeatureCollection",
                features: (selectedHole.fairway ?? []).map((p, index) => ({
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [p.lng, p.lat],
                    },
                    properties: { index },
                })),
            });
        }

        // Polygon
        if (polySource) {
            const fairway = selectedHole.fairway ?? [];
            polySource.setData({
                type: "FeatureCollection",
                features:
                    fairway.length >= 3
                        ? [
                            {
                                type: "Feature",
                                geometry: {
                                    type: "Polygon",
                                    coordinates: [fairway.map((p) => [p.lng, p.lat])],
                                },
                            },
                        ]
                        : [],
            });
        }

        // Autozoom
        const coords: [number, number][] = [];

        if (selectedHole.tee) coords.push([selectedHole.tee.lng, selectedHole.tee.lat]);
        if (selectedHole.basket) coords.push([selectedHole.basket.lng, selectedHole.basket.lat]);
        (selectedHole.fairway ?? []).forEach((p) => coords.push([p.lng, p.lat]));

        if (coords.length > 0) {
            const bounds = coords.reduce(
                (b, c) => b.extend(c),
                new mapboxgl.LngLatBounds(coords[0], coords[0])
            );

            map.fitBounds(bounds, { padding: 80, duration: 300 });
        }
    }, [selectedHole, selectedFairwayIndex]);

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainer} className="absolute inset-0" />
        </div>
    );
}
