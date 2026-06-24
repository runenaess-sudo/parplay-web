import { create } from "zustand";

type EditorMode = "none" | "tee" | "basket" | "points";

type CourseEditorState = {
    course: any | null;
    selectedHoleId: string | null;
    mode: EditorMode;

    loadAll: (courseData: any) => void;
    setSelectedHole: (holeId: string) => void;
    setMode: (mode: EditorMode) => void;

    setTee: (holeId: string, lng: number, lat: number) => void;
    setBasket: (holeId: string, lng: number, lat: number) => void;

    addFairwayPoint: (holeId: string, lng: number, lat: number) => void;
    moveFairwayPoint: (holeId: string, index: number, lng: number, lat: number) => void;
    removeFairwayPoint: (holeId: string, index: number) => void;

    setTeeAngle: (holeId: string, angle: number) => void;
};

export const useCourseEditor = create<CourseEditorState>((set, get) => ({
    course: null,
    selectedHoleId: null,
    mode: "none",

    loadAll: (courseData: any) => {
        set({
            course: courseData,
            selectedHoleId: courseData.holes[0]?.id ?? null,
        });
    },

    setSelectedHole: (holeId) => set({ selectedHoleId: holeId }),

    setMode: (mode) => set({ mode }),

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
            h.id === holeId
                ? { ...h, tee_angle: angle }
                : h
        );

        set({ course: { ...course, holes } });
    },
}));
