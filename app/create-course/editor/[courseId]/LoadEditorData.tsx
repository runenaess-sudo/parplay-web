"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useCourseEditor } from "@/state/useCourseEditor";
import { useEffect } from "react";

export default function LoadEditorData({ courseId }: { courseId: string }) {
    const loadAll = useCourseEditor((s) => s.loadAll);

    useEffect(() => {
        if (!courseId) return;

        async function load() {
            // 1. Hent course
            const { data: course, error: courseError } = await supabaseBrowser
                .from("courses")
                .select("*")
                .eq("id", courseId)
                .single();

            if (courseError || !course) {
                console.error("Could not load course", courseError);
                return;
            }

            // 2. Hent holes
            const { data: holes, error: holesError } = await supabaseBrowser
                .from("holes")
                .select("*")
                .eq("course_id", courseId)
                .order("number", { ascending: true });

            if (holesError) {
                console.error("Could not load holes", holesError);
                return;
            }

            // 3. Riktig parsing av fairway_points
            const parsedHoles = holes.map((h: any) => ({
                ...h,
                fairway_points: Array.isArray(h.fairway_points)
                    ? h.fairway_points
                    : [],
            }));

            // 4. Send til Zustand
            loadAll({
                ...course,
                holes: parsedHoles,
            });
        }

        load();
    }, [courseId]);

    return null;
}
