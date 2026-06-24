"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export function MapCanvas() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        if (!mapContainer.current) return;
        if (mapRef.current) return; // ikke init flere ganger

        const map = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/satellite-streets-v12",
            center: [10.5, 60.0],
            zoom: 16,
        });

        mapRef.current = map;
        (window as any).__map = map;

        map.on("load", () => {
            console.log("MAP LOADED, isStyleLoaded:", map.isStyleLoaded());
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    return (
        <div className="relative flex-1 min-h-0">
            <div ref={mapContainer} className="absolute inset-0" />
        </div>
    );
}
