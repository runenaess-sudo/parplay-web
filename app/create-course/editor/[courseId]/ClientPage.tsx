"use client";

import { useCourseEditor } from "@/src/state/useCourseEditor";
import { useParams } from "next/navigation";
import { EditorPanel } from "./EditorPanel";
import LoadEditorData from "./LoadEditorData";
import { MapCanvas } from "./MapCanvas";

export default function ClientPage() {
    const { courseId } = useParams() as { courseId: string };

    const course = useCourseEditor((s) => s.course);
    const loading = useCourseEditor((s) => s.loading);

    console.log("ClientPage render", { courseId, loading, course });

    return (
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950">
            <div className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
                <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-200">
                        ParPlay
                    </span>
                    <span className="text-sm font-semibold text-slate-100">
                        Course Editor
                    </span>
                </div>

                <div className="text-xs text-slate-400">
                    Course ID: <span className="font-mono">{courseId}</span>
                </div>
            </div>

            {loading && (
                <div className="flex flex-1 items-center justify-center text-slate-300">
                    Loading editor…
                </div>
            )}

            {!loading && !course && (
                <div className="flex flex-1 items-center justify-center text-red-400 text-center px-6">
                    <div>
                        <div className="text-lg font-semibold mb-2">
                            Could not load course
                        </div>
                        <div className="text-sm opacity-80">
                            This usually means:
                            <br />– The course does not exist
                            <br />– You do not have access (RLS)
                            <br />– Supabase returned null
                        </div>
                    </div>
                </div>
            )}

            {!loading && course && (
                <div className="flex flex-1 flex-row overflow-hidden min-h-0">
                    <div className="relative flex-1 min-h-0">
                        <MapCanvas />
                    </div>
                    <EditorPanel courseId={courseId} />
                </div>
            )}

            <LoadEditorData courseId={courseId} />
        </div>
    );
}
