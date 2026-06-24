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

        map.on("load", () => console.log("MINIMAL MAP LOADED"));

        return () => map.remove();
    }, []);

    return (
        <div className="flex flex-col min-h-screen bg-slate-900">

            {/* HEADER */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-4 text-slate-100">
                Minimal Create-Course Test
            </div>

            {/* MAP AREA */}
            <div className="flex-1 min-h-0 relative">
                <div ref={ref} className="absolute inset-0" />
            </div>
        </div>
    );
}
