// app/courses/editor/[courseId]/useCourseEditor.ts
"use client";

import { create } from "zustand";

// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------
export type Course = {
    id: string;
    name: string;
    description: string | null;
    club_id: string | null;
    status: string;
    is_published: boolean;
};

export type Hole = {
    id: string;
    course_id: string;
    number: number;
    par: number;
    distance: number | null;

    tee: { lng: number; lat: number } | null;
    basket: { lng: number; lat: number } | null;
    fairway: { lng: number; lat: number }[] | null;

    tee_rotation?: number;
    name?: string;
};

export type Layout = {
    id: string;
    course_id: string;
    name: string;
    description: string | null;
};

export type EditorTab =
    | "course"
    | "holes"
    | "hole-editor"
    | "layouts"
    | "facilities"
    | "directions"
    | "contact"
    | "events"
    | "images"
    | "publish";

export type MapMode =
    | "idle"
    | "set-tee"
    | "set-basket"
    | "edit-fairway"
    | "add-fairway"
    | "edit";

type CourseEditorState = {
    course: Course | null;
    holes: Hole[];
    layouts: Layout[];

    activeTab: EditorTab;
    selectedHoleId: string | null;
    selectedLayoutId: string | null;
    mapMode: MapMode;

    selectedFairwayIndex: number | null;

    loading: boolean;

    loadAll: (courseId: string) => Promise<void>;
    setActiveTab: (tab: EditorTab) => void;
    selectHole: (holeId: string | null) => void;
    selectLayout: (layoutId: string | null) => void;
    setMapMode: (mode: MapMode) => void;
    setSelectedFairwayIndex: (i: number | null) => void;
};

// lazy Supabase – kun i browser
async function getSupabase() {
    const mod = await import("@/src/lib/supabase-browser");
    return mod.supabaseBrowser;
}

export const useCourseEditor = create<CourseEditorState>()((set, get) => ({
    course: null,
    holes: [],
    layouts: [],
    activeTab: "course",
    selectedHoleId: null,
    selectedLayoutId: null,
    mapMode: "idle",
    selectedFairwayIndex: null,
    loading: false,

    loadAll: async (courseId: string) => {
        if (!courseId) return;

        set({ loading: true });

        try {
            const supabase = await getSupabase();

            const { data: course } = await supabase
                .from("courses")
                .select("*")
                .eq("id", courseId)
                .single();

            const { data: holes } = await supabase
                .from("holes")
                .select("*")
                .eq("course_id", courseId)
                .order("number", { ascending: true });

            const { data: layouts } = await supabase
                .from("course_layouts")
                .select("*")
                .eq("course_id", courseId)
                .order("name", { ascending: true });

            set({
                course: course || null,
                holes: holes || [],
                layouts: layouts || [],
                loading: false,
            });
        } catch (err) {
            console.error("Failed to load editor data", err);
            set({ loading: false });
        }
    },

    setActiveTab: (tab: EditorTab) => set({ activeTab: tab }),

    selectHole: (holeId: string | null) =>
        set({
            selectedHoleId: holeId,
            activeTab: holeId ? "hole-editor" : "holes",
        }),

    selectLayout: (layoutId: string | null) =>
        set({
            selectedLayoutId: layoutId,
            activeTab: "layouts",
        }),

    setMapMode: (mode: MapMode) => set({ mapMode: mode }),

    setSelectedFairwayIndex: (i: number | null) =>
        set({ selectedFairwayIndex: i }),
}));
