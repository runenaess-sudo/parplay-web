/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getElevation } from "@/utils/elevation";
import { calculateHoleLength } from "@/utils/holeLength";
import {
    editableCoordinates,
    geometryFromCoordinates,
    minimumVertexCount,
    type HoleFeature,
    type HoleFeatureGeometry,
    type HoleFeatureType,
    type SpatialHoleFeatureType,
} from "@/types/holeFeatures";
import { create } from "zustand";

type EditorMode = "none" | "tee" | "basket" | "points";

type CourseEditorState = {
    course: any | null;
    selectedHoleId: string | null;
    mode: EditorMode;
    featureTool: HoleFeatureType | null;
    drawingCoordinates: [number, number][];
    selectedFeatureId: string | null;

    toast: string | null;
    setToast: (msg: string) => void;
    clearToast: () => void;

    loadAll: (courseData: any) => void;
    setSelectedHole: (holeId: string) => void;
    setMode: (mode: EditorMode) => void;
    startFeatureTool: (type: HoleFeatureType | null) => void;
    addFeatureCoordinate: (lng: number, lat: number) => Promise<void>;
    finishFeatureDrawing: () => Promise<void>;
    cancelFeatureDrawing: () => void;
    selectFeature: (id: string | null) => void;
    updateFeatureComment: (id: string, description: string) => Promise<void>;
    updateFeatureGeometry: (id: string, geometry: HoleFeatureGeometry, persist?: boolean) => Promise<void>;
    moveFeatureVertex: (id: string, index: number, lng: number, lat: number, persist?: boolean) => Promise<void>;
    deleteFeature: (id: string) => Promise<void>;

    setTee: (holeId: string, lng: number, lat: number) => void;
    setBasket: (holeId: string, lng: number, lat: number) => void;

    addFairwayPoint: (holeId: string, lng: number, lat: number) => void;
    moveFairwayPoint: (holeId: string, index: number, lng: number, lat: number) => void;
    removeFairwayPoint: (holeId: string, index: number) => void;

    setTeeAngle: (holeId: string, angle: number) => void;

    saveHole: (holeId: string) => Promise<void>;

    // ⭐ NEW
    createNewHole: (courseId: string) => Promise<void>;
};

export const useCourseEditor = create<CourseEditorState>((set, get) => ({
    course: null,
    selectedHoleId: null,
    mode: "none",
    featureTool: null,
    drawingCoordinates: [],
    selectedFeatureId: null,

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

    setSelectedHole: async (holeId) => {
        const prevHoleId = get().selectedHoleId;

        console.log("SET SELECTED HOLE:", { prevHoleId, newHoleId: holeId });

        if (prevHoleId && prevHoleId !== holeId) {
            console.log("AUTO‑SAVE TRIGGERED (hole switch)");
            await get().saveHole(prevHoleId);
        }

        set({ selectedHoleId: holeId, selectedFeatureId: null, featureTool: null, drawingCoordinates: [] });
    },

    setMode: async (mode) => {
        const prevMode = get().mode;
        const holeId = get().selectedHoleId;

        console.log("SET MODE:", { prevMode, newMode: mode });

        if (prevMode !== "none" && mode === "none" && holeId) {
            console.log("AUTO‑SAVE TRIGGERED (mode → none)");
            await get().saveHole(holeId);
        }

        set({ mode, featureTool: null, drawingCoordinates: [], selectedFeatureId: null });
    },

    startFeatureTool: (type) => set({
        featureTool: type,
        drawingCoordinates: [],
        selectedFeatureId: null,
        mode: "none",
    }),

    cancelFeatureDrawing: () => set({ featureTool: null, drawingCoordinates: [] }),

    selectFeature: (id) => set({
        selectedFeatureId: id,
        featureTool: null,
        drawingCoordinates: [],
        mode: "none",
    }),

    addFeatureCoordinate: async (lng, lat) => {
        const { featureTool, selectedHoleId, drawingCoordinates } = get();
        if (!featureTool || !selectedHoleId || featureTool === "INFO") return;
        const next = [...drawingCoordinates, [lng, lat] as [number, number]];
        set({ drawingCoordinates: next });
        if (featureTool === "MANDO" || featureTool === "DROPZONE") {
            await get().finishFeatureDrawing();
        }
    },

    finishFeatureDrawing: async () => {
        const { featureTool, selectedHoleId, drawingCoordinates, course } = get();
        if (!featureTool || !selectedHoleId || !course) return;

        const coordinates = featureTool === "INFO" ? [] : drawingCoordinates;
        if (featureTool !== "INFO" && coordinates.length < minimumVertexCount(featureTool)) {
            get().setToast(`Add at least ${minimumVertexCount(featureTool)} point(s).`);
            return;
        }

        const id = crypto.randomUUID();
        const hole = course.holes.find((item: any) => item.id === selectedHoleId);
        const features = (hole?.hole_features ?? []) as HoleFeature[];
        const geometry = featureTool === "INFO"
            ? null
            : geometryFromCoordinates(featureTool as SpatialHoleFeatureType, coordinates);
        const feature: HoleFeature = {
            id,
            hole_id: selectedHoleId,
            feature_type: featureTool,
            geometry,
            description: null,
            properties: {},
            sort_order: features.length,
        };
        const { error } = await supabaseBrowser.from("hole_features").insert(feature);
        if (error) {
            console.error("Failed to create hole feature", error);
            get().setToast("Error saving feature");
            return;
        }
        const holes = course.holes.map((item: any) => item.id === selectedHoleId
            ? { ...item, hole_features: [...(item.hole_features ?? []), feature] }
            : item);
        set({
            course: { ...course, holes },
            featureTool: null,
            drawingCoordinates: [],
            selectedFeatureId: id,
        });
        get().setToast("Feature saved");
    },

    updateFeatureComment: async (id, description) => {
        const { course } = get();
        if (!course) return;
        const normalized = description.trim() || null;
        const { error } = await supabaseBrowser.from("hole_features")
            .update({ description: normalized }).eq("id", id);
        if (error) {
            console.error("Failed to update feature comment", error);
            get().setToast("Error saving comment");
            return;
        }
        const holes = course.holes.map((hole: any) => ({
            ...hole,
            hole_features: (hole.hole_features ?? []).map((feature: HoleFeature) =>
                feature.id === id ? { ...feature, description: normalized } : feature),
        }));
        set({ course: { ...course, holes } });
        get().setToast("Comment saved");
    },

    updateFeatureGeometry: async (id, geometry, persist = true) => {
        const { course } = get();
        if (!course) return;
        if (persist) {
            const { error } = await supabaseBrowser.from("hole_features")
                .update({ geometry }).eq("id", id);
            if (error) {
                console.error("Failed to update feature geometry", error);
                get().setToast("Error saving geometry");
                return;
            }
        }
        const holes = course.holes.map((hole: any) => ({
            ...hole,
            hole_features: (hole.hole_features ?? []).map((feature: HoleFeature) =>
                feature.id === id ? { ...feature, geometry } : feature),
        }));
        set({ course: { ...course, holes } });
    },

    moveFeatureVertex: async (id, index, lng, lat, persist = true) => {
        const { course } = get();
        if (!course) return;
        const feature = course.holes.flatMap((hole: any) => hole.hole_features ?? [])
            .find((item: HoleFeature) => item.id === id) as HoleFeature | undefined;
        if (!feature) return;
        const coordinates = editableCoordinates(feature);
        if (!coordinates[index]) return;
        coordinates[index] = [lng, lat];
        const geometry = geometryFromCoordinates(
            feature.feature_type as SpatialHoleFeatureType,
            coordinates,
        );
        await get().updateFeatureGeometry(id, geometry, persist);
    },

    deleteFeature: async (id) => {
        const { course } = get();
        if (!course) return;
        const { error } = await supabaseBrowser.from("hole_features").delete().eq("id", id);
        if (error) {
            console.error("Failed to delete hole feature", error);
            get().setToast("Error deleting feature");
            return;
        }
        const holes = course.holes.map((hole: any) => ({
            ...hole,
            hole_features: (hole.hole_features ?? []).filter((feature: HoleFeature) => feature.id !== id),
        }));
        set({ course: { ...course, holes }, selectedFeatureId: null });
        get().setToast("Feature deleted");
    },

    setTee: (holeId, lng, lat) => {
        console.log("SET TEE:", { holeId, lng, lat });

        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId ? { ...h, tee_longitude: lng, tee_latitude: lat } : h
        );

        set({ course: { ...course, holes: [...holes] } });
    },

    setBasket: (holeId, lng, lat) => {
        console.log("SET BASKET:", { holeId, lng, lat });

        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId ? { ...h, basket_longitude: lng, basket_latitude: lat } : h
        );

        set({ course: { ...course, holes: [...holes] } });
    },

    addFairwayPoint: (holeId, lng, lat) => {
        console.log("ADD FAIRWAY POINT:", { holeId, lng, lat });

        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId
                ? {
                    ...h,
                    fairway: [...(h.fairway ?? []), { lng, lat }],
                }
                : h
        );

        set({ course: { ...course, holes: [...holes] } });
    },

    moveFairwayPoint: (holeId, index, lng, lat) => {
        console.log("MOVE FAIRWAY POINT:", { holeId, index, lng, lat });

        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) => {
            if (h.id !== holeId) return h;
            const points = [...(h.fairway ?? [])];
            if (!points[index]) return h;
            points[index] = { lng, lat };
            return { ...h, fairway: points };
        });

        set({ course: { ...course, holes: [...holes] } });
    },

    removeFairwayPoint: (holeId, index) => {
        console.log("REMOVE FAIRWAY POINT:", { holeId, index });

        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) => {
            if (h.id !== holeId) return h;
            const points = [...(h.fairway ?? [])];
            if (!points[index]) return h;
            points.splice(index, 1);
            return { ...h, fairway: points };
        });

        set({ course: { ...course, holes: [...holes] } });
    },

    setTeeAngle: (holeId, angle) => {
        console.log("SET TEE ANGLE:", { holeId, angle });

        const course = get().course;
        if (!course) return;

        const holes = course.holes.map((h: any) =>
            h.id === holeId ? { ...h, tee_angle: angle } : h
        );

        set({
            course: {
                ...course,
                holes: [...holes],
            },
        });
    },

    // ⭐ SAVE WITH FULL RELOAD
    saveHole: async (holeId: string) => {
        console.log("SAVE HOLE TRIGGERED:", holeId);

        const { course } = get();
        if (!course) return;

        const hole = course.holes.find((h: any) => h.id === holeId);
        if (!hole) return;

        console.log("HOLE BEFORE SAVE:", hole);

        const hasTeePosition =
            Number.isFinite(hole.tee_latitude) && Number.isFinite(hole.tee_longitude);
        const hasBasketPosition =
            Number.isFinite(hole.basket_latitude) && Number.isFinite(hole.basket_longitude);

        const teeElevation =
            hasTeePosition
                ? await getElevation(hole.tee_latitude, hole.tee_longitude)
                : null;

        const basketElevation =
            hasBasketPosition
                ? await getElevation(hole.basket_latitude, hole.basket_longitude)
                : null;

        const fairwayPoints = await Promise.all(
            (hole.fairway ?? []).map(async (p: any) => {
                const elev = await getElevation(p.lat, p.lng);
                return { ...p, elevation: elev };
            })
        );

        const lineCoords: [number, number][] = [];
        if (hasTeePosition) lineCoords.push([hole.tee_longitude, hole.tee_latitude]);
        fairwayPoints.forEach((p) => lineCoords.push([p.lng, p.lat]));
        if (hasBasketPosition) lineCoords.push([hole.basket_longitude, hole.basket_latitude]);

        const lengthMeters =
            hasTeePosition && hasBasketPosition
                ? calculateHoleLength(lineCoords)
                : null;

        const payload = {
            tee_latitude: hole.tee_latitude,
            tee_longitude: hole.tee_longitude,
            tee_elevation: teeElevation,
            tee_angle: hole.tee_angle ?? 0,

            basket_latitude: hole.basket_latitude,
            basket_longitude: hole.basket_longitude,
            basket_elevation: basketElevation,

            elevation_diff:
                basketElevation != null && teeElevation != null
                    ? basketElevation - teeElevation
                    : null,

            fairway: fairwayPoints,
            distance: lengthMeters != null ? Math.round(lengthMeters) : null,

            updated_at: new Date().toISOString(),
            course_name: course.name,
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

        console.log("✅ HOLE SAVED — RELOADING FROM SUPABASE");

        const { data: freshHole, error: reloadError } = await supabaseBrowser
            .from("holes")
            .select("*")
            .eq("id", holeId)
            .single();

        if (reloadError || !freshHole) {
            console.log("❌ ERROR RELOADING HOLE:", reloadError);
            return;
        }

        console.log("🔥 FRESH HOLE FROM DB:", freshHole);

        const updatedHoles = course.holes.map((h: any) =>
            h.id === holeId ? { ...freshHole, hole_features: h.hole_features ?? [] } : h
        );

        set({
            course: {
                ...course,
                holes: updatedHoles,
            },
        });

        get().setToast("Hole saved");
    },

    // ⭐ NEW — ADD NEW HOLE
    createNewHole: async (courseId: string) => {
        const supabase = supabaseBrowser;
        const state = get();

        const nextNumber =
            state.course?.holes?.length > 0
                ? Math.max(...state.course.holes.map((h: any) => h.number)) + 1
                : 1;

        // DEBUG og guard før insert
        const { data: sessionData } = await supabase.auth.getSession();
        const { data: userData } = await supabase.auth.getUser();

        console.log("DEBUG sessionData:", sessionData);
        console.log("DEBUG userData:", userData);
        console.log("DEBUG access_token:", sessionData?.session?.access_token ?? null);

        if (!userData?.user) {
            console.error("Not authenticated — cannot create hole");
            get().setToast("Du må være logget inn for å opprette hull");
            return;
        }

        // kjør insert og logg hele responsen
        const res = await supabase
            .from("holes")
            .insert({
                course_id: courseId,
                number: nextNumber,
                par: 3,
                tee_latitude: null,
                tee_longitude: null,
                basket_latitude: null,
                basket_longitude: null,
                fairway: [],
                tee_type: "Turf",
                basket_type: "Prodigy",
            })
            .select()
            .single();

        console.log("DEBUG insert response:", JSON.stringify(res, null, 2));

        const { data, error } = res;

        if (error || !data) {
            console.error("Failed to create hole", error);
            get().setToast("Error creating hole");
            return;
        }

        set((s) => ({
            course: {
                ...s.course,
                holes: [...s.course.holes, { ...data, hole_features: [] }],
            },
            selectedHoleId: data.id,
        }));
    },
}));
