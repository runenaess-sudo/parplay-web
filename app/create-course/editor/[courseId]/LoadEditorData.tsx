"use client";

import { useCourseEditor } from "@/src/state/useCourseEditor";
import { createClient } from "@supabase/supabase-js";
import { useEffect } from "react";

export default function LoadEditorData({ courseId }: { courseId: string }) {
    const loadAll = useCourseEditor((s) => s.loadAll);

    useEffect(() => {
        if (!courseId) return;

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        async function load() {
            // 1. Hent course
            const { data: course, error: courseError } = await supabase
                .from("courses")
                .select("*")
                .eq("id", courseId)
                .single();

            if (courseError || !course) {
                console.error("Could not load course", courseError);
                return;
            }

            // 2. Hent holes
            const { data: holes, error: holesError } = await supabase
                .from("holes")
                .select("*")
                .eq("course_id", courseId)
                .order("number", { ascending: true });

            if (holesError) {
                console.error("Could not load holes", holesError);
                return;
            }

            // 3. Fairway er allerede et objekt → ingen JSON.parse
            const parsedHoles = holes.map((h) => ({
                ...h,
                fairway_points: Array.isArray(h.fairway) ? h.fairway : [],
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
