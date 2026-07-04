"use client";

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

            // ⭐ Riktig parsing av fairway (ikke fairway_points)
            const parsedHoles = holes.map((h: any) => ({
                ...h,
                fairway: Array.isArray(h.fairway) ? h.fairway : [],
            }));

            loadAll({
                ...course,
                holes: parsedHoles,
            });
        }

        load();
    }, [courseId]);

    return null;
}
