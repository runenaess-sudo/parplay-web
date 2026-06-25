import { supabaseBrowser } from "@/src/lib/supabase-browser";
import { getElevation } from "@/src/utils/elevation";
import { calculateHoleLength } from "@/src/utils/holeLength";
import { create } from "zustand";

type EditorMode = "none" | "tee" | "basket" | "points";

type CourseEditorState = {
    course: any | null;
    selectedHoleId: string | null;
    mode: EditorMode;

    toast: string | null;
    setToast: (msg: string) => void;
    clearToast: () => void;

    loadAll: (courseData: any) => void;
    setSelectedHole: (holeId: string) => void;
    setMode: (mode: EditorMode) => void;

    setTee: (holeId: string, lng: number, lat: number) => void;
    setBasket: (holeId: string, lng: number, lat: number) => void;

    addFairwayPoint: (holeId: string, lng: number, lat: number) => void;
    moveFairwayPoint: (holeId: string, index: number, lng: number, lat: number) => void;
    removeFairwayPoint: (holeId: string, index: number) => void;

    setTeeAngle: (holeId: string, angle: number) => void;

    saveHole: (holeId: string) => Promise<void>;
};

export const useCourseEditor = create<CourseEditorState>((set, get) => ({
    course: null,
    selectedHoleId: null,
    mode: "none",

    toast: null,
    setToast: (msg) => set({ toast: msg }),
    clearToast: () => set({ toast: null }),

    loadAll: (courseData: any) => {
        set({
            course: courseData,
            selectedHoleId: courseData.holes[0]?.id ?? null,
        });
    },

    // ⭐ AUTO‑SAVE når du bytter hull
    setSelectedHole: async (holeId) => {
        const prevHoleId = get().selectedHoleId;

        if (prevHoleId && prevHoleId !== holeId) {
            await get().saveHole(prevHoleId);
        }

        set({ selectedHoleId: holeId });
    },

    // ⭐ AUTO‑SAVE når du går til "none"
    setMode: async (mode) => {
        const prevMode = get().mode;
        const holeId = get().selectedHoleId;

        if (prevMode !== "none" && mode === "none" && holeId) {
            await get().saveHole(holeId);
        }

        set({ mode });
    },

    setTee: (holeId, lng, lat) => {
        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId ? { ...h, tee_longitude: lng, tee_latitude: lat } : h
        );

        set({ course: { ...course, holes } });
    },

    setBasket: (holeId, lng, lat) => {
        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId ? { ...h, basket_longitude: lng, basket_latitude: lat } : h
        );

        set({ course: { ...course, holes } });
    },

    addFairwayPoint: (holeId, lng, lat) => {
        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId
                ? {
                    ...h,
                    fairway_points: [...(h.fairway_points ?? []), { lng, lat }],
                }
                : h
        );

        set({ course: { ...course, holes } });
    },

    moveFairwayPoint: (holeId, index, lng, lat) => {
        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) => {
            if (h.id !== holeId) return h;
            const points = [...(h.fairway_points ?? [])];
            if (!points[index]) return h;
            points[index] = { lng, lat };
            return { ...h, fairway_points: points };
        });

        set({ course: { ...course, holes } });
    },

    removeFairwayPoint: (holeId, index) => {
        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) => {
            if (h.id !== holeId) return h;
            const points = [...(h.fairway_points ?? [])];
            if (!points[index]) return h;
            points.splice(index, 1);
            return { ...h, fairway_points: points };
        });

        set({ course: { ...course, holes } });
    },

    setTeeAngle: (holeId, angle) => {
        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId ? { ...h, tee_angle: angle } : h
        );

        set({ course: { ...course, holes } });
    },

    // ⭐ FULL SAVE FUNCTION (Elevation + Length + Supabase + Toast)
    saveHole: async (holeId: string) => {
        const { course } = get();
        if (!course) return;

        const hole = course.holes.find((h: any) => h.id === holeId);
        if (!hole) return;

        const teeElevation =
            hole.tee_latitude && hole.tee_longitude
                ? await getElevation(hole.tee_latitude, hole.tee_longitude)
                : null;

        const basketElevation =
            hole.basket_latitude && hole.basket_longitude
                ? await getElevation(hole.basket_latitude, hole.basket_longitude)
                : null;

        const fairwayPoints = await Promise.all(
            (hole.fairway_points ?? []).map(async (p: any) => ({
                ...p,
                elevation: await getElevation(p.lat, p.lng),
            }))
        );

        const lineCoords: [number, number][] = [];
        if (hole.tee_latitude) lineCoords.push([hole.tee_longitude, hole.tee_latitude]);
        fairwayPoints.forEach((p) => lineCoords.push([p.lng, p.lat]));
        if (hole.basket_latitude) lineCoords.push([hole.basket_longitude, hole.basket_latitude]);

        const lengthMeters = calculateHoleLength(lineCoords);

        const { error } = await supabaseBrowser
            .from("holes")
            .update({
                tee_latitude: hole.tee_latitude,
                tee_longitude: hole.tee_longitude,
                tee_elevation: teeElevation,
                tee_angle: hole.tee_angle ?? 0,

                basket_latitude: hole.basket_latitude,
                basket_longitude: hole.basket_longitude,
                basket_elevation: basketElevation,

                fairway_points: fairwayPoints,
                length_meters: lengthMeters,
            })
            .eq("id", holeId);

        if (error) {
            console.error("Save hole error:", error);
            get().setToast("Error saving hole");
            return;
        }

        get().setToast("Hole saved");
    },
}));
