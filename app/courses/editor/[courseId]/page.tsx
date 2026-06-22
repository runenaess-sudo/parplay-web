// app/courses/editor/[courseId]/page.tsx
import { EditorPanel } from "./EditorPanel";
import LoadEditorData from "./LoadEditorData";
import { MapCanvas } from "./MapCanvas";

type Props = {
    params: { courseId: string };
};

export default function CourseEditorPage({ params }: Props) {
    const { courseId } = params;

    return (
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950">
            {/* TOP HEADER */}
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

            {/* MAIN AREA */}
            <div className="flex flex-1 flex-row overflow-hidden">
                <MapCanvas courseId={courseId} />
                <EditorPanel courseId={courseId} />
            </div>

            {/* AUTO-LOAD EDITOR DATA */}
            <LoadEditorData courseId={courseId} />
        </div>
    );
}
