"use client";

import { createClient } from "@supabase/supabase-js";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

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
            style: "mapbox://styles/mapbox/streets-v12",
            center: [10.5, 60.0],
            zoom: 14,
        });

        map.on("load", async () => {
            console.log("EDITOR MAP LOADED");

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

            // 4. Zoom til banen
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

            // 5. Tegn hullene
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

                const line = {
                    type: "Feature",
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
        });

        return () => map.remove();
    }, []);

    return (
        <div className="w-full h-full">
            <div ref={ref} className="w-full h-full" />
        </div>
    );
}
