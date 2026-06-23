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

    // GEO DATA
    tee: { lng: number; lat: number } | null;
    basket: { lng: number; lat: number } | null;
    fairway: { lng: number; lat: number }[] | null;

    // NEW: Tee rotation
    tee_rotation?: number;

    // NEW: Hole name (optional)
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

// ---------------------------------------------------------
// STORE SHAPE
// ---------------------------------------------------------
type CourseEditorState = {
    // data
    course: Course | null;
    holes: Hole[];
    layouts: Layout[];

    // ui state
    activeTab: EditorTab;
    selectedHoleId: string | null;
    selectedLayoutId: string | null;
    mapMode: MapMode;

    // NEW: Fairway editing
    selectedFairwayIndex: number | null;

    // loading
    loading: boolean;

    // actions
    loadAll: (courseId: string) => Promise<void>;
    setActiveTab: (tab: EditorTab) => void;
    selectHole: (holeId: string | null) => void;
    selectLayout: (layoutId: string | null) => void;
    setMapMode: (mode: MapMode) => void;

    // NEW: Fairway editing
    setSelectedFairwayIndex: (i: number | null) => void;
};

// ---------------------------------------------------------
// LAZY SUPABASE HELPER (kun i browser)
// ---------------------------------------------------------
async function getSupabase() {
    const mod = await import("@/src/lib/supabase-browser");
    return mod.supabaseBrowser;
}

// ---------------------------------------------------------
// STORE IMPLEMENTATION
// ---------------------------------------------------------
export const useCourseEditor = create<CourseEditorState>()((set, get) => ({
    // initial state
    course: null,
    holes: [],
    layouts: [],
    activeTab: "course",
    selectedHoleId: null,
    selectedLayoutId: null,
    mapMode: "idle",

    // NEW
    selectedFairwayIndex: null,

    loading: false,

    // ---------------------------------------------------------
    // LOAD ALL DATA FOR EDITOR
    // ---------------------------------------------------------
    loadAll: async (courseId: string) => {
        if (!courseId) return;

        set({ loading: true });

        try {
            const supabase = await getSupabase();

            // Load course
            const { data: course } = await supabase
                .from("courses")
                .select("*")
                .eq("id", courseId)
                .single();

            // Load holes
            const { data: holes } = await supabase
                .from("holes")
                .select("*")
                .eq("course_id", courseId)
                .order("number", { ascending: true });

            // Load layouts
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

    // ---------------------------------------------------------
    // UI ACTIONS
    // ---------------------------------------------------------
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

    // ---------------------------------------------------------
    // FAIRWAY EDITING
    // ---------------------------------------------------------
    setSelectedFairwayIndex: (i: number | null) =>
        set({ selectedFairwayIndex: i }),
}));
