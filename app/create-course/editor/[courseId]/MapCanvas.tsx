"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

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

        console.log("EDITOR MAP LOADED");

        return () => map.remove();
    }, []);

    return (
        <div className="w-full h-full">
            <div ref={ref} className="w-full h-full" />
        </div>
    );
}
