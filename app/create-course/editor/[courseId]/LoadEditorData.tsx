// app/create-course/editor/[courseId]/LoadEditorData.tsx
"use client";

import { useCourseEditor } from "@/src/state/useCourseEditor";
import { useEffect } from "react";

export default function LoadEditorData({ courseId }: { courseId: string }) {
    const loadAll = useCourseEditor((s) => s.loadAll);

    useEffect(() => {
        if (!courseId) return;
        loadAll(courseId);
    }, [courseId]);

    return null;
}
