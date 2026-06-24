// src/state/useCourseEditor.ts
import { create } from "zustand";

type EditorMode = "none" | "tee" | "basket" | "fairway";

type CourseEditorState = {
    course: any | null;
    selectedHoleId: string | null;
    mode: EditorMode;

    // actions
    loadAll: (courseId: string) => Promise<void>;
    setSelectedHole: (holeId: string) => void;
    setMode: (mode: EditorMode) => void;

    setTee: (holeId: string, lng: number, lat: number) => void;
    setBasket: (holeId: string, lng: number, lat: number) => void;
    addFairwayPoint: (holeId: string, lng: number, lat: number) => void;
};

export const useCourseEditor = create<CourseEditorState>((set, get) => ({
    course: null,
    selectedHoleId: null,
    mode: "none",

    // 1. Last inn hele banen
    loadAll: async (courseId: string) => {
        const res = await fetch(`/api/editor/course/${courseId}`);
        const data = await res.json();

        set({
            course: data,
            selectedHoleId: data.holes[0]?.id ?? null,
        });
    },

    // 2. Velg hull
    setSelectedHole: (holeId) => set({ selectedHoleId: holeId }),

    // 3. Sett modus (tee, basket, fairway)
    setMode: (mode) => set({ mode }),

    // 4. Sett tee-posisjon
    setTee: (holeId, lng, lat) => {
        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId
                ? { ...h, tee_longitude: lng, tee_latitude: lat }
                : h
        );

        set({ course: { ...course, holes } });
    },

    // 5. Sett basket-posisjon
    setBasket: (holeId, lng, lat) => {
        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId
                ? { ...h, basket_longitude: lng, basket_latitude: lat }
                : h
        );

        set({ course: { ...course, holes } });
    },

    // 6. Legg til fairway-punkt
    addFairwayPoint: (holeId, lng, lat) => {
        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId
                ? {
                    ...h,
                    fairway_points: [
                        ...(h.fairway_points ?? []),
                        { lng, lat },
                    ],
                }
                : h
        );

        set({ course: { ...course, holes } });
    },
}));
