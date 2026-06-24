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

export default function Page() {
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
            console.log("MAP-TEST LOADED");

            // 1. Hent banen
            const { data: course, error } = await supabase
                .from("courses")
                .select("*, holes(*)")
                .eq("id", "5ad7fc02-778b-4bf8-a93b-3cb2514cc081")
                .single();

            if (error) {
                console.error("Feil ved henting av bane:", error);
                return;
            }

            console.log("BANEDATA:", course);

            // 2. Tegn hullene
            course.holes.forEach((hole: any) => {
                if (!hole.tee_lat || !hole.tee_lng || !hole.basket_lat || !hole.basket_lng) return;

                const line = {
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [
                            [hole.tee_lng, hole.tee_lat],
                            [hole.basket_lng, hole.basket_lat],
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

            console.log("HOLES:", course.holes);


            // 3. Zoom til banen
            const coords = course.holes.flatMap((h: any) => [
                [h.tee_lng, h.tee_lat],
                [h.basket_lng, h.basket_lat],
            ]);

            const bounds = coords.reduce(
                (b: any, c: any) => b.extend(c),
                new mapboxgl.LngLatBounds(coords[0], coords[0])
            );

            map.fitBounds(bounds, { padding: 80 });
        });

        return () => map.remove();
    }, []);

    return (
        <div style={{ width: "100vw", height: "100vh" }}>
            <div ref={ref} style={{ width: "100%", height: "100%" }} />
        </div>
    );
}
