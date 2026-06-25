export async function getElevation(lat: number, lng: number): Promise<number | null> {
    const z = 14; // zoom level for tile resolution
    const tile = lngLatToTile(lng, lat, z);

    const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${tile.x}/${tile.y}.pngraw?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;

    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);

        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ctx.drawImage(bitmap, 0, 0);
        const pixel = ctx.getImageData(tile.pixelX, tile.pixelY, 1, 1).data;

        const [R, G, B] = pixel;
        const elevation = -10000 + (R * 256 * 256 + G * 256 + B) * 0.1;

        return elevation;
    } catch {
        return null;
    }
}

function lngLatToTile(lng: number, lat: number, zoom: number) {
    const tileCount = 2 ** zoom;
    const x = Math.floor(((lng + 180) / 360) * tileCount);
    const y = Math.floor(
        ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
        tileCount
    );

    // pixel inside tile
    const pixelX = Math.floor(
        ((((lng + 180) / 360) * tileCount) - x) * 256
    );
    const pixelY = Math.floor(
        (((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
            tileCount - y) * 256
    );

    return { x, y, pixelX, pixelY };
}
