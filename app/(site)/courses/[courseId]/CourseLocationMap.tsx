"use client";

import { useEffect, useRef } from "react";

export function CourseLocationMap({ latitude, longitude, name }: {
    latitude: number;
    longitude: number;
    name: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let disposed = false;
        let map: import("mapbox-gl").Map | null = null;

        async function mountMap() {
            const mapboxgl = (await import("mapbox-gl")).default;
            if (disposed || !containerRef.current || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return;
            (mapboxgl as unknown as { accessToken: string }).accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
            map = new mapboxgl.Map({
                container: containerRef.current,
                style: "mapbox://styles/mapbox/dark-v11",
                center: [longitude, latitude],
                zoom: 11.5,
                interactive: false,
                attributionControl: false,
            });
            new mapboxgl.Marker({ color: "#60A5FA" })
                .setLngLat([longitude, latitude])
                .setPopup(new mapboxgl.Popup({ offset: 20 }).setText(name))
                .addTo(map);
        }

        void mountMap();
        return () => {
            disposed = true;
            map?.remove();
        };
    }, [latitude, longitude, name]);

    return <div ref={containerRef} aria-label={`Map showing ${name}`}
        className="h-40 w-full bg-slate-900" />;
}
