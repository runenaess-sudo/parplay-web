// app/courses/editor/[courseId]/LoadEditorData.tsx
"use client";

import { useEffect } from "react";
import { useCourseEditor } from "./useCourseEditor";

export default function LoadEditorData({ courseId }: { courseId: string }) {
    const loadAll = useCourseEditor((s) => s.loadAll);

    useEffect(() => {
        loadAll(courseId);
    }, [courseId, loadAll]);

    return null;
}
