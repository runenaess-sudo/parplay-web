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
        console.log("LOAD ALL COURSE DATA:", courseData);
        set({
            course: courseData,
            selectedHoleId: courseData.holes[0]?.id ?? null,
        });
    },

    // ⭐ AUTO‑SAVE når du bytter hull
    setSelectedHole: async (holeId) => {
        const prevHoleId = get().selectedHoleId;

        console.log("SET SELECTED HOLE:", { prevHoleId, newHoleId: holeId });

        if (prevHoleId && prevHoleId !== holeId) {
            console.log("AUTO‑SAVE TRIGGERED (hole switch)");
            await get().saveHole(prevHoleId);
        }

        set({ selectedHoleId: holeId });
    },

    // ⭐ AUTO‑SAVE når du går til "none"
    setMode: async (mode) => {
        const prevMode = get().mode;
        const holeId = get().selectedHoleId;

        console.log("SET MODE:", { prevMode, newMode: mode });

        if (prevMode !== "none" && mode === "none" && holeId) {
            console.log("AUTO‑SAVE TRIGGERED (mode → none)");
            await get().saveHole(holeId);
        }

        set({ mode });
    },

    setTee: (holeId, lng, lat) => {
        console.log("SET TEE:", { holeId, lng, lat });

        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId ? { ...h, tee_longitude: lng, tee_latitude: lat } : h
        );

        set({ course: { ...course, holes } });
    },

    setBasket: (holeId, lng, lat) => {
        console.log("SET BASKET:", { holeId, lng, lat });

        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId ? { ...h, basket_longitude: lng, basket_latitude: lat } : h
        );

        set({ course: { ...course, holes } });
    },

    addFairwayPoint: (holeId, lng, lat) => {
        console.log("ADD FAIRWAY POINT:", { holeId, lng, lat });

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
        console.log("MOVE FAIRWAY POINT:", { holeId, index, lng, lat });

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
        console.log("REMOVE FAIRWAY POINT:", { holeId, index });

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
        console.log("SET TEE ANGLE:", { holeId, angle });

        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId ? { ...h, tee_angle: angle } : h
        );

        set({ course: { ...course, holes } });
    },

    // ⭐ FULL SAVE FUNCTION (Elevation + Length + Supabase + Toast + Debug)
    saveHole: async (holeId: string) => {
        console.log("SAVE HOLE TRIGGERED:", holeId);

        const { course } = get();
        if (!course) {
            console.log("❌ No course loaded");
            return;
        }

        const hole = course.holes.find((h: any) => h.id === holeId);
        if (!hole) {
            console.log("❌ Hole not found in state");
            return;
        }

        console.log("HOLE BEFORE SAVE:", hole);

        // Elevation
        const teeElevation =
            hole.tee_latitude && hole.tee_longitude
                ? await getElevation(hole.tee_latitude, hole.tee_longitude)
                : null;

        const basketElevation =
            hole.basket_latitude && hole.basket_longitude
                ? await getElevation(hole.basket_latitude, hole.basket_longitude)
                : null;

        console.log("ELEVATION RESULTS:", {
            teeElevation,
            basketElevation,
        });

        const fairwayPoints = await Promise.all(
            (hole.fairway_points ?? []).map(async (p: any, i: number) => {
                const elev = await getElevation(p.lat, p.lng);
                console.log(`FAIRWAY POINT ${i} ELEVATION:`, elev);
                return { ...p, elevation: elev };
            })
        );

        // Length
        const lineCoords: [number, number][] = [];
        if (hole.tee_latitude) lineCoords.push([hole.tee_longitude, hole.tee_latitude]);
        fairwayPoints.forEach((p) => lineCoords.push([p.lng, p.lat]));
        if (hole.basket_latitude) lineCoords.push([hole.basket_longitude, hole.basket_latitude]);

        const lengthMeters = calculateHoleLength(lineCoords);

        console.log("LENGTH CALCULATED:", lengthMeters);

        // Supabase update payload
        const payload = {
            tee_latitude: hole.tee_latitude,
            tee_longitude: hole.tee_longitude,
            tee_elevation: teeElevation,
            tee_angle: hole.tee_angle ?? 0,

            basket_latitude: hole.basket_latitude,
            basket_longitude: hole.basket_longitude,
            basket_elevation: basketElevation,

            fairway_points: fairwayPoints,
            length_meters: lengthMeters,
        };

        console.log("SUPABASE UPDATE PAYLOAD:", payload);

        const { error } = await supabaseBrowser
            .from("holes")
            .update(payload)
            .eq("id", holeId);

        if (error) {
            console.log("❌ SUPABASE ERROR:", error);
            get().setToast("Error saving hole");
            return;
        }

        console.log("✅ HOLE SAVED SUCCESSFULLY");

        // ⭐ Oppdater local state slik at UI viser riktig data
        const updatedHole = {
            ...hole,
            tee_elevation: teeElevation,
            basket_elevation: basketElevation,
            fairway_points: fairwayPoints,
            length_meters: lengthMeters,
        };

        const updatedHoles = course.holes.map((h: any) =>
            h.id === holeId ? updatedHole : h
        );

        set({
            course: {
                ...course,
                holes: updatedHoles,
            },
        });

        get().setToast("Hole saved");
    },
}));
