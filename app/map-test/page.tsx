"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

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

        map.on("load", () => console.log("TEST MAP LOADED"));

        return () => map.remove();
    }, []);

    return (
        <div style={{ width: "100vw", height: "100vh" }}>
            <div ref={ref} style={{ width: "100%", height: "100%" }} />
        </div>
    );
}
