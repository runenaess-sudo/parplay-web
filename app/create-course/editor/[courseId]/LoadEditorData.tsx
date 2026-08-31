"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useCourseEditor } from "@/state/useCourseEditor";
import { useEffect } from "react";

export default function LoadEditorData({ courseId }: { courseId: string }) {
    const loadAll = useCourseEditor((s) => s.loadAll);

    useEffect(() => {
        if (!courseId) return;

        async function load() {
            const { data: course, error: courseError } = await supabaseBrowser
                .from("courses")
                .select("*")
                .eq("id", courseId)
                .single();

            if (courseError || !course) {
                console.error("Could not load course", courseError);
                return;
            }

            const { data: holes, error: holesError } = await supabaseBrowser
                .from("holes")
                .select("*")
                .eq("course_id", courseId)
                .order("number", { ascending: true });

            if (holesError) {
                console.error("Could not load holes", holesError);
                return;
            }

            const holeIds = (holes ?? []).map((hole) => hole.id);
            const featureResult = holeIds.length > 0
                ? await supabaseBrowser
                    .from("hole_features")
                    .select("*")
                    .in("hole_id", holeIds)
                    .order("sort_order", { ascending: true })
                : { data: [], error: null };

            if (featureResult.error) {
                console.error("Could not load hole features", featureResult.error);
                return;
            }

            // ⭐ Riktig parsing av fairway (ikke fairway_points)
            const parsedHoles = holes.map((h: any) => ({
                ...h,
                fairway: Array.isArray(h.fairway) ? h.fairway : [],
                hole_features: (featureResult.data ?? []).filter((feature) => feature.hole_id === h.id),
            }));

            loadAll({
                ...course,
                holes: parsedHoles,
            });
        }

        load();
    }, [courseId, loadAll]);

    return null;
}
