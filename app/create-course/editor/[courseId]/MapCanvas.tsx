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
        });

        return () => map.remove();
    }, []);

    return (
        <div className="w-full h-full">
            <div ref={ref} className="w-full h-full" />
        </div>
    );
}
