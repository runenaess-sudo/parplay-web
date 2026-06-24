"use client";

import { createClient } from "@supabase/supabase-js";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

// GeoJSON typer
import type { Feature, LineString, Point } from "geojson";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function MapCanvas() {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!ref.current) return;

        const map = new mapboxgl.Map({
            container: ref.current,
            style: "mapbox://styles/mapbox/satellite-streets-v12",
            center: [10.5, 60.0],
            zoom: 14,
        });

        map.on("load", async () => {
            console.log("EDITOR MAP LOADED");

            // 1. Hent bane + hull
            const { data: course, error } = await supabase
                .from("courses")
                .select("*, holes(*)")
                .eq("id", "5ad7fc02-778b-4bf8-a93b-3cb2514cc081")
                .single();

            if (error) {
                console.error("Feil ved henting av bane:", error);
                return;
            }

            console.log("EDITOR BANEDATA:", course);
            console.log("EDITOR HOLES:", course.holes);

            // 2. Last inn ikonene dine
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

            // 3. Opprett sources
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

            // 4. Layers for ikonene
            map.addLayer({
                id: "tee-layer",
                type: "symbol",
                source: "tee-source",
                layout: {
                    "icon-image": "teepad-icon",
                    "icon-size": 0.5,
                    "icon-anchor": "bottom",
                },
            });

            map.addLayer({
                id: "basket-layer",
                type: "symbol",
                source: "basket-source",
                layout: {
                    "icon-image": "basket-icon",
                    "icon-size": 0.5,
                    "icon-anchor": "bottom",
                },
            });

            map.addLayer({
                id: "fairway-layer",
                type: "symbol",
                source: "fairway-source",
                layout: {
                    "icon-image": "point-icon",
                    "icon-size": 0.4,
                    "icon-anchor": "center",
                },
            });

            // 5. Hull-linjer
            course.holes.forEach((hole: any) => {
                if (
                    hole.tee_latitude == null ||
                    hole.tee_longitude == null ||
                    hole.basket_latitude == null ||
                    hole.basket_longitude == null
                ) {
                    console.warn("Hull mangler koordinater:", hole);
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

                const id = `hole-${hole.number}`;

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
                        "line-width": 4,
                    },
                });
            });

            // 6. Tee + basket + fairway
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

            // 7. Zoom til banen
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

            if (coords.length > 0) {
                const bounds = coords.reduce(
                    (b: any, c: any) => b.extend(c),
                    new mapboxgl.LngLatBounds(coords[0], coords[0])
                );

                map.fitBounds(bounds, { padding: 80 });
            }
        });

        return () => map.remove();
    }, []);

    return (
        <div className="w-full h-full">
            <div ref={ref} className="w-full h-full" />
        </div>
    );
}
